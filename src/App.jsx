// src/App.jsx
import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Routes, Route, Navigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { selectAuth } from './store/slices/authSlice'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
// import Marts      from './pages/Marts'
import Staff from './pages/Staff'
import Categories from './pages/Categories'
import Products from './pages/Products'
import Orders from './pages/Orders'
import Inventory from './pages/Inventory'
import Drivers from './pages/Drivers'
import BulkUpload from './pages/BulkUpload'
import Returns from './pages/Returns'
import Transfers from './pages/Transfers'

function Protected({ children }) {
    const { isLoggedIn } = useSelector(selectAuth)
    if (!isLoggedIn) return <Navigate to="/login" replace />
    return <Layout>{children}</Layout>
}

export default function App() {
    const { isLoggedIn } = useSelector(selectAuth)

    // Socket for bulk-job updates — only when logged in
    useEffect(() => {
        if (!isLoggedIn) return

        const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'
        const socket = io(SOCKET_URL, {
            auth: { token: 'token_in_cookie' },
            transports: ['websocket'],
        })

        socket.on('bulk_job_update', (data) => {
            alert(`📢 Bulk Upload Update:\n${data.message}`)
        })

        return () => socket.disconnect()
    }, [isLoggedIn])

    return (
        <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            {/* <Route path="/marts"       element={<Protected><Marts /></Protected>} /> */}
            <Route path="/staff" element={<Protected><Staff /></Protected>} />
            <Route path="/categories" element={<Protected><Categories /></Protected>} />
            <Route path="/products" element={<Protected><Products /></Protected>} />
            <Route path="/orders" element={<Protected><Orders /></Protected>} />
            <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
            <Route path="/transfers" element={<Protected><Transfers /></Protected>} />
            <Route path="/drivers" element={<Protected><Drivers /></Protected>} />
            <Route path="/bulk-upload" element={<Protected><BulkUpload /></Protected>} />
            <Route path="/returns" element={<Protected><Returns /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}