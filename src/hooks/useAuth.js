// src/hooks/useAuth.js
//
// Mart staff auth hook — reads from Redux auth state (hydrated from localStorage).
// martId ALWAYS comes from the logged-in user — never a dropdown.

import { useSelector } from 'react-redux'
import { selectAuth } from '../store/slices/authSlice'

export default function useAuth() {
    const { user, isLoggedIn } = useSelector(selectAuth)

    const role = user?.role || null

    const can = {
        manageProducts:   ['mart_admin', 'manager', 'stock_manager'].includes(role),
        manageInventory:  ['mart_admin', 'manager', 'stock_manager'].includes(role),
        viewOrders:       ['mart_admin', 'manager', 'dispatcher', 'cashier', 'packing_staff', 'support'].includes(role),
        assignDrivers:    ['mart_admin', 'manager', 'dispatcher'].includes(role),
        manageStaff:      role === 'mart_admin',
        viewReports:      ['mart_admin', 'manager', 'accountant'].includes(role),
        accessPOS:        ['mart_admin', 'cashier'].includes(role),
        packOrders:       ['mart_admin', 'manager', 'packing_staff'].includes(role),
        viewFinance:      ['mart_admin', 'accountant'].includes(role),
        supportCustomers: ['mart_admin', 'support'].includes(role),
    }

    return {
        user,
        isLoggedIn,

        // primitives pulled from user (all strings or null)
        staffId:   user?.id          || null,
        martId:    user?.mongoMartId || null,
        role,
        name:      user?.name        || null,
        phone:     user?.phone       || null,
        avatarUrl: user?.avatarUrl   || null,

        // role flags
        isManager:    role === 'manager' || role === 'mart_admin',
        isStaff:      !!role,

        // permission matrix
        can,
    }
}