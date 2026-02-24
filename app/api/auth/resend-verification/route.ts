/**
 * Resend Verification Email API Route
 * POST /api/auth/resend-verification
 */

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

  // Check if already verified
  if (session.user.email_confirmed_at) {
    return NextResponse.json(
      { error: 'Email already verified' },
      { status: 400 }
    )
  }

  try {
    // Resend confirmation email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: session.user.email!,
    })

    if (error) throw error

    return NextResponse.json(
      { success: true, message: 'Verification email sent' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error resending verification email:', error)
    return NextResponse.json(
      {
        error: 'Failed to resend verification email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
