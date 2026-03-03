/**
 * GET  /api/admin/pricing  — Fetch current HBAR/USD rate from system_config
 * POST /api/admin/pricing  — Update HBAR/USD rate (admin only)
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

export async function GET() {
  const { admin, error } = await requireAdmin()
  if (error || !admin) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  const { data } = await admin
    .from('system_config')
    .select('key, value, updated_at')

  const config: Record<string, string> = {}
  for (const row of data ?? []) {
    config[row.key] = row.value
  }

  return NextResponse.json({ success: true, config })
}

export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) {
    return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  }

  let body: { hbar_price_usd?: string | number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rate = parseFloat(String(body.hbar_price_usd ?? ''))
  if (!body.hbar_price_usd || isNaN(rate) || rate <= 0 || rate > 100) {
    return NextResponse.json(
      { error: 'hbar_price_usd must be a positive number ≤ 100' },
      { status: 400 },
    )
  }

  const { error: dbError } = await admin
    .from('system_config')
    .upsert(
      { key: 'hbar_price_usd', value: rate.toString(), updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )

  if (dbError) {
    console.error('[api/admin/pricing POST]', dbError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, hbar_price_usd: rate })
}
