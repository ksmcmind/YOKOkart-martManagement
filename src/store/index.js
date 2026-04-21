// src/store/index.js
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'
import orderReducer from './slices/orderSlice'
import productReducer from './slices/productSlice'
import categoryReducer from './slices/categorySlice'

const store = configureStore({
    reducer: {
        auth: authReducer,
        ui: uiReducer,
        order: orderReducer,
        product: productReducer,
        category: categoryReducer,
    },
})

export default store