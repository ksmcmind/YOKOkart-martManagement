// src/hooks/useMart.js
// Super admin can select mart from dropdown
// All other roles get martId from their JWT token automatically
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { selectAllMarts } from '../store/slices/martSlice'
import useAuth from './useAuth'

export default function useMart() {
  const { martId: tokenMartId, isSuperAdmin } = useAuth()
  const marts = useSelector(selectAllMarts)
  const [selectedMartId, setSelectedMartId] = useState('')

  // Default to first mart if nothing selected
  const effectiveSelectedId = selectedMartId || (isSuperAdmin && marts[0]?.id) || ''

  // For super admin — selectedMartId is mongo_mart_id from dropdown
  // For others — find their mart by matching tokenMartId against mart id or mongo_mart_id
  const activeMartId = isSuperAdmin
    ? effectiveSelectedId
    : marts.find(m => m.id === tokenMartId)?.id || tokenMartId

  const activeMart = marts.find(m => m.id === activeMartId)

  return {
    activeMartId,
    activeMart,
    marts,
    isSuperAdmin,
    selectedMartId,
    setSelectedMartId,
    selectorProps: isSuperAdmin ? {
      show: true,
      value: effectiveSelectedId,
      onChange: setSelectedMartId,
      marts,
    } : { show: false },
  }
}