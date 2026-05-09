// src/store/index.js
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'
import martReducer from './slices/martSlice'
import staffReducer from './slices/staffSlice'
import categoryReducer from './slices/categorySlice'
import productReducer from './slices/productSlice'
import orderReducer from './slices/orderSlice'
import inventoryReducer from './slices/inventorySlice'
import driverReducer from './slices/driverSlice'

const store = configureStore({
    reducer: {
        auth: authReducer,
        ui: uiReducer,
        mart: martReducer,
        staff: staffReducer,
        category: categoryReducer,
        product: productReducer,
        order: orderReducer,
        inventory: inventoryReducer,
        drivers: driverReducer,
    },
})

export default store