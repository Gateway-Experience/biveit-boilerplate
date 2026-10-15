import _ from 'lodash';
import axios, { type AxiosRequestConfig } from 'axios';

// Errors are normalised to this shape so callers can switch on `code`.
export type RequestError = {
  code: number;
  data?: unknown;
};

type RequestOptions = AxiosRequestConfig | string;

// This is used to request backend. Heavily used.
async function callBe(axiosOptions: RequestOptions, useToken = true) {
  let axiosRequest: AxiosRequestConfig;
  if (typeof axiosOptions === 'string') {
    axiosRequest = { url: axiosOptions, method: 'GET' };
  } else {
    axiosRequest = { ...axiosOptions, method: axiosOptions.method || 'GET' };
  }

  axiosRequest.baseURL = import.meta.env.VITE_API_BASE_URL;

  const token = localStorage.getItem('token');
  if (token && useToken) {
    axiosRequest.headers = {
      ..._.get(axiosOptions, 'headers', {}),
      Authorization: `Bearer ${token}`,
    };
  }

  return request(axiosRequest);
}

// For more generic requests.
async function request(options: RequestOptions = {}) {
  if (typeof options === 'string') {
    options = { url: options };
  }
  try {
    const result = await axios({
      ...options,
      method: options.method || 'GET',
    });
    return result.data;
  } catch (error) {
    throw getRequestError(error);
  }
}

function getRequestError(error: unknown): RequestError | unknown {
  const status = _.get(error, 'response.status');
  if (status) {
    return { code: status, data: _.get(error, 'response.data') };
  }
  return error;
}

export {
  callBe,
  request,
};
