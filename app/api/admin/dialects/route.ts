/**
 * POST /api/admin/dialects — Add a new dialect
 * PATCH /api/admin/dialects — Toggle enabled/disabled
 * Admin role required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleRow) return { user, admin: null, error: 'Forbidden' }
  return { user, admin, error: null }
}

/** Add a new dialect */
export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  let body: { name?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = body.name?.trim()
  const code = body.code?.trim().toLowerCase()

  if (!name || !code) {
    return NextResponse.json({ error: 'name and code are required' }, { status: 400 })
  }
  if (!/^[a-z_]+$/.test(code)) {
    return NextResponse.json(
      { error: 'code must only contain lowercase letters and underscores' },
      { status: 400 },
    )
  }

  const { data, error: dbError } = await admin
    .from('dialects')
    .insert({ name, code, enabled: true })
    .select()
    .single()

  if (dbError) {
    if (dbError.code === '23505') {
      return NextResponse.json({ error: 'A dialect with this code already exists' }, { status: 409 })
    }
    console.error('[api/admin/dialects POST]', dbError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dialect: data })
}

/** Toggle dialect enabled/disabled */
export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  let body: { id?: string; enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'id and enabled are required' }, { status: 400 })
  }

  const { data, error: dbError } = await admin
    .from('dialects')
    .update({ enabled: body.enabled })
    .eq('id', body.id)
    .select()
    .single()

  if (dbError) {
    console.error('[api/admin/dialects PATCH]', dbError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, dialect: data })
}
