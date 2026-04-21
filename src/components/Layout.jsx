// src/components/Layout.jsx
import Sidebar from './Sidebar'
import Toast from './Toast'

export default function Layout({ children }) {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <div className="p-6">{children}</div>
            </main>
            <Toast />
        </div>
    )
}