'use strict'
/**
 * inspect-batch-sig.js
 * 
 * Inspects the signature pairs inside a BatchTransaction inner tx after KMS signing.
 * Run: node scripts/inspect-batch-sig.js
 */

require('dotenv').config({ path: '.env.local' })

const {
  Client, AccountId, PrivateKey, PublicKey, Hbar,
  TransferTransaction, BatchTransaction, TokenId, NftId, Long,
  TokenBurnTransaction, TokenNftInfoQuery,
} = require('@hashgraph/sdk')

const { KMSClient, GetPublicKeyCommand, SignCommand } = require('@aws-sdk/client-kms')
const { ec: EC } = require('elliptic')
const { keccak_256 } = require('@noble/hashes/sha3')

const secp256k1 = new EC('secp256k1')
const kmsClient = new KMSClient({ region: process.env.AWS_REGION })

const OPERATOR_ID        = process.env.HEDERA_OPERATOR_ACCOUNT_ID
const OPERATOR_KEY       = process.env.HEDERA_OPERATOR_PRIVATE_KEY
const TREASURY_KEY       = process.env.HEDERA_TREASURY_PRIVATE_KEY
const TREASURY_ID        = process.env.HEDERA_TREASURY_ACCOUNT_ID
const GUARDIAN_KMS       = process.env.AWS_KMS_KEY_ID
const CONTRIBUTOR_ACCOUNT = '0.0.8025912'
const CONTRIBUTOR_KMS    = '9d7bd097-9211-487a-bab0-778c574709ab'
const BUYER_ACCOUNT      = '0.0.8022887'
const BUYER_KMS          = '91f86a7b-36c2-4f14-9de0-7e5cafa5a353'
const TOKEN_ID           = '0.0.8059555'

function getClient() {
  const client = Client.forTestnet()
  client.setOperator(AccountId.fromString(OPERATOR_ID), PrivateKey.fromString(OPERATOR_KEY))
  client.setDefaultMaxTransactionFee(new Hbar(100))
  return client
}

async function kmsPublicKey(keyId) {
  const resp = await kmsClient.send(new GetPublicKeyCommand({ KeyId: keyId }))
  const der = Buffer.from(resp.PublicKey)
  const ASN1_PREFIX = '3056301006072a8648ce3d020106052b8104000a034200'
  const rawHex = der.toString('hex').replace(ASN1_PREFIX, '')
  const ecKey = secp256k1.keyFromPublic(rawHex, 'hex')
  const compressed = Buffer.from(ecKey.getPublic().encodeCompressed())
  return PublicKey.fromBytesECDSA(compressed)
}

async function kmsSign(keyId, message) {
  const hash = keccak_256(Buffer.from(message))
  const { Signature } = await kmsClient.send(new SignCommand({
    KeyId: keyId, Message: hash, MessageType: 'DIGEST', SigningAlgorithm: 'ECDSA_SHA_256',
  }))
  const der = Buffer.from(Signature)
  let off = 0
  if (der[off++] !== 0x30) throw new Error('SEQUENCE')
  if (der[off] & 0x80) off += (der[off] & 0x7f) + 1; else off++
  if (der[off++] !== 0x02) throw new Error('INTEGER r')
  const rLen = der[off++]; const rBytes = der.slice(off, off + rLen); off += rLen
  if (der[off++] !== 0x02) throw new Error('INTEGER s')
  const sLen = der[off++]; const sBytes = der.slice(off, off + sLen)
  const result = new Uint8Array(64)
  const rTrimmed = rBytes.slice(Math.max(0, rBytes.length - 32))
  result.set(rTrimmed, 32 - rTrimmed.length)
  const sTrimmed = sBytes.slice(Math.max(0, sBytes.length - 32))
  result.set(sTrimmed, 64 - sTrimmed.length)
  return result
}

function dumpSignedTx(label, tx) {
  const signedTx = tx._signedTransactions.get(0)
  console.log(`\n${label} — SignedTransaction[0]:`)
  console.log('  bodyBytes length:', signedTx.bodyBytes?.length)
  if (signedTx.sigMap?.sigPair) {
    console.log('  sigPairs count:', signedTx.sigMap.sigPair.length)
    signedTx.sigMap.sigPair.forEach((sp, i) => {
      const pubPrefix = Buffer.from(sp.pubKeyPrefix || []).toString('hex')
      const sigType = sp.ed25519 ? 'ED25519' : sp.ECDSASecp256k1 ? 'ECDSA_secp256k1' : 'unknown'
      const sigBytes = sp.ed25519 || sp.ECDSASecp256k1 || []
      console.log(`  sigPair[${i}]: pub=${pubPrefix.slice(0,14)}... type=${sigType} sigLen=${sigBytes.length}`)
    })
  } else {
    console.log('  No sigPairs!')
  }
}

async function main() {
  const client = getClient()
  const operatorPrivKey = PrivateKey.fromString(OPERATOR_KEY)
  const operatorPubKey  = operatorPrivKey.publicKey
  const treasuryPrivKey = PrivateKey.fromString(TREASURY_KEY)
  const treasuryAccId   = AccountId.fromString(TREASURY_ID)
  const contributorAccId = AccountId.fromString(CONTRIBUTOR_ACCOUNT)
  const buyerAccId       = AccountId.fromString(BUYER_ACCOUNT)

  const contributorPub = await kmsPublicKey(CONTRIBUTOR_KMS)
  const guardianPub    = await kmsPublicKey(GUARDIAN_KMS)
  const buyerPub       = await kmsPublicKey(BUYER_KMS)

  console.log('=== Batch Signature Inspection ===')
  console.log('Operator pub (Ed25519):', operatorPubKey.toStringRaw())
  console.log('Contributor pub (ECDSA):', contributorPub.toStringRaw())
  console.log('Guardian pub (ECDSA):', guardianPub.toStringRaw())
  console.log('Buyer pub (ECDSA):', buyerPub.toStringRaw())

  // Find an available serial
  let serial = 2
  for (const s of [2, 3, 4, 5, 10, 20, 50, 100]) {
    try {
      const info = await new TokenNftInfoQuery()
        .setNftId(new NftId(TokenId.fromString(TOKEN_ID), s))
        .execute(client)
      if (info[0]?.accountId?.toString() === CONTRIBUTOR_ACCOUNT) {
        serial = s
        console.log('Using serial:', serial)
        break
      }
    } catch (_) {}
  }

  // ── Build and sign each inner tx ─────────────────────────────────────────

  // 1. NFT return
  const nftId = new NftId(TokenId.fromString(TOKEN_ID), serial)
  const returnTx = new TransferTransaction()
    .setMaxTransactionFee(new Hbar(10))
    .addNftTransfer(nftId, contributorAccId, treasuryAccId)
    .setTransactionMemo('inspect: NFT return')
    .setBatchKey(operatorPubKey)
    .freezeWith(client)
  await returnTx.signWith(contributorPub, async (msg) => kmsSign(CONTRIBUTOR_KMS, msg))
  await returnTx.signWith(guardianPub, async (msg) => kmsSign(GUARDIAN_KMS, msg))
  dumpSignedTx('NFT return', returnTx)

  // 2. TokenBurn
  const burnTx = new TokenBurnTransaction()
    .setTokenId(TokenId.fromString(TOKEN_ID))
    .setSerials([Long.fromNumber(serial)])
    .setMaxTransactionFee(new Hbar(10))
    .setTransactionMemo('inspect: burn')
    .setBatchKey(operatorPubKey)
    .freezeWith(client)
  await burnTx.sign(treasuryPrivKey)
  dumpSignedTx('TokenBurn', burnTx)

  // 3. HBAR tx from buyer
  const totalTinybars   = Math.round(0.5 * 100_000_000)
  const contribTinybars = Math.round(totalTinybars * 0.7)
  const platTinybars    = totalTinybars - contribTinybars
  const hbarTx = new TransferTransaction()
    .setMaxTransactionFee(new Hbar(10))
    .setTransactionMemo('inspect: HBAR')
    .setBatchKey(operatorPubKey)
    .addHbarTransfer(buyerAccId, Hbar.fromTinybars(-totalTinybars))
    .addHbarTransfer(contributorAccId, Hbar.fromTinybars(contribTinybars))
    .addHbarTransfer(treasuryAccId, Hbar.fromTinybars(platTinybars))
    .freezeWith(client)
  await hbarTx.signWith(buyerPub, async (msg) => kmsSign(BUYER_KMS, msg))
  await hbarTx.signWith(guardianPub, async (msg) => kmsSign(GUARDIAN_KMS, msg))
  dumpSignedTx('HBAR debit', hbarTx)

  // ── Now try building the batch and check what bytes it sends ─────────────
  console.log('\n=== Trying to execute the batch ===')
  try {
    const batch = new BatchTransaction()
    batch.addInnerTransaction(returnTx)
    batch.addInnerTransaction(burnTx)
    batch.addInnerTransaction(hbarTx)

    const batchResult  = await batch.execute(client)
    const batchReceipt = await batchResult.getReceipt(client)
    console.log('✓ Batch SUCCESS:', batchResult.transactionId.toString(), batchReceipt.status.toString())
  } catch (err) {
    console.log('✗ Batch FAILED:', err.message)
    if (err.status) console.log('  Hedera status:', err.status.toString())
  }

  // ── Now try JUST the HBAR tx in a batch ──────────────────────────────────
  console.log('\n=== Test: ONLY HBAR tx in batch ===')
  try {
    // Fund buyer first
    const fundTx = await new TransferTransaction()
      .addHbarTransfer(treasuryAccId, new Hbar(-2))
      .addHbarTransfer(buyerAccId, new Hbar(2))
      .execute(client)
    await fundTx.getReceipt(client)
    console.log('Buyer funded')

    const hbarTx2 = new TransferTransaction()
      .setMaxTransactionFee(new Hbar(10))
      .setTransactionMemo('isolated HBAR in batch')
      .setBatchKey(operatorPubKey)
      .addHbarTransfer(buyerAccId, Hbar.fromTinybars(-totalTinybars))
      .addHbarTransfer(contributorAccId, Hbar.fromTinybars(contribTinybars))
      .addHbarTransfer(treasuryAccId, Hbar.fromTinybars(platTinybars))
      .freezeWith(client)
    await hbarTx2.signWith(buyerPub, async (msg) => kmsSign(BUYER_KMS, msg))
    await hbarTx2.signWith(guardianPub, async (msg) => kmsSign(GUARDIAN_KMS, msg))
    dumpSignedTx('HBAR debit (isolated batch)', hbarTx2)

    const batch2 = new BatchTransaction()
    batch2.addInnerTransaction(hbarTx2)
    const r2 = await batch2.execute(client)
    const rec2 = await r2.getReceipt(client)
    console.log('✓ Isolated HBAR batch SUCCESS:', r2.transactionId.toString(), rec2.status.toString())
  } catch (err) {
    console.log('✗ Isolated HBAR batch FAILED:', err.message)
    if (err.status) console.log('  status:', err.status.toString())
  }

  // ── Now try JUST the NFT return in a batch ───────────────────────────────
  console.log('\n=== Test: ONLY NFT return tx in batch ===')
  // Find another available serial
  let serial2 = null
  for (const s of [3, 4, 5, 6, 7, 8, 9, 10, 20, 30]) {
    try {
      const info = await new TokenNftInfoQuery()
        .setNftId(new NftId(TokenId.fromString(TOKEN_ID), s))
        .execute(client)
      if (info[0]?.accountId?.toString() === CONTRIBUTOR_ACCOUNT) {
        serial2 = s
        console.log('Using serial for isolated NFT test:', serial2)
        break
      }
    } catch (_) {}
  }
  if (serial2) {
    try {
      const nftId2 = new NftId(TokenId.fromString(TOKEN_ID), serial2)
      const returnTx2 = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(10))
        .addNftTransfer(nftId2, contributorAccId, treasuryAccId)
        .setTransactionMemo('isolated NFT return in batch')
        .setBatchKey(operatorPubKey)
        .freezeWith(client)
      await returnTx2.signWith(contributorPub, async (msg) => kmsSign(CONTRIBUTOR_KMS, msg))
      await returnTx2.signWith(guardianPub, async (msg) => kmsSign(GUARDIAN_KMS, msg))

      const batch3 = new BatchTransaction()
      batch3.addInnerTransaction(returnTx2)
      const r3 = await batch3.execute(client)
      const rec3 = await r3.getReceipt(client)
      console.log('✓ Isolated NFT return batch SUCCESS:', r3.transactionId.toString(), rec3.status.toString())
    } catch (err) {
      console.log('✗ Isolated NFT return batch FAILED:', err.message)
      if (err.status) console.log('  status:', err.status.toString())
    }
  }

  await client.close()
}

main().catch(console.error)
