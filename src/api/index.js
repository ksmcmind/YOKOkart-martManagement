// src/api/index.js
// Change BASE_URL if backend runs on different port
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const getToken = () => localStorage.getItem('ksmcm_mart_token') || ''

const request = async (method, path, body = null) => {
    const isFormData = body instanceof FormData

    const options = {
        method,
        headers: {
            ...(!isFormData && { 'Content-Type': 'application/json' }),
            'Authorization': `Bearer ${getToken()}`,
        },
    }

    if (body) options.body = isFormData ? body : JSON.stringify(body)

    const res = await fetch(`${BASE_URL}${path}`, options)
    const data = await res.json()

    if (res.status === 401) {
        localStorage.clear()
        window.location.href = '/'
    }

    return data
}

export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
}

export default api