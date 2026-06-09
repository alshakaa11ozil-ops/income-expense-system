/*
 * ============================================================
 * FILE    : App.jsx
 * LAYER   : View (router root)
 * PURPOSE : Defines all client-side routes.
 *           Public routes (/login, /register) render standalone.
 *           Protected routes render inside <Layout> which provides
 *           the Sidebar. ProtectedRoute redirects to /login if no
 *           valid session exists.
 *
 * WHY Layout wraps protected routes:
 *   The Sidebar should appear on every protected page (Dashboard,
 *   Records, etc.) but NEVER on Login/Register. By wrapping only
 *   protected routes with <Layout>, the Sidebar is automatically
 *   present on all authenticated pages without importing it in
 *   every page component. <Outlet /> inside Layout renders whichever
 *   child route matches — the sidebar never re-mounts.
 *
 * DEPENDS : react-router-dom, pages, Layout, ProtectedRoute
 * ============================================================
 * EXPORTS:
 *   - App : root router component
 * ============================================================
 */

import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RecordsPage from './pages/RecordsPage'
import DashboardPage from './pages/DashboardPage'
import CategoriesPage from './pages/CategoriesPage'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AiAssistantPage from './pages/AiAssistantPage'
import AdminPage from './pages/AdminPage'
/*
 * COMPONENT : App
 * ─────────────────────────────────────────────────────────
 * WHY nested routes under Layout:
 *   React Router v6 nested routes let <Layout> render once and
 *   swap only the <Outlet /> content when the user navigates.
 *   The sidebar stays mounted — no flash, no re-mount cost.
 *
 * Route strategy:
 *   /           → redirect to /dashboard (home page)
 *   /login      → public, no sidebar
 *   /register   → public, no sidebar
 *   /dashboard  → protected, inside Layout (sidebar visible)
 *   /records    → protected, inside Layout (sidebar visible)
 *   *           → redirect to /dashboard (404 fallback)
 * ─────────────────────────────────────────────────────────
 */
function App() {
    return (
        <Routes>
            {/* Root → dashboard now that the real page exists */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* ── Public routes (no sidebar) ──────────────── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/*
             * ── Protected routes (inside Layout = with Sidebar) ──
             *
             * WHY a parent Route with element={<ProtectedRoute><Layout/></ProtectedRoute>}:
             *   ProtectedRoute checks auth before rendering anything.
             *   If not authenticated → redirects to /login.
             *   If authenticated → renders <Layout> which contains <Outlet />.
             *   Child routes render into that <Outlet />.
             *   This way auth check and sidebar are both applied once,
             *   not repeated for every child route.
             */}
            <Route
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/records" element={<RecordsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/ai" element={<AiAssistantPage />} />
                <Route path="/admin" element={<AdminPage />} />

            </Route>

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default App