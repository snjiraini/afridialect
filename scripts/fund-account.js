/**
 * fund-account.js
 *
 * Sends HBAR from the treasury/operator account to any Hedera account.
 * Reads credentials from .env.local automatically.
 *
 * Usage:
 *   node scripts/fund-account.js <recipientAccountId> [amountHbar]
 *
 * Examples:
 *   node scripts/fund-account.js 0.0.8059532 500
 *   node scripts/fund-account.js 0.0.8059532        # defaults to 500 HBAR
 */

'use strict'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })

const { Client, AccountId, PrivateKey, TransferTransaction, Hbar, AccountBalanceQuery } = require('@hashgraph/sdk')

// ── Config ────────────────────────────────────────────────────────────────────

// const NETWORK      = process.env.HEDERA_NETWORK || 'testnet'
// const OPERATOR_ID  = process.env.HEDERA_OPERATOR_ACCOUNT_ID  || process.env.HEDERA_TREASURY_ACCOUNT_ID
// const OPERATOR_KEY = process.env.HEDERA_OPERATOR_PRIVATE_KEY || process.env.HEDERA_TREASURY_PRIVATE_KEY
const NETWORK      = process.env.HEDERA_NETWORK || 'testnet'
const OPERATOR_ID  = '0.0.5726078'
const OPERATOR_KEY = ''

// ── Args ──────────────────────────────────────────────────────────────────────

const [,, recipientArg, amountArg] = process.argv

if (!recipientArg) {
  console.error('Usage: node scripts/fund-account.js <recipientAccountId> [amountHbar]')
  console.error('Example: node scripts/fund-account.js 0.0.8059532 500')
  process.exit(1)
}

const RECIPIENT_ID  = recipientArg
const AMOUNT_HBAR   = parseFloat(amountArg ?? '500')

if (isNaN(AMOUNT_HBAR) || AMOUNT_HBAR <= 0) {
  console.error(`Invalid amount: "${amountArg}". Must be a positive number.`)
  process.exit(1)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!OPERATOR_ID || !OPERATOR_KEY) {
    throw new Error(
      'Missing HEDERA_OPERATOR_ACCOUNT_ID (or HEDERA_TREASURY_ACCOUNT_ID) ' +
      'and HEDERA_OPERATOR_PRIVATE_KEY (or HEDERA_TREASURY_PRIVATE_KEY) in .env.local'
    )
  }

  console.log(`\nHedera Fund Account`)
  console.log(`  Network  : ${NETWORK}`)
  console.log(`  From     : ${OPERATOR_ID}`)
  console.log(`  To       : ${RECIPIENT_ID}`)
  console.log(`  Amount   : ${AMOUNT_HBAR} HBAR`)
  console.log('')

  // Build client
  const client = NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet()
  client.setOperator(
    AccountId.fromString(OPERATOR_ID),
    PrivateKey.fromString(OPERATOR_KEY)
  )

  // Check sender balance before
  const senderBefore = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(OPERATOR_ID))
    .execute(client)
  console.log(`Sender balance (before) : ${senderBefore.hbars.toString()}`)

  // Check recipient balance before
  const recipientBefore = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(RECIPIENT_ID))
    .execute(client)
  console.log(`Recipient balance (before): ${recipientBefore.hbars.toString()}`)

  // Execute transfer
  console.log('\nSubmitting transfer...')
  const transferTx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(OPERATOR_ID), new Hbar(-AMOUNT_HBAR))
    .addHbarTransfer(AccountId.fromString(RECIPIENT_ID), new Hbar(AMOUNT_HBAR))
    .execute(client)

  const receipt = await transferTx.getReceipt(client)
  const txId    = transferTx.transactionId.toString()

  console.log(`\n✅ Transfer SUCCESS`)
  console.log(`  Status      : ${receipt.status.toString()}`)
  console.log(`  Transaction : ${txId}`)

  const network = NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  const hashscanTx = txId.replace('@', '-').replace(/\./g, (m, offset) => offset > 3 ? '-' : '.')
  console.log(`  HashScan    : https://hashscan.io/${network}/transaction/${txId}`)

  // Check recipient balance after
  const recipientAfter = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(RECIPIENT_ID))
    .execute(client)
  console.log(`\nRecipient balance (after) : ${recipientAfter.hbars.toString()}`)

  await client.close()
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message ?? err)
  process.exit(1)
})
