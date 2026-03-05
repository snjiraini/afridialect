/**
 * test-batch-tx.js
 *
 * Iterative diagnostic script for the Hedera atomic BatchTransaction.
 *
 * Mimics the purchase flow without touching the database:
 *   - Reads real accounts / KMS keys from .env.local
 *   - Does a simple HBAR transfer inside a BatchTransaction using KMS signing
 *   - Prints detailed diagnostics at every step
 *   - Once this passes, the same approach is used in nft.ts
 *
 * Run: node scripts/test-batch-tx.js
 *
 * STEP PLAN (iterate until SUCCESS):
 *   Step 1 — Verify KMS key derives the same public key that is on-chain
 *   Step 2 — Sign a dummy message and verify the signature locally
 *   Step 3 — Simple non-batched HBAR transfer signed via KMS
 *   Step 4 — BatchTransaction with one HBAR inner tx signed via KMS
 */

'use strict'

require('dotenv').config({ path: '.env.local' })

const {
  Client,
  AccountId,
  PrivateKey,
  PublicKey,
  Hbar,
  TransferTransaction,
  BatchTransaction,
  AccountInfoQuery,
} = require('@hashgraph/sdk')

const {
  KMSClient,
  GetPublicKeyCommand,
  SignCommand,
} = require('@aws-sdk/client-kms')

const { ec: EC } = require('elliptic')
const { keccak_256 } = require('@noble/hashes/sha3')

// ─── Config ────────────────────────────────────────────────────────────────
const OPERATOR_ID  = process.env.HEDERA_OPERATOR_ACCOUNT_ID
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_PRIVATE_KEY
const TREASURY_ID  = process.env.HEDERA_TREASURY_ACCOUNT_ID
const TREASURY_KEY = process.env.HEDERA_TREASURY_PRIVATE_KEY
const GUARDIAN_KMS = process.env.AWS_KMS_KEY_ID
const AWS_REGION   = process.env.AWS_REGION || 'us-east-1'

const secp256k1 = new EC('secp256k1')

const kmsClient = new KMSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClient() {
  const client = Client.forTestnet()
  client.setOperator(
    AccountId.fromString(OPERATOR_ID),
    PrivateKey.fromString(OPERATOR_KEY)
  )
  client.setDefaultMaxTransactionFee(new Hbar(100))
  return client
}

/**
 * Extract Hedera PublicKey from KMS key.
 * Strips the 26-byte ASN.1 SubjectPublicKeyInfo header, compresses the point,
 * then calls PublicKey.fromBytesECDSA().
 */
async function kmsPublicKey(keyId) {
  const resp = await kmsClient.send(new GetPublicKeyCommand({ KeyId: keyId }))
  const derHex = Buffer.from(resp.PublicKey).toString('hex')
  const ASN1_PREFIX = '3056301006072a8648ce3d020106052b8104000a034200'
  const rawHex = derHex.replace(ASN1_PREFIX, '')
  const ecKey = secp256k1.keyFromPublic(rawHex, 'hex')
  const compressedHex = ecKey.getPublic().encodeCompressed('hex')
  return PublicKey.fromBytesECDSA(Buffer.from(compressedHex, 'hex'))
}

/**
 * Sign Hedera transaction body bytes with KMS.
 * Returns raw 64-byte r‖s for the SDK signWith callback.
 */
async function kmsSign(keyId, message) {
  const hash = keccak_256(Buffer.from(message))

  const { Signature } = await kmsClient.send(new SignCommand({
    KeyId:            keyId,
    Message:          hash,
    MessageType:      'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }))

  if (!Signature) throw new Error('KMS returned no signature')

  // DER-decode → raw 64-byte r‖s
  const der = Buffer.from(Signature)
  let off = 0
  if (der[off++] !== 0x30) throw new Error('Expected DER SEQUENCE')
  if (der[off] & 0x80) off += (der[off] & 0x7f) + 1
  else off++

  if (der[off++] !== 0x02) throw new Error('Expected INTEGER tag for r')
  const rLen = der[off++]
  const rBytes = der.slice(off, off + rLen); off += rLen

  if (der[off++] !== 0x02) throw new Error('Expected INTEGER tag for s')
  const sLen = der[off++]
  const sBytes = der.slice(off, off + sLen)

  const result = new Uint8Array(64)
  const rTrimmed = rBytes.slice(Math.max(0, rBytes.length - 32))
  result.set(rTrimmed, 32 - rTrimmed.length)
  const sTrimmed = sBytes.slice(Math.max(0, sBytes.length - 32))
  result.set(sTrimmed, 64 - sTrimmed.length)

  return result
}

// ─── Step 1: Key verification ───────────────────────────────────────────────

async function step1_verifyKeys() {
  console.log('\n══════════════════════════════════════════')
  console.log('STEP 1 — Verify KMS public keys match on-chain keys')
  console.log('══════════════════════════════════════════')

  const client = getClient()

  // Treasury key (Ed25519, from env)
  const treasuryPrivKey = PrivateKey.fromString(TREASURY_KEY)
  console.log('\nTreasury key (from .env.local):')
  console.log('  type:      ', treasuryPrivKey.type)
  console.log('  public hex:', treasuryPrivKey.publicKey.toStringRaw())

  // Query actual on-chain key
  const treasuryInfo = await new AccountInfoQuery()
    .setAccountId(AccountId.fromString(TREASURY_ID))
    .execute(client)
  console.log('\nTreasury account on-chain key:')
  console.log('  key type:', treasuryInfo.key?.constructor?.name)
  console.log('  key raw: ', treasuryInfo.key?.toStringRaw ? treasuryInfo.key.toStringRaw() : treasuryInfo.key?.toString())

  const envMatchesChain = treasuryPrivKey.publicKey.toStringRaw() === treasuryInfo.key?.toStringRaw?.()
  console.log('  ✓ env key matches on-chain key:', envMatchesChain)
  if (!envMatchesChain) {
    console.log('  ✗ KEY MISMATCH — this will cause INVALID_SIGNATURE on any treasury-signed tx')
  }

  // Guardian KMS key
  console.log('\nGuardian KMS key:')
  const guardianPub = await kmsPublicKey(GUARDIAN_KMS)
  console.log('  keyId:     ', GUARDIAN_KMS)
  console.log('  type:      ', guardianPub.type)
  console.log('  public hex:', guardianPub.toStringRaw())

  await client.close()
  return { treasuryPrivKey, guardianPub, envMatchesChain }
}

// ─── Step 2: Non-batched HBAR transfer signed by operator (Ed25519) ─────────

async function step2_simpleTransfer(treasuryPrivKey) {
  console.log('\n══════════════════════════════════════════')
  console.log('STEP 2 — Simple non-batched HBAR self-transfer (treasury Ed25519 key)')
  console.log('══════════════════════════════════════════')

  const client = getClient()
  const treasuryAccId = AccountId.fromString(TREASURY_ID)

  try {
    // Transfer 0.01 HBAR treasury → treasury (self, just to verify key works)
    const tx = await new TransferTransaction()
      .addHbarTransfer(treasuryAccId, new Hbar(-0.01))
      .addHbarTransfer(treasuryAccId, new Hbar(0.01))
      .setTransactionMemo('test-batch-tx step 2')
      .freezeWith(client)

    const signed = await tx.sign(treasuryPrivKey)
    const result = await signed.execute(client)
    const receipt = await result.getReceipt(client)

    console.log('✓ Simple transfer SUCCESS')
    console.log('  tx id:  ', result.transactionId.toString())
    console.log('  status: ', receipt.status.toString())
  } catch (err) {
    console.log('✗ Simple transfer FAILED:', err.message)
  } finally {
    await client.close()
  }
}

// ─── Step 3: BatchTransaction with one HBAR inner tx (operator auto-signs) ──

async function step3_batchWithOperator(treasuryPrivKey) {
  console.log('\n══════════════════════════════════════════')
  console.log('STEP 3 — BatchTransaction: one HBAR inner tx, operator signs via execute()')
  console.log('══════════════════════════════════════════')

  const client = getClient()
  const treasuryAccId = AccountId.fromString(TREASURY_ID)
  const operatorPrivKey = PrivateKey.fromString(OPERATOR_KEY)
  const operatorPubKey  = operatorPrivKey.publicKey

  console.log('  operator public key:', operatorPubKey.toStringRaw())
  console.log('  setBatchKey will use this key')

  try {
    // Inner tx: self-transfer 0.01 HBAR
    const innerTx = new TransferTransaction()
      .addHbarTransfer(treasuryAccId, new Hbar(-0.01))
      .addHbarTransfer(treasuryAccId, new Hbar(0.01))
      .setTransactionMemo('test-batch-tx step 3 inner')
      .setBatchKey(operatorPubKey)           // ← must match who signs the outer batch
      .freezeWith(client)

    // The inner tx is a self-transfer from treasury — needs treasury key
    await innerTx.sign(treasuryPrivKey)

    const batch = new BatchTransaction()
    batch.addInnerTransaction(innerTx)

    // execute() signs the outer BatchTransaction with the operator key automatically
    const batchResult  = await batch.execute(client)
    const batchReceipt = await batchResult.getReceipt(client)

    console.log('✓ BatchTransaction (operator-signed inner) SUCCESS')
    console.log('  batch tx id:', batchResult.transactionId.toString())
    console.log('  status:     ', batchReceipt.status.toString())
  } catch (err) {
    console.log('✗ BatchTransaction FAILED:', err.message)
    console.log('  raw error:', err)
  } finally {
    await client.close()
  }
}

// ─── Step 4: BatchTransaction with KMS-signed inner tx ──────────────────────

async function step4_batchWithKMS(guardianPub) {
  console.log('\n══════════════════════════════════════════')
  console.log('STEP 4 — BatchTransaction: KMS-signed inner HBAR tx')
  console.log('══════════════════════════════════════════')
  console.log('  Simulates the buyer HBAR debit signed via AWS KMS')
  console.log('  Using the guardian KMS key to sign a self-transfer from treasury')
  console.log('  (In production the buyer uses their own KMS key)')

  const client = getClient()
  const treasuryAccId   = AccountId.fromString(TREASURY_ID)
  const operatorPrivKey = PrivateKey.fromString(OPERATOR_KEY)
  const operatorPubKey  = operatorPrivKey.publicKey
  const treasuryPrivKey = PrivateKey.fromString(TREASURY_KEY)

  console.log('\n  Guardian KMS pub key:', guardianPub.toStringRaw())
  console.log('  Operator pub key:    ', operatorPubKey.toStringRaw())

  try {
    // Inner tx: self-transfer 0.01 HBAR — signed by guardian KMS (as stand-in for buyer)
    // AND by treasury Ed25519 (because the sender is the treasury account, whose on-chain
    // key is Ed25519 — in production the sender would be the buyer whose key is KMS)
    const innerTx = new TransferTransaction()
      .addHbarTransfer(treasuryAccId, new Hbar(-0.01))
      .addHbarTransfer(treasuryAccId, new Hbar(0.01))
      .setTransactionMemo('test-batch-tx step 4 KMS inner')
      .setBatchKey(operatorPubKey)
      .freezeWith(client)

    // Sign with the treasury Ed25519 key (required because treasury is the sender)
    await innerTx.sign(treasuryPrivKey)

    // Also sign with guardian KMS (to confirm KMS signing works in a batch context)
    await innerTx.signWith(
      guardianPub,
      async (msg) => kmsSign(GUARDIAN_KMS, msg)
    )

    console.log('\n  Signatures added. Building BatchTransaction...')
    const batch = new BatchTransaction()
    batch.addInnerTransaction(innerTx)

    const batchResult  = await batch.execute(client)
    const batchReceipt = await batchResult.getReceipt(client)

    console.log('\n✓ BatchTransaction (KMS-signed inner) SUCCESS')
    console.log('  batch tx id:', batchResult.transactionId.toString())
    console.log('  status:     ', batchReceipt.status.toString())
  } catch (err) {
    console.log('\n✗ BatchTransaction (KMS-signed) FAILED:', err.message)
    if (err.status) console.log('  Hedera status:', err.status.toString())
    console.log('  raw:', err)
  } finally {
    await client.close()
  }
}

// ─── Step 5: Verify KMS signature is valid for a known message ──────────────

async function step5_verifyKmsSignature(guardianPub) {
  console.log('\n══════════════════════════════════════════')
  console.log('STEP 5 — Verify KMS signature correctness offline')
  console.log('══════════════════════════════════════════')

  const testMsg = Buffer.from('hello hedera batch')
  const hash = keccak_256(testMsg)
  console.log('  test msg:', testMsg.toString())
  console.log('  keccak256:', Buffer.from(hash).toString('hex'))

  const sig64 = await kmsSign(GUARDIAN_KMS, testMsg)
  console.log('  sig (r‖s hex):', Buffer.from(sig64).toString('hex'))

  // Verify locally using elliptic
  const pubHex = guardianPub.toStringRaw()        // 33-byte compressed hex
  const ecKey  = secp256k1.keyFromPublic(pubHex, 'hex')
  const r = sig64.slice(0, 32)
  const s = sig64.slice(32, 64)

  const valid = ecKey.verify(Array.from(hash), {
    r: Buffer.from(r).toString('hex'),
    s: Buffer.from(s).toString('hex'),
  })

  console.log('  ✓ Signature locally valid:', valid)
  if (!valid) {
    console.log('  ✗ SIGNATURE INVALID — signForHedera encoding is wrong')
  }
}

// ─── Step 6: Full purchase simulation — ThresholdKey accounts + NFT burn ────
//
// This exactly mimics executeAtomicPurchaseBatch:
//   Inner Tx 1: NFT return  contributor (ThresholdKey) → treasury
//               Signed by: contributor KMS key + guardian KMS key
//   Inner Tx 2: TokenBurn   treasury burns the returned serial
//               Signed by: treasury Ed25519 supply key
//   Inner Tx 3: HBAR debit  buyer (ThresholdKey) → contributor + platform
//               Signed by: buyer KMS key + guardian KMS key
//   Outer BatchTransaction: operator Ed25519 auto-signs via execute()
//
// Uses real accounts from the DB: contributor=0.0.8025912 (kms 9d7bd097)
// The buyer role is played by the FIRST USER (0.0.8022887, kms 91f86a7b)
// NFT token: 0.0.8059555 (audio clip 894c66d6)

async function step6_fullPurchaseSimulation(guardianPub) {
  const {
    TokenId,
    NftId,
    TokenBurnTransaction,
    TokenAssociateTransaction,
    Long,
  } = require('@hashgraph/sdk')

  console.log('\n══════════════════════════════════════════')
  console.log('STEP 6 — Full Purchase Simulation')
  console.log('  Contributor: 0.0.8025912 (ThresholdKey, KMS 9d7bd097)')
  console.log('  Buyer:       0.0.8022887 (ThresholdKey, KMS 91f86a7b)')
  console.log('  Token:       0.0.8059555 (audio NFT)')
  console.log('══════════════════════════════════════════')

  // ── Config for this test ─────────────────────────────────────────────────
  const CONTRIBUTOR_ACCOUNT = '0.0.8025912'
  const CONTRIBUTOR_KMS     = '9d7bd097-9211-487a-bab0-778c574709ab'
  const BUYER_ACCOUNT       = '0.0.8022887'
  const BUYER_KMS           = '91f86a7b-36c2-4f14-9de0-7e5cafa5a353'
  const TOKEN_ID            = '0.0.8059555'
  // We'll use serial 1 — it should be held by the contributor
  // (If already burned, pick another. Check first.)
  const SERIAL_TO_USE       = 1

  const PLATFORM_ACCOUNT    = TREASURY_ID   // treasury receives 30% platform cut
  const PRICE_HBAR          = 0.5           // 0.5 HBAR test price

  const client = getClient()
  const operatorPrivKey = PrivateKey.fromString(OPERATOR_KEY)
  const operatorPubKey  = operatorPrivKey.publicKey
  const treasuryPrivKey = PrivateKey.fromString(TREASURY_KEY)
  const treasuryAccId   = AccountId.fromString(TREASURY_ID)

  // ── Step 6a: Check NFT ownership ─────────────────────────────────────────
  console.log('\n── Step 6a: Check NFT serial ownership ──')
  let serialToUse = SERIAL_TO_USE

  try {
    const { TokenNftInfoQuery } = require('@hashgraph/sdk')
    const nftInfo = await new TokenNftInfoQuery()
      .setNftId(new NftId(TokenId.fromString(TOKEN_ID), serialToUse))
      .execute(client)
    const ownerStr = nftInfo[0]?.accountId?.toString()
    console.log(`  Serial ${serialToUse} owner:`, ownerStr)

    if (ownerStr !== CONTRIBUTOR_ACCOUNT) {
      console.log(`  ⚠️  Serial ${serialToUse} is not owned by contributor ${CONTRIBUTOR_ACCOUNT}`)
      console.log(`  Owner: ${ownerStr}`)
      if (ownerStr === TREASURY_ID || ownerStr === TREASURY_ACCOUNT) {
        console.log('  → NFT is at treasury (already transferred back or never distributed)')
        console.log('  → Picking a higher serial that may still be with contributor...')
        // Try a few serials to find one owned by contributor
        let found = false
        for (const trySerial of [2, 3, 4, 5, 10, 20, 50]) {
          const info2 = await new TokenNftInfoQuery()
            .setNftId(new NftId(TokenId.fromString(TOKEN_ID), trySerial))
            .execute(client)
          const owner2 = info2[0]?.accountId?.toString()
          console.log(`    Serial ${trySerial} owner: ${owner2}`)
          if (owner2 === CONTRIBUTOR_ACCOUNT) {
            serialToUse = trySerial
            found = true
            console.log(`  ✓ Using serial ${serialToUse} (owned by contributor)`)
            break
          }
        }
        if (!found) {
          console.log('  ✗ No available serial found for contributor — skipping Step 6')
          await client.close()
          return
        }
      }
    } else {
      console.log(`  ✓ Serial ${serialToUse} is owned by contributor — ready to use`)
    }
  } catch (e) {
    console.log('  ⚠️  Could not query NFT info:', e.message)
    console.log('  Proceeding with serial', serialToUse)
  }

  // ── Step 6b: Fund buyer if needed ────────────────────────────────────────
  console.log('\n── Step 6b: Check buyer balance ──')
  try {
    const { AccountBalanceQuery } = require('@hashgraph/sdk')
    const buyerBalance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(BUYER_ACCOUNT))
      .execute(client)
    const hbars = buyerBalance.hbars.toBigNumber().toNumber()
    console.log(`  Buyer balance: ${hbars} HBAR`)
    if (hbars < PRICE_HBAR + 0.5) {
      console.log('  → Topping up buyer with 2 HBAR...')
      const fundTx = await new TransferTransaction()
        .addHbarTransfer(treasuryAccId, new Hbar(-2))
        .addHbarTransfer(AccountId.fromString(BUYER_ACCOUNT), new Hbar(2))
        .setTransactionMemo('test: fund buyer')
        .execute(client)
      await fundTx.getReceipt(client)
      console.log('  ✓ Buyer funded')
    }
  } catch (e) {
    console.log('  ⚠️  Could not check/fund buyer:', e.message)
  }

  // ── Step 6c: Derive KMS public keys ──────────────────────────────────────
  console.log('\n── Step 6c: Derive KMS public keys ──')
  const contributorPub = await kmsPublicKey(CONTRIBUTOR_KMS)
  const buyerPub       = await kmsPublicKey(BUYER_KMS)

  console.log('  Contributor pub (KMS fromBytesECDSA):', contributorPub.toStringRaw())
  console.log('  Buyer pub       (KMS fromBytesECDSA):', buyerPub.toStringRaw())
  console.log('  Guardian pub:                        ', guardianPub.toStringRaw())

  // ── Step 6d: Build the BatchTransaction ──────────────────────────────────
  console.log('\n── Step 6d: Build BatchTransaction ──')

  try {
    const batch = new BatchTransaction()

    // ── Inner Tx 1: NFT return — contributor → treasury ────────────────────
    const nftId = new NftId(TokenId.fromString(TOKEN_ID), serialToUse)
    const returnTx = new TransferTransaction()
      .setMaxTransactionFee(new Hbar(10))
      .setTransactionMemo(`NFT return: …${CONTRIBUTOR_ACCOUNT.slice(-6)} → treasury`)
      .setBatchKey(operatorPubKey)
      .addNftTransfer(nftId, AccountId.fromString(CONTRIBUTOR_ACCOUNT), treasuryAccId)
      .freezeWith(client)

    // Key 1: contributor KMS
    await returnTx.signWith(
      contributorPub,
      async (msg) => kmsSign(CONTRIBUTOR_KMS, msg)
    )
    // Key 2: guardian KMS
    await returnTx.signWith(
      guardianPub,
      async (msg) => kmsSign(GUARDIAN_KMS, msg)
    )
    console.log('  ✓ NFT return tx signed (contributor KMS + guardian KMS)')
    batch.addInnerTransaction(returnTx)

    // ── Inner Tx 2: TokenBurn — burn the returned serial ───────────────────
    const burnTx = new TokenBurnTransaction()
      .setTokenId(TokenId.fromString(TOKEN_ID))
      .setSerials([Long.fromNumber(serialToUse)])
      .setMaxTransactionFee(new Hbar(10))
      .setTransactionMemo(`Burn serial ${serialToUse} of ${TOKEN_ID}`)
      .setBatchKey(operatorPubKey)
      .freezeWith(client)

    await burnTx.sign(treasuryPrivKey)   // supply key = treasury Ed25519
    console.log('  ✓ Burn tx signed (treasury Ed25519 supply key)')
    batch.addInnerTransaction(burnTx)

    // ── Inner Tx 3: HBAR distribution — buyer → contributor + platform ──────
    const totalTinybars    = Math.round(PRICE_HBAR * 100_000_000)
    const contribTinybars  = Math.round(totalTinybars * 0.7)  // 70% to contributor
    const platformTinybars = totalTinybars - contribTinybars   // 30% to platform

    const hbarTx = new TransferTransaction()
      .setMaxTransactionFee(new Hbar(10))
      .setTransactionMemo('test purchase: HBAR distribution')
      .setBatchKey(operatorPubKey)
      .addHbarTransfer(AccountId.fromString(BUYER_ACCOUNT), Hbar.fromTinybars(-totalTinybars))
      .addHbarTransfer(AccountId.fromString(CONTRIBUTOR_ACCOUNT), Hbar.fromTinybars(contribTinybars))
      .addHbarTransfer(treasuryAccId, Hbar.fromTinybars(platformTinybars))
      .freezeWith(client)

    // Key 1: buyer KMS
    await hbarTx.signWith(
      buyerPub,
      async (msg) => kmsSign(BUYER_KMS, msg)
    )
    // Key 2: guardian KMS
    await hbarTx.signWith(
      guardianPub,
      async (msg) => kmsSign(GUARDIAN_KMS, msg)
    )
    console.log(`  ✓ HBAR tx signed (buyer KMS + guardian KMS)`)
    console.log(`    Buyer pays: ${PRICE_HBAR} HBAR`)
    console.log(`    Contributor gets: ${contribTinybars / 100_000_000} HBAR (70%)`)
    console.log(`    Platform gets:    ${platformTinybars / 100_000_000} HBAR (30%)`)
    batch.addInnerTransaction(hbarTx)

    // ── Execute outer BatchTransaction ─────────────────────────────────────
    console.log('\n  Executing BatchTransaction...')
    const batchResult  = await batch.execute(client)
    const batchReceipt = await batchResult.getReceipt(client)

    console.log('\n✓ STEP 6 — Full Purchase Simulation SUCCESS')
    console.log('  batch tx id:', batchResult.transactionId.toString())
    console.log('  status:     ', batchReceipt.status.toString())
    console.log('\n  🎉 The exact signing pattern used in executeAtomicPurchaseBatch WORKS.')
    console.log('  All 3 inner txs committed atomically on-chain.')

  } catch (err) {
    console.log('\n✗ STEP 6 FAILED:', err.message)
    if (err.status) console.log('  Hedera status:', err.status.toString())
    if (err.transactionId) console.log('  tx id:', err.transactionId.toString())
    console.log('  Full error:')
    console.log(err)
  } finally {
    await client.close()
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════')
  console.log('Hedera Atomic BatchTransaction Diagnostic')
  console.log('══════════════════════════════════════════')
  console.log('Operator:  ', OPERATOR_ID)
  console.log('Treasury:  ', TREASURY_ID)
  console.log('Guardian:  ', GUARDIAN_KMS)
  console.log('Network:   ', process.env.HEDERA_NETWORK || 'testnet')

  const { treasuryPrivKey, guardianPub, envMatchesChain } = await step1_verifyKeys()

  if (!envMatchesChain) {
    console.log('\n⚠️  Treasury env key does not match on-chain key. Halting — fix key mismatch first.')
    process.exit(1)
  }

  await step5_verifyKmsSignature(guardianPub)
  await step2_simpleTransfer(treasuryPrivKey)
  await step3_batchWithOperator(treasuryPrivKey)
  await step4_batchWithKMS(guardianPub)
  await step6_fullPurchaseSimulation(guardianPub)

  console.log('\n══════════════════════════════════════════')
  console.log('Diagnostic complete')
  console.log('══════════════════════════════════════════')
}

main().catch((err) => {
  console.error('\n[FATAL]', err)
  process.exit(1)
})
