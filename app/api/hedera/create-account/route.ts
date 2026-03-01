/**
 * Create Hedera Account API Route
 * POST /api/hedera/create-account
 * 
 * Creates a Hedera account with ThresholdKey (2-of-2) custody for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createHederaAccount } from '@/lib/hedera/account'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()
    const userId = user.id

    // Check if user already has a Hedera account
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('hedera_account_id, kms_key_id')
      .eq('id', userId)
      .single()

    if (existingProfile?.hedera_account_id) {
      return NextResponse.json(
        {
          error: 'Hedera account already exists',
          accountId: existingProfile.hedera_account_id,
        },
        { status: 400 }
      )
    }

    // Create Hedera account with ThresholdKey
    console.log(`Creating Hedera account for user ${userId}...`)
    const result = await createHederaAccount(userId)
    console.log(`Hedera account created: ${result.accountId}`)

    // Update user profile with Hedera account details
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        hedera_account_id: result.accountId,
        kms_key_id: result.kmsKeyId,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      // Account was created but profile update failed
      // Log this for manual recovery
      return NextResponse.json(
        {
          error: 'Account created but profile update failed',
          accountId: result.accountId,
          kmsKeyId: result.kmsKeyId,
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    // Log successful account creation
    await admin.from('audit_logs').insert({
      user_id: userId,
      action: 'hedera_account_created',
      resource_type: 'account',
      resource_id: result.accountId,
      details: {
        accountId: result.accountId,
        kmsKeyId: result.kmsKeyId,
        transactionId: result.transactionId,
      },
    })

    return NextResponse.json(
      {
        success: true,
        accountId: result.accountId,
        evmAddress: result.evmAddress,
        transactionId: result.transactionId,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in create-account API:', error)
    return NextResponse.json(
      {
        error: 'Failed to create Hedera account',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
