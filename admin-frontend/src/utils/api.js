import axios from 'axios'

const appBase = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_user')
      localStorage.removeItem('admin_token')
      window.location.href = `${appBase}login`
    }
    return Promise.reject(err)
  }
)

export default api
