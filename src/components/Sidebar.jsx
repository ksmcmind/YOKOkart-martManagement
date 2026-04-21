// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/slices/authSlice'
import { selectUser } from '../store/slices/authSlice'

const NAV = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/marts', label: 'Marts', icon: '🏬' },
    { to: '/staff', label: 'Staff', icon: '👥' },
    { to: '/categories', label: 'Categories', icon: '🗂️' },
    { to: '/products', label: 'Products', icon: '🛍️' },
    { to: '/orders', label: 'Orders', icon: '📦' },
    { to: '/inventory', label: 'Inventory', icon: '📋' },
    { to: '/drivers', label: 'Drivers', icon: '🚴' },
]

export default function Sidebar() {
    const dispatch = useDispatch()
    const user = useSelector(selectUser)

    return (
        <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
            {/* Logo */}
            <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        K
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 text-sm leading-tight">KSMCM</div>
                        <div className="text-xs text-gray-400">Super Admin</div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                {NAV.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            isActive ? 'nav-link-active' : 'nav-link-inactive'
                        }
                    >
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User + Logout */}
            <div className="p-3 border-t border-gray-100">
                <div className="px-4 py-2 mb-1">
                    <p className="text-xs font-medium text-gray-900 truncate">{user?.name || 'Super Admin'}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.phone}</p>
                </div>
                <button
                    onClick={() => dispatch(logout())}
                    className="nav-link-inactive w-full text-red-500 hover:bg-red-50"
                >
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    )
}