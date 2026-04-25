// src/components/Protected.jsx
//
// Simple redirect-if-logged-out guard. No loader, no initialization wait —
// `isLoggedIn` is true from the first render when we have a cached user.

import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function Protected({ children }) {
    const { isLoggedIn } = useAuth()
    if (!isLoggedIn) return <Navigate to="/login" replace />
    return children
}