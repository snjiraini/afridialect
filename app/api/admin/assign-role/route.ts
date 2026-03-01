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

    // Validate role
    const validRoles = ['uploader', 'transcriber', 'translator', 'reviewer', 'admin', 'buyer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Check if user exists
    const { data: targetUser } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if role already assigned
    const { data: existingRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', role)
      .single()

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role already assigned' },
        { status: 400 }
      )
    }

    // Assign role
    const { error: insertError } = await admin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      })

    if (insertError) throw insertError

    // Log the action
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'role_assigned',
      resource_type: 'user',
      resource_id: userId,
      details: {
        role: role,
        assigned_by: user.id,
      },
    })

    return NextResponse.json(
      { success: true, message: `Role "${role}" assigned successfully` },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error assigning role:', error)
    return NextResponse.json(
      {
        error: 'Failed to assign role',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
