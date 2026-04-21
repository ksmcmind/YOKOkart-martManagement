// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsLoggedIn } from './store/slices/authSlice'
import useAuth from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Dispatch from './pages/Dispatch'
import Packing from './pages/Packing'
import Products from './pages/Products'
import Inventory from './pages/Inventory'
import Staff from './pages/Staff'
import Drivers from './pages/Drivers'
import Reports from './pages/Reports'
import Support from './pages/Support'
import Categories from './pages/Categories'
// Protected + role guard
function Protected({ children, allowed }) {
    const isLoggedIn = useSelector(selectIsLoggedIn)
    const { role } = useAuth()

    if (!isLoggedIn) return <Navigate to="/login" replace />
    if (allowed && !allowed.includes(role)) return <Navigate to="/" replace />

    return <Layout>{children}</Layout>
}

export default function App() {
    const isLoggedIn = useSelector(selectIsLoggedIn)

    return (
        <Routes>
            <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <Login />} />

            {/* All roles */}
            <Route path="/" element={<Protected><Dashboard /></Protected>} />

            {/* Orders — mart_admin, manager, dispatcher */}
            <Route path="/orders" element={<Protected allowed={['mart_admin', 'manager', 'dispatcher']}><Orders /></Protected>} />
            <Route path="/dispatch" element={<Protected allowed={['mart_admin', 'manager', 'dispatcher']}><Dispatch /></Protected>} />
            <Route path="/categories" element={<Protected allowed={['mart_admin', 'manager', 'dispatcher']}><Categories /></Protected>} />
            {/* Packing — mart_admin, manager, packing_staff */}
            <Route path="/packing" element={<Protected allowed={['mart_admin', 'manager', 'packing_staff']}><Packing /></Protected>} />

            {/* Products + Inventory — mart_admin, manager, stock_manager */}
            <Route path="/products" element={<Protected allowed={['mart_admin', 'manager', 'stock_manager']}><Products /></Protected>} />
            <Route path="/inventory" element={<Protected allowed={['mart_admin', 'manager', 'stock_manager']}><Inventory /></Protected>} />

            {/* Staff — mart_admin only */}
            <Route path="/staff" element={<Protected allowed={['mart_admin']}><Staff /></Protected>} />
            <Route path="/drivers" element={<Protected allowed={['mart_admin', 'manager', 'dispatcher']}><Drivers /></Protected>} />

            {/* Reports — mart_admin, manager, accountant */}
            <Route path="/reports" element={<Protected allowed={['mart_admin', 'manager', 'accountant']}><Reports /></Protected>} />

            {/* Support */}
            <Route path="/support" element={<Protected allowed={['mart_admin', 'support']}><Support /></Protected>} />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}