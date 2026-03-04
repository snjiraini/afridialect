/**
 * GET /api/hedera/balance
 *
 * Returns the HBAR balance of the authenticated buyer's Hedera account.
 * Reads hedera_account_id from the caller's profile row.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { Client, AccountBalanceQuery, AccountId } from '@hashgraph/sdk'

function getHederaClient(): Client {
  const network  = process.env.HEDERA_NETWORK ?? 'testnet'
  const operator = process.env.HEDERA_OPERATOR_ACCOUNT_ID
  const key      = process.env.HEDERA_OPERATOR_PRIVATE_KEY

  if (!operator || !key) throw new Error('HEDERA_OPERATOR_ACCOUNT_ID / HEDERA_OPERATOR_PRIVATE_KEY not set')

  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet()
  client.setOperator(operator, key)
  return client
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('hedera_account_id')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile?.hedera_account_id) {
    return NextResponse.json({ error: 'Hedera account not found for this user' }, { status: 404 })
  }

  const client = getHederaClient()
  try {
    const balance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(profile.hedera_account_id))
      .execute(client)

    // hbars.toString() gives e.g. "520.99999998 ℏ" — parse the numeric part
    const hbarStr = balance.hbars.toString().replace(/[^\d.]/g, '')
    const hbar    = parseFloat(hbarStr)

    return NextResponse.json({ hbar, accountId: profile.hedera_account_id })
  } finally {
    client.close()
  }
}
