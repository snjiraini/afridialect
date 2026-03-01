/**
 * Remove Role API Route
 * POST /api/admin/remove-role
 * Removes a role from a user (admin only)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const admin = createAdminClient()

  // Check if requesting user is admin
  const { data: adminRole } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!adminRole) {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'Missing userId or role' },
        { status: 400 }
      )
    }

    // Prevent removing your own admin role
    if (userId === user.id && role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot remove your own admin role' },
        { status: 400 }
      )
    }

    // Remove role
    const { error: deleteError } = await admin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role)

    if (deleteError) throw deleteError

    // Log the action
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'role_removed',
      resource_type: 'user',
      resource_id: userId,
      details: {
        role: role,
        removed_by: user.id,
      },
    })

    return NextResponse.json(
      { success: true, message: `Role "${role}" removed successfully` },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error removing role:', error)
    return NextResponse.json(
      {
        error: 'Failed to remove role',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
