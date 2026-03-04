/**
 * GET/PUT /api/admin/payout-structure
 *
 * GET  — Returns the current payout structure for all contributor roles.
 * PUT  — Updates one or more role amounts. Admin only.
 *
 * Body (PUT): { updates: Array<{ role: string; amount_usd: number }> }
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const admin = createAdminClient()
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!roleRow) return null
  return { user, admin }
}

export async function GET() {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await ctx.admin
    .from('payout_structure')
    .select('role, amount_usd, description, updated_at')
    .order('role')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, structure: data })
}

export async function PUT(request: NextRequest) {
  const ctx = await requireAdmin()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    updates: Array<{ role: string; amount_usd: number }>
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: 'updates must be a non-empty array' }, { status: 400 })
  }

  const validRoles = [
    'audio_uploader',
    'audio_qc_reviewer',
    'transcriber',
    'translator',
    'transcript_qc_reviewer',
    'translation_qc_reviewer',
    'platform_markup',
  ]

  for (const u of body.updates) {
    if (!validRoles.includes(u.role)) {
      return NextResponse.json({ error: `Invalid role: ${u.role}` }, { status: 400 })
    }
    if (typeof u.amount_usd !== 'number' || u.amount_usd < 0) {
      return NextResponse.json({ error: `Invalid amount for ${u.role}` }, { status: 400 })
    }
  }

  // Validate total does not drop to zero (must have at least something)
  const { data: current } = await ctx.admin.from('payout_structure').select('role, amount_usd')
  const currentMap = new Map((current ?? []).map((r: { role: string; amount_usd: number }) => [r.role, Number(r.amount_usd)]))
  for (const u of body.updates) currentMap.set(u.role, u.amount_usd)
  const newTotal = Array.from(currentMap.values()).reduce((s, v) => s + v, 0)
  if (newTotal <= 0) {
    return NextResponse.json({ error: 'Total payout must be greater than zero' }, { status: 400 })
  }

  // Apply updates one by one using upsert
  for (const u of body.updates) {
    const { error: upsertErr } = await ctx.admin
      .from('payout_structure')
      .upsert(
        { role: u.role, amount_usd: u.amount_usd, updated_by: ctx.user.id },
        { onConflict: 'role' }
      )
    if (upsertErr) {
      return NextResponse.json({ error: `Failed to update ${u.role}: ${upsertErr.message}` }, { status: 500 })
    }
  }

  // Audit log
  await ctx.admin.from('audit_logs').insert({
    user_id: ctx.user.id,
    action: 'update_payout_structure',
    resource_type: 'payout_structure',
    details: { updates: body.updates, new_total_usd: newTotal },
  })

  // Return updated structure
  const { data: updated } = await ctx.admin
    .from('payout_structure')
    .select('role, amount_usd, description, updated_at')
    .order('role')

  return NextResponse.json({ success: true, structure: updated, totalUSD: newTotal })
}
