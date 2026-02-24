/**
 * Create User API Route (Admin Only)
 * POST /api/admin/create-user
 * 
 * Creates a user with any email format (bypasses validation)
 * Uses Supabase Admin API for testing purposes
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Check if requesting user is admin
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
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
    const { email, password, fullName } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format. Must be like: user@domain.com' },
        { status: 400 }
      )
    }

    // Use admin client to create user (bypasses email existence check)
    const adminSupabase = createAdminClient()
    
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName || 'Test User',
      },
    })

    if (error) {
      console.error('Error creating user:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'user_created',
      resource_type: 'user',
      resource_id: data.user.id,
      details: {
        email: email,
        created_by: session.user.id,
        method: 'admin_api',
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
      },
      message: 'User created successfully',
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      {
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
