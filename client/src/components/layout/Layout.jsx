/*
 * ============================================================
 * FILE    : Layout.jsx
 * LAYER   : View (layout wrapper)
 * PURPOSE : Wraps all protected pages with the shared Sidebar.
 *           Pages render inside the right-hand content area.
 *
 * WHY A LAYOUT COMPONENT:
 *   Without Layout, every page component would need to import and
 *   render Sidebar itself. That's duplication — if the sidebar
 *   changes, you'd update every page. Layout centralises the
 *   shell so pages only declare their own content.
 *
 *   This is the standard React pattern for shared chrome
 *   (headers, sidebars, footers) across multiple routes.
 *
 * HOW <Outlet /> WORKS:
 *   React Router's <Outlet /> renders the currently matched
 *   child route inside this component. When the user navigates
 *   to /dashboard, DashboardPage renders in place of <Outlet />.
 *   When they go to /records, RecordsPage renders there instead.
 *   The Sidebar never re-mounts — only the outlet content changes.
 *
 * DEPENDS : react-router-dom (Outlet), Sidebar
 * ============================================================
 * EXPORTS:
 *   - Layout : shared page shell component
 * ============================================================
 */

import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

/*
 * COMPONENT : Layout
 * WHY       : Provides the sidebar + content area shell for all
 *             protected pages without duplicating the sidebar
 *             import in every page component.
 * HOW       : Flex row — sidebar fixed left, content scrollable right.
 *             min-h-screen ensures the sidebar always fills the viewport.
 */
export default function Layout() {
    return (
        /*
         * WHY flex + min-h-screen:
         *   flex puts sidebar and content side-by-side.
         *   min-h-screen ensures the sidebar reaches the bottom even
         *   on pages with little content.
         */
        <div className="flex h-screen overflow-hidden bg-slate-100">
            <Sidebar />
            {/*
             * WHY flex-1 + overflow-y-auto:
             *   flex-1 takes all remaining horizontal space after the
             *   sidebar. overflow-y-auto lets long pages scroll
             *   independently without the sidebar scrolling with them.
             */}
            <main className="flex-1 h-full overflow-y-auto">
                <Outlet />
            </main>
        </div>
    )
}
