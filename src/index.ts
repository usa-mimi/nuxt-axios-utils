import axios, {
  AxiosError,
  AxiosTransformer,
  AxiosInstance,
  AxiosResponse,
} from 'axios'
import qs from 'qs'
import { snakeProps, camelProps } from 'change-prop-case'
export {
  AxiosInstance,
  AxiosError,
  AxiosTransformer,
  AxiosResponse,
} from 'axios'

export interface HttpError extends AxiosError {
  status?: number
  statusCode?: number
}

export type ErrorDict = {
  [key: string]: undefined | string[] | ErrorDict[]
}

const toSnake: AxiosTransformer = function(data: any) {
  if (
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) ||
    (typeof File !== 'undefined' && data instanceof File)
  ) {
    return data
  }
  return snakeProps(data)
}

function getTransformRequest(): AxiosTransformer[] {
  let defaults = axios.defaults.transformRequest
  if (Array.isArray(defaults)) return [toSnake].concat(defaults)
  if (!defaults) return [toSnake]
  return [toSnake, defaults]
}

function getTransformResponse(): AxiosTransformer[] {
  let defaults = axios.defaults.transformResponse
  if (Array.isArray(defaults)) return defaults.concat(camelProps)
  if (!defaults) return [camelProps]
  return [defaults, camelProps]
}

function setHttpStatusToError(error: HttpError) {
  if (error.response) {
    error.status = error.statusCode = error.response.status
  }
  return error
}

export type RequestHeaderConfig = {
  common?: Record<string, string>
  get?: Record<string, string>
  post?: Record<string, string>
  put?: Record<string, string>
  patch?: Record<string, string>
  delete?: Record<string, string>
}

export type RequestHeaderWriter = (
  headers: RequestHeaderConfig
) => RequestHeaderConfig

export type NuxtAxiosOptions = {
  clientBaseURL: string
  serverBaseURL?: string
  isServer: boolean
  headerWriter?: RequestHeaderWriter
  onHttpError?: (
    err: HttpError,
    statusCode: number,
    response: AxiosResponse
  ) => Promise<HttpError>
  req?: any
}
export function createAxiosInstance({
  clientBaseURL,
  serverBaseURL,
  isServer,
  headerWriter,
  onHttpError,
  req,
}: NuxtAxiosOptions): AxiosInstance {
  let headers: RequestHeaderConfig | null = null
  serverBaseURL = serverBaseURL || clientBaseURL

  if (isServer && req) {
    // NOTE: サーバ側のAPIリクエストはnginxを経由しないため
    // nginxのproxy_set_headerで設定する項目をここで設定する
    const url = require('url')
    const endpointUrl = new url.URL(clientBaseURL)
    headers = {
      common: {
        host: endpointUrl.host,
        'x-forwarded-proto': endpointUrl.protocol,
        'x-forwarded-for': req.headers['x-forwarded-for'] || '',
      },
    }
  }

  let axiosInstance = axios.create({
    paramsSerializer: params =>
      qs.stringify(toSnake(params), { indices: false }),
    transformRequest: getTransformRequest(),
    transformResponse: getTransformResponse(),
    headers,
    baseURL: isServer ? serverBaseURL : clientBaseURL,
  })

  // set token interceptors
  axiosInstance.interceptors.response.use(
    res => res.data,
    error => {
      error = setHttpStatusToError(error)
      let response = error.response
      if (onHttpError && response) {
        return onHttpError(error, response, response.status)
      }
      return Promise.reject(error)
    }
  )
  axiosInstance.interceptors.request.use(
    config => {
      if (headerWriter) {
        config.headers = headerWriter(config.headers)
      }
      return config
    },
    err => Promise.reject(err)
  )
  return axiosInstance
}

export function getValidationError(err: HttpError) {
  let response = err.response
  let rval: ErrorDict = {}
  if (response) {
    if (response.status === 400) {
      let data = response.data
      Object.keys(data).forEach(k => {
        rval[k] = data[k]
      })
    }
  } else {
    console.error(err)
    rval.nonFieldErrors = ['予期しないエラーが発生しました。']
  }
  return rval
}

export function errToProps(err: HttpError) {
  let res: AxiosResponse | undefined = err.response
  if (res) {
    return {
      status: res.status,
      statusCode: res.status,
      message: res.statusText,
    }
  } else {
    console.error(err)
    return {
      status: 500,
      statusCode: 500,
      message: 'Internal Server Error',
    }
  }
}
