#!/usr/bin/env node

/**
 * Activate Existing Hedera Accounts
 *
 * Queries all user profiles that have a hedera_account_id stored in the
 * database and checks each account against the Hedera testnet ledger.
 * Any account that does not yet exist on the ledger (never received HBAR)
 * is activated by sending 1 HBAR from the operator account.
 *
 * Usage:
 *   node scripts/activate-hedera-accounts.js
 *
 * Options (env vars):
 *   ACTIVATION_HBAR=1        Amount of HBAR to send per account (default: 1)
 *   DRY_RUN=true             Print what would happen without sending transactions
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  AccountInfoQuery,
  TransferTransaction,
} = require('@hashgraph/sdk')

// ─── Configuration ────────────────────────────────────────────────────────────

const ACTIVATION_HBAR = parseFloat(process.env.ACTIVATION_HBAR || '1')
const DRY_RUN = process.env.DRY_RUN === 'true'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY

const HEDERA_NETWORK = process.env.HEDERA_NETWORK || 'testnet'
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ACCOUNT_ID
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_PRIVATE_KEY

// ─── Validation ───────────────────────────────────────────────────────────────

function validateEnv() {
  const missing = []
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('SUPABASE_SECRET_KEY')
  if (!OPERATOR_ID) missing.push('HEDERA_OPERATOR_ACCOUNT_ID')
  if (!OPERATOR_KEY) missing.push('HEDERA_OPERATOR_PRIVATE_KEY')

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach((v) => console.error(`   - ${v}`))
    console.error('\nPlease ensure all variables are set in .env.local')
    process.exit(1)
  }
}

// ─── Hedera helpers ───────────────────────────────────────────────────────────

function getClient() {
  const client =
    HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet()

  client.setOperator(
    AccountId.fromString(OPERATOR_ID),
    PrivateKey.fromString(OPERATOR_KEY)
  )
  client.setDefaultMaxTransactionFee(new Hbar(10))
  client.setDefaultMaxQueryPayment(new Hbar(5))
  return client
}

/**
 * Returns true if the account exists and is not deleted on the ledger.
 * Returns false if it is missing / not yet activated.
 */
async function isActivated(client, accountId) {
  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client)
    return !info.isDeleted
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Common error strings when an account does not exist on the ledger
    if (
      msg.includes('INVALID_ACCOUNT_ID') ||
      msg.includes('ACCOUNT_DELETED') ||
      msg.includes('account does not exist') ||
      msg.includes('5') // gRPC NOT_FOUND
    ) {
      return false
    }
    throw err // Re-throw unexpected errors
  }
}

/**
 * Send `amount` HBAR from the operator to `accountId` to activate it.
 * Returns the Hedera transaction ID string.
 */
async function activateAccount(client, accountId, amount) {
  const transferTx = new TransferTransaction()
    .addHbarTransfer(client.operatorAccountId, new Hbar(-amount))
    .addHbarTransfer(AccountId.fromString(accountId), new Hbar(amount))
    .setTransactionMemo(`Afridialect account activation: ${accountId}`)

  const submit = await transferTx.execute(client)
  await submit.getReceipt(client) // Ensures SUCCESS status
  return submit.transactionId.toString()
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║     Afridialect – Hedera Account Activation Script    ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`Network : ${HEDERA_NETWORK}`)
  console.log(`Operator: ${OPERATOR_ID}`)
  console.log(`Amount  : ${ACTIVATION_HBAR} HBAR per account`)
  console.log(`Dry run : ${DRY_RUN ? 'YES – no transactions will be sent' : 'NO – live transactions'}`)
  console.log('')

  validateEnv()

  // ── 1. Fetch all profiles with a hedera_account_id ──────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('🔍 Fetching profiles with Hedera accounts from database...')
  const { data: profiles, error: dbError } = await supabase
    .from('profiles')
    .select('id, email, hedera_account_id')
    .not('hedera_account_id', 'is', null)
    .order('created_at', { ascending: true })

  if (dbError) {
    console.error('❌ Failed to fetch profiles:', dbError.message)
    process.exit(1)
  }

  if (!profiles || profiles.length === 0) {
    console.log('ℹ️  No profiles with a Hedera account found. Nothing to do.')
    return
  }

  console.log(`✅ Found ${profiles.length} profile(s) with a Hedera account ID.\n`)

  // ── 2. Check each account on the ledger ─────────────────────────────────────
  const client = getClient()

  const results = {
    alreadyActive: [],
    activated: [],
    failed: [],
    skippedDryRun: [],
  }

  for (let i = 0; i < profiles.length; i++) {
    const { id: userId, email, hedera_account_id: accountId } = profiles[i]
    const prefix = `[${i + 1}/${profiles.length}]`

    process.stdout.write(`${prefix} ${accountId} (${email || userId}) ... `)

    try {
      const active = await isActivated(client, accountId)

      if (active) {
        console.log('✅ already active')
        results.alreadyActive.push(accountId)
        continue
      }

      // Account not on ledger — needs activation
      if (DRY_RUN) {
        console.log(`⏭️  would send ${ACTIVATION_HBAR} HBAR (dry run)`)
        results.skippedDryRun.push(accountId)
        continue
      }

      const txId = await activateAccount(client, accountId, ACTIVATION_HBAR)
      console.log(`🚀 activated — tx: ${txId}`)
      results.activated.push({ accountId, txId })

      // Log the activation in audit_logs
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'hedera_account_activated',
        resource_type: 'account',
        resource_id: accountId,
        details: {
          accountId,
          activationHbar: ACTIVATION_HBAR,
          transactionId: txId,
          activatedBy: 'activate-hedera-accounts script',
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`❌ FAILED — ${msg}`)
      results.failed.push({ accountId, error: msg })
    }
  }

  await client.close()

  // ── 3. Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  Summary')
  console.log('══════════════════════════════════════════════════════')
  console.log(`  Total profiles checked : ${profiles.length}`)
  console.log(`  Already active         : ${results.alreadyActive.length}`)

  if (DRY_RUN) {
    console.log(`  Would activate (dry run): ${results.skippedDryRun.length}`)
  } else {
    console.log(`  Newly activated        : ${results.activated.length}`)
  }

  console.log(`  Failed                 : ${results.failed.length}`)

  if (results.activated.length > 0) {
    console.log('\n  ✅ Activated accounts:')
    results.activated.forEach(({ accountId, txId }) =>
      console.log(`     ${accountId}  →  ${txId}`)
    )
  }

  if (results.skippedDryRun.length > 0) {
    console.log('\n  ⏭️  Would activate (dry run):')
    results.skippedDryRun.forEach((id) => console.log(`     ${id}`))
  }

  if (results.failed.length > 0) {
    console.log('\n  ❌ Failed accounts:')
    results.failed.forEach(({ accountId, error }) =>
      console.log(`     ${accountId}  —  ${error}`)
    )
    process.exit(1)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err)
  process.exit(1)
})
