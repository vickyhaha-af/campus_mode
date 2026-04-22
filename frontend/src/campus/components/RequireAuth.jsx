/**
 * RequireAuth — route guard for campus pages that need a signed-in PC admin.
 *
 * Rules:
 *   1. If `campus_demo_mode === '1'` in localStorage → pass through (demo
 *      flow must keep working without signup).
 *   2. If `techvista_token` is present → pass through. (Role check is a
 *      stub for MVP — we accept any authenticated user today; tighten later.)
 *   3. Otherwise → redirect to `/campus/login?return=<current-path>` so the
 *      user lands back where they tried to go.
 *
 * Usage:
 *   <Route path="/campus/pc" element={
 *     <RequireAuth><PCDashboard /></RequireAuth>
 *   } />
 */
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function RequireAuth({ children, role = null }) {
  const loc = useLocation()

  // Demo mode bypass — keeps the "Try demo" journey friction-free.
  const isDemo = typeof window !== 'undefined'
    && localStorage.getItem('campus_demo_mode') === '1'
  if (isDemo) return children

  const token = typeof window !== 'undefined'
    ? localStorage.getItem('techvista_token')
    : null

  if (!token) {
    const returnPath = loc.pathname + (loc.search || '')
    return <Navigate to={`/campus/login?return=${encodeURIComponent(returnPath)}`} replace />
  }

  // Role check: intentional no-op for MVP. We don't yet propagate role
  // metadata into localStorage. When we wire role-based guards we'll parse
  // the stored user object or decode the JWT here.
  if (role) {
    // placeholder — accept any authenticated user for now
  }

  return children
}
