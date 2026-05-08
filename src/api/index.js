// src/api/index.js
const BASE_URL = 'http://localhost:3000/api'

// import.meta.env.VITE_API_URL ||

// Ensure this key matches exactly what you see in your Browser's Application tab
export const getToken = () => localStorage.getItem('ksmcm_token') || ''

const request = async (method, path, body = null) => {
    const isFormData = body instanceof FormData
    const token = getToken(); // <--- 1. CALL THE FUNCTION

    const options = {
        method,
        credentials: 'include',
        headers: {
            ...(!isFormData && { 'Content-Type': 'application/json' }),
            'X-Client-Type': 'web',
            // 2. ADD THE AUTHORIZATION HEADER MANUALLY
            ...(token && { 'Authorization': `Bearer ${token}` }),
        },
    }

    if (body) options.body = isFormData ? body : JSON.stringify(body)

    const res = await fetch(`${BASE_URL}${path}`, options)

    // Safety check: if response is not JSON (like a 500 error page), res.json() will crash
    let data;
    try {
        data = await res.json()
    } catch (e) {
        data = { success: false, message: 'Invalid server response' }
    }

    if (res.status === 401) {
        // We commented out the redirect, so the app won't refresh anymore!
        // But we still clear the storage because the token is invalid.
        localStorage.clear()
        console.error("Session expired or Token missing");
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