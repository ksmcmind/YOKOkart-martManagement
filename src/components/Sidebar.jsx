import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../store/slices/authSlice'
import { selectUser } from '../store/slices/authSlice'

const NAV = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    // { to: '/marts', label: 'Marts', icon: '🏬' },
    { to: '/staff', label: 'Staff', icon: '👥' },
    { to: '/categories', label: 'Categories', icon: '🗂️' },
    { to: '/products', label: 'Products', icon: '🛍️' },
    { to: '/orders', label: 'Orders', icon: '📦' },
    { to: '/inventory', label: 'Inventory', icon: '📋' },
    { to: '/transfers', label: 'Received Goods', icon: '🚚' },
    { to: '/drivers', label: 'Drivers', icon: '🚴' },
    { to: '/returns', label: 'Returns', icon: '↩️' },
]

export default function Sidebar() {
    const dispatch = useDispatch()
    const user = useSelector(selectUser)
    const [collapsed, setCollapsed] = useState(false)

    return (
        <aside className={`${collapsed ? 'w-20' : 'w-60'} bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0 transition-all duration-300 z-50`}>
            {/* Logo */}
            <div className="p-4 h-16 border-b border-gray-50 flex items-center justify-between overflow-hidden">
                {!collapsed && (
                    <div className="flex items-center gap-2 animate-in fade-in duration-300">
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">K</div>
                        <div>
                            <div className="font-bold text-gray-900 text-xs tracking-tight">KSMCM</div>
                            <div className="text-[10px] text-gray-400 font-medium">SUPER ADMIN</div>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`p-2 rounded-lg hover:bg-gray-50 text-gray-400 transition-colors ${collapsed ? 'mx-auto' : ''}`}
                    title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {collapsed ? '➡️' : '⬅️'}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
                {NAV.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        title={collapsed ? item.label : ''}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-primary-50 text-primary-600 shadow-sm'
                                : 'text-gray-500 hover:bg-gray-50'
                            }`
                        }
                    >
                        <span className={`text-xl transition-transform duration-200 group-hover:scale-110 ${collapsed ? 'mx-auto' : ''}`}>{item.icon}</span>
                        {!collapsed && <span className="text-sm font-semibold tracking-wide animate-in slide-in-from-left-2 duration-300">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* User + Logout */}
            <div className="p-3 border-t border-gray-50 bg-gray-50/30">
                {!collapsed && (
                    <div className="px-3 py-2 mb-2 bg-white rounded-xl border border-gray-100 shadow-sm animate-in zoom-in-95 duration-300">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">Admin Profile</p>
                        <p className="text-xs font-bold text-gray-800 truncate mt-1">{user?.name || 'Super Admin'}</p>
                    </div>
                )}
                <button
                    onClick={() => dispatch(logout())}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all font-bold group ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? "Logout" : ""}
                >
                    <span className="text-xl group-hover:rotate-12 transition-transform">🚪</span>
                    {!collapsed && <span className="text-sm">Logout</span>}
                </button>
            </div>
        </aside>
    )
}
