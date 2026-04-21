// src/hooks/useAuth.js
// Mart staff auth — martId ALWAYS comes from JWT token
// No mart selection dropdown ever shown to mart staff
import { useSelector } from 'react-redux'
import { selectUser } from '../store/slices/authSlice'

export default function useAuth() {
    const user = useSelector(selectUser)

    const role = user?.role || ''
    const martId = user?.mongoMartId || '' // always from JWT — never from dropdown

    // Role checks
    const is = {
        martAdmin: role === 'mart_admin',
        manager: role === 'manager',
        dispatcher: role === 'dispatcher',
        stockManager: role === 'stock_manager',
        cashier: role === 'cashier',
        packingStaff: role === 'packing_staff',
        accountant: role === 'accountant',
        support: role === 'support',
    }

    // Permission groups
    const can = {
        manageProducts: ['mart_admin', 'manager', 'stock_manager'].includes(role),
        manageInventory: ['mart_admin', 'manager', 'stock_manager'].includes(role),
        viewOrders: ['mart_admin', 'manager', 'dispatcher', 'cashier', 'packing_staff', 'support'].includes(role),
        assignDrivers: ['mart_admin', 'manager', 'dispatcher'].includes(role),
        manageStaff: role === 'mart_admin',
        viewReports: ['mart_admin', 'manager', 'accountant'].includes(role),
        accessPOS: ['mart_admin', 'cashier'].includes(role),
        packOrders: ['mart_admin', 'manager', 'packing_staff'].includes(role),
        viewFinance: ['mart_admin', 'accountant'].includes(role),
        supportCustomers: ['mart_admin', 'support'].includes(role),
    }

    return { user, role, martId, is, can }
}