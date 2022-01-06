/* eslint-disable @typescript-eslint/no-explicit-any */
import {dispatch, getState} from '@common';
import {RESULT_CODE_PUSH_OUT, TIME_OUT} from '@config/api';
import {ParamsNetwork, ResponseBase} from '@config/type';
import {onSetToken} from '@store/app-redux/reducer';
import {AppState} from '@store/app-redux/type';
import Axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from 'axios';
import {StyleSheet} from 'react-native';

import {ApiConstants} from './api';
import {
  handleErrorAxios,
  handleParameter,
  handleResponseAxios,
  onPushLogout,
} from './helper';

const tokenKeyHeader = 'authorization';
let refreshTokenRequest: Promise<string | null> | null = null;
const AxiosInstance = Axios.create({});

AxiosInstance.interceptors.response.use(
  response => response,
  async function (error) {
    const originalRequest = error.config;
    if (
      error &&
      error.response &&
      (error.response.status === 403 || error.response.status === 401) &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      refreshTokenRequest = refreshTokenRequest
        ? refreshTokenRequest
        : refreshToken(originalRequest);
      const newToken = await refreshTokenRequest;
      refreshTokenRequest = null;
      if (newToken === null) {
        return Promise.reject(error);
      }
      dispatch(onSetToken(newToken));
      originalRequest.headers[tokenKeyHeader] = newToken;
      return AxiosInstance(originalRequest);
    }
    return Promise.reject(error);
  },
);

// refresh token
async function refreshToken(originalRequest: any) {
  return AxiosInstance.get(ApiConstants.REFRESH_TOKEN, originalRequest)
    .then((res: AxiosResponse) => res.data)
    .catch(() => null);
}

// base
function Request<T = unknown>(config: AxiosRequestConfig, isCheckOut = true) {
  const {token, appUrl}: AppState = getState('app');
  const defaultConfig: AxiosRequestConfig = {
    baseURL: appUrl,
    timeout: TIME_OUT,
    headers: {
      'Content-Type': 'application/json',
      [tokenKeyHeader]: token ?? '',
    },
  };
  return new Promise<ResponseBase<T> | null>(rs => {
    AxiosInstance.request(StyleSheet.flatten([defaultConfig, config]))
      .then((res: AxiosResponse<T>) => {
        const result = handleResponseAxios(res);
        rs(result);
      })
      .catch((error: AxiosError) => {
        const result = handleErrorAxios(error);
        if (!isCheckOut) {
          rs(result);
        }
        if (result.code === RESULT_CODE_PUSH_OUT && isCheckOut) {
          onPushLogout();
          rs(null);
        } else {
          rs(result);
        }
      });
  });
}

// get
async function Get<T>(params: ParamsNetwork) {
  return Request<T>(handleParameter(params, 'GET'));
}

// post
async function Post<T>(params: ParamsNetwork) {
  return Request<T>(handleParameter(params, 'POST'));
}

type ParameterPostFormData = AxiosRequestConfig & ParamsNetwork;
// post FormData
async function PostFormData<T>(params: ParamsNetwork) {
  const {token}: AppState = getState('app');
  const headers: AxiosRequestConfig['headers'] = {
    token: token ?? '',
    'Content-Type': 'multipart/form-data',
  };
  return Request<T>(
    handleParameter<ParameterPostFormData>({...params, headers}, 'POST'),
  );
}

// put
async function Put<T>(params: ParamsNetwork) {
  return Request<T>(handleParameter(params, 'PUT'));
}

// delete
async function Delete<T>(params: ParamsNetwork) {
  return Request<T>(handleParameter(params, 'DELETE'));
}
export type NetWorkResponseType<T> = (
  params: ParamsNetwork,
) => Promise<ResponseBase<T> | null>;

export const NetWorkService = {
  Get,
  Post,
  Put,
  Delete,
  PostFormData,
  Request,
};