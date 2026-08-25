const API_BASE_URL = globalThis.__CAR_WASH_API_BASE_URL__ || 'http://localhost:3000'

export const hasBackendApi = () => typeof uni !== 'undefined' && typeof uni.request === 'function'

export const requestBackend = ({ url, method = 'GET', data, header = {} }) => new Promise((resolve, reject) => {
  uni.request({
    url: `${API_BASE_URL}${url}`,
    method,
    data,
    header: { 'content-type': 'application/json', ...header },
    success: (response) => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        resolve(response.data?.data)
        return
      }
      reject(new Error(response.data?.error?.message || `请求失败(${response.statusCode})`))
    },
    fail: (error) => reject(new Error(error?.errMsg || '后台服务不可用'))
  })
})
