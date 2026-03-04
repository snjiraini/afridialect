/**
 * Hedera NFT Minting Service
 *
 * Implements the PRD §6 minting rules:
 *  - 5 audio NFTs      → uploader Hedera account
 *  - 5 transcript NFTs → transcriber Hedera account
 *  - 5 translation NFTs→ translator Hedera account
 *
 * Flow per clip:
 *  1. Create HTS NFT token collection (operator as treasury / supply key)
 *  2. Mint 5 serials in batches of 10 (HTS limit per tx)
 *  3. Transfer serials to contributor
 *  4. Return token ID, serial numbers, and transaction IDs
 *
 * NFT Burn (on purchase) — Atomic Batch:
 *  HTS NFTs held by contributor accounts cannot be burned directly.
 *  The correct on-chain flow, wrapped into a single atomic BatchTransaction, is:
 *    Inner Tx 1: TransferTransaction — contributor(s) → treasury for each NFT serial
 *    Inner Tx 2: TokenBurnTransaction × 3 (audio / transcript / translation)
 *    Inner Tx 3: TransferTransaction — buyer → contributors (HBAR revenue distribution)
 *  All inner transactions are frozen, signed independently, then submitted as one
 *  atomic batch via BatchTransaction.execute() — the network commits or reverts all.
 *
 * Note: The operator account (treasury) signs all token operations.
 * Contributor Hedera accounts receive the NFTs via token transfers.
 */

import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenBurnTransaction,
  TransferTransaction,
  TokenAssociateTransaction,
  BatchTransaction,
  AccountId,
  TokenId,
  PrivateKey,
  PublicKey,
  Hbar,
  CustomRoyaltyFee,
  CustomFixedFee,
  NftId,
  Long,
} from '@hashgraph/sdk'
import { getHederaClient, getTreasuryAccountId, getTreasuryPrivateKey } from './client'
import { signForHedera, getHederaPublicKeyFromKMS, getPlatformGuardianKeyId } from '../aws/kms'

export interface MintCollectionResult {
  tokenId: string
  serialNumbers: number[]
  createTransactionId: string
  mintTransactionIds: string[]
  transferTransactionId: string
}

export interface MintSetResult {
  audio: MintCollectionResult
  transcript: MintCollectionResult
  translation: MintCollectionResult
}

/** Maximum NFTs minted per token collection (audio, transcript, translation). */
export const NFT_MAX_SUPPLY = 5

/**
 * Create an HTS NFT token collection for a single clip component (audio | transcript | translation).
 *
 * @param name         Token name (e.g. "Afridialect Audio – Kikuyu")
 * @param symbol       Token symbol (e.g. "AFAUDIO")
 * @param metadataCid  IPFS CID for the token-level metadata URI
 * @param maxSupply    5 per component type (reduced from 300)
 */
async function createTokenCollection(
  name: string,
  symbol: string,
  metadataCid: string,
  maxSupply: number = NFT_MAX_SUPPLY
): Promise<{ tokenId: string; createTransactionId: string }> {
  const client = getHederaClient()
  const treasury = getTreasuryAccountId()
  const treasuryKey = getTreasuryPrivateKey()

  try {
    const tx = new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(maxSupply)
      .setTreasuryAccountId(treasury)
      .setSupplyKey(treasuryKey.publicKey)
      .setAdminKey(treasuryKey.publicKey)
      .setTokenMemo(`Afridialect NFT | ${metadataCid}`)
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client)

    const signedTx = await tx.sign(treasuryKey)
    const submitResult = await signedTx.execute(client)
    const receipt = await submitResult.getReceipt(client)

    if (!receipt.tokenId) {
      throw new Error('Token ID not returned after token creation')
    }

    return {
      tokenId: receipt.tokenId.toString(),
      createTransactionId: submitResult.transactionId.toString(),
    }
  } finally {
    await client.close()
  }
}

/**
 * Mint `count` NFT serials for an existing token, in batches of 10.
 * Each serial receives `metadataCid` as its on-chain metadata URI.
 * Returns all serial numbers minted and the transaction IDs.
 */
async function mintSerials(
  tokenId: string,
  metadataCid: string,
  count: number = NFT_MAX_SUPPLY
): Promise<{ serialNumbers: number[]; mintTransactionIds: string[] }> {
  const client = getHederaClient()
  const treasuryKey = getTreasuryPrivateKey()
  const BATCH_SIZE = 10 // HTS max metadata items per mint tx

  const allSerials: number[] = []
  const txIds: string[] = []

  try {
    for (let i = 0; i < count; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, count - i)
      const metadataList = Array.from({ length: batchCount }, () =>
        Buffer.from(`ipfs://${metadataCid}`)
      )

      const mintTx = new TokenMintTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setMetadata(metadataList)
        .setMaxTransactionFee(new Hbar(20))
        .freezeWith(client)

      const signedMint = await mintTx.sign(treasuryKey)
      const mintResult = await signedMint.execute(client)
      const mintReceipt = await mintResult.getReceipt(client)

      const serials = mintReceipt.serials.map((s) => s.toNumber())
      allSerials.push(...serials)
      txIds.push(mintResult.transactionId.toString())
    }

    return { serialNumbers: allSerials, mintTransactionIds: txIds }
  } finally {
    await client.close()
  }
}

/**
 * Transfer all minted NFT serials from the treasury to the contributor account.
 *
 * Note: The contributor's Hedera account must have the token associated before receiving.
 * We use the operator/treasury to auto-associate if the account has maxAutoTokenAssociations > 0
 * (set to 10 during account creation in Phase 3).
 */
async function transferNftsToContributor(
  tokenId: string,
  serialNumbers: number[],
  contributorAccountId: string
): Promise<string> {
  const client = getHederaClient()
  const treasury = getTreasuryAccountId()
  const treasuryKey = getTreasuryPrivateKey()
  const contributor = AccountId.fromString(contributorAccountId)
  const token = TokenId.fromString(tokenId)

  try {
    // Build a single transfer tx with all serials (batch to avoid tx size limits)
    const BATCH_SIZE = 10
    let lastTxId = ''

    for (let i = 0; i < serialNumbers.length; i += BATCH_SIZE) {
      const batch = serialNumbers.slice(i, i + BATCH_SIZE)

      const transferTx = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(10))

      for (const serial of batch) {
        transferTx.addNftTransfer(
          new NftId(token, serial),
          treasury,
          contributor
        )
      }

      transferTx.freezeWith(client)
      const signedTransfer = await transferTx.sign(treasuryKey)
      const transferResult = await signedTransfer.execute(client)
      await transferResult.getReceipt(client) // confirm success
      lastTxId = transferResult.transactionId.toString()
    }

    return lastTxId
  } finally {
    await client.close()
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Atomic Batch Purchase Types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * One NFT collection held by a single contributor that must be returned to
 * treasury and burned as part of a purchase.
 */
export interface NftBurnSlot {
  /** Hedera token ID of the collection (e.g. "0.0.123456") */
  tokenId: string
  /** Serial number to burn (one per purchase) */
  serial: number
  /** Hedera account currently holding the NFT (uploader / transcriber / translator) */
  contributorAccountId: string
  /** AWS KMS key ID for that contributor's Hedera account */
  contributorKmsKeyId: string
}

/**
 * A single HBAR payout recipient (contributor or platform treasury).
 * Mirrors PayoutRecipient from payment.ts — re-declared here so nft.ts stays
 * self-contained and avoids a circular import.
 */
export interface HbarRecipient {
  hederaAccountId: string
  amountHbar: number
  label: string
}

/** Parameters for the full atomic purchase batch transaction. */
export interface AtomicPurchaseBatchParams {
  /** NFT serials to return to treasury then burn (one per clip × 3 token types) */
  burnSlots: NftBurnSlot[]
  /** HBAR transfers from buyer to contributors + platform */
  hbarRecipients: HbarRecipient[]
  /** Total HBAR debited from buyer (sum of hbarRecipients) */
  totalHbar: number
  /** Hedera account of the buyer */
  buyerHederaAccountId: string
  /** AWS KMS key ID for the buyer's Hedera account */
  buyerKmsKeyId: string
  /** On-chain memo */
  memo?: string
}

export interface AtomicPurchaseBatchResult {
  /** Hedera transaction ID of the outer BatchTransaction */
  batchTransactionId: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Atomic Batch — NFT reclaim + burn + HBAR distribution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Execute the full purchase settlement as a single atomic BatchTransaction.
 *
 * Why BatchTransaction?
 *   HTS NFTs held by contributor accounts cannot be burned directly — they must
 *   first be transferred back to the treasury (which holds the supply key), then
 *   burned. Doing this as separate sequential transactions risks partial failure
 *   (NFTs moved but not burned, or HBAR paid but NFTs not burned). Wrapping
 *   everything in a BatchTransaction guarantees network-level atomicity:
 *   all inner transactions commit or all revert together.
 *
 * Inner transaction order (per clip, repeated for each purchased clip):
 *   Tx 1 … N  : TransferTransaction — contributor(s) → treasury  (one per unique contributor)
 *   Tx N+1 … M: TokenBurnTransaction — treasury burns one serial from each collection
 *   Tx Last   : TransferTransaction — buyer → all HBAR recipients (revenue distribution)
 *
 * Signing requirements:
 *   - Each NFT-return TransferTx: contributor KMS key + guardian KMS key (ThresholdKey 2-of-2)
 *     The treasury also implicitly accepts because it is the receiving account.
 *   - Each TokenBurnTx: treasury supply key (PrivateKey)
 *   - HBAR TransferTx: buyer KMS key + guardian KMS key (buyer's ThresholdKey 2-of-2)
 *   - BatchTransaction outer envelope: operator (treasury / platform operator signs via execute())
 *
 * All inner transactions must have:
 *   1. setBatchKey(operatorPublicKey) called before freezeWith()
 *   2. freezeWith(client)
 *   3. signWith() / sign() for all required keys
 *   Then passed to BatchTransaction.addInnerTransaction().
 *
 * @throws if any inner transaction fails or the batch does not reach consensus SUCCESS
 */
export async function executeAtomicPurchaseBatch(
  params: AtomicPurchaseBatchParams
): Promise<AtomicPurchaseBatchResult> {
  const {
    burnSlots,
    hbarRecipients,
    totalHbar,
    buyerHederaAccountId,
    buyerKmsKeyId,
    memo = 'Afridialect dataset purchase',
  } = params

  if (burnSlots.length === 0 && hbarRecipients.length === 0) {
    throw new Error('executeAtomicPurchaseBatch: nothing to execute')
  }

  const client       = getHederaClient()
  const treasury     = getTreasuryAccountId()
  const treasuryKey  = getTreasuryPrivateKey()

  // The batch key is the operator's public key — every inner tx must declare it.
  // The BatchTransaction itself is signed by the operator when we call execute().
  const operatorPublicKey: PublicKey = treasuryKey.publicKey

  const guardianKmsKeyId    = getPlatformGuardianKeyId()
  const guardianPublicKey   = await getHederaPublicKeyFromKMS(guardianKmsKeyId)

  try {
    const batch = new BatchTransaction()

    // ── Step 1: Build per-contributor NFT return TransferTransactions ────────
    //
    // Group burn slots by contributor so we can combine multiple NFT transfers
    // (audio + transcript + translation for the same contributor) into one tx,
    // reducing the number of inner transactions and required signatures.
    const transfersByContributor = new Map<
      string, // contributorAccountId
      { kmsKeyId: string; nftIds: NftId[] }
    >()

    for (const slot of burnSlots) {
      const existing = transfersByContributor.get(slot.contributorAccountId)
      const nftId = new NftId(TokenId.fromString(slot.tokenId), slot.serial)
      if (existing) {
        existing.nftIds.push(nftId)
      } else {
        transfersByContributor.set(slot.contributorAccountId, {
          kmsKeyId: slot.contributorKmsKeyId,
          nftIds: [nftId],
        })
      }
    }

    for (const [contributorAccountId, { kmsKeyId, nftIds }] of transfersByContributor) {
      const contributor = AccountId.fromString(contributorAccountId)

      const returnTx = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(10))
        .setTransactionMemo(`NFT return: ${contributorAccountId.slice(-6)} → treasury`)
        .setBatchKey(operatorPublicKey)

      for (const nftId of nftIds) {
        returnTx.addNftTransfer(nftId, contributor, treasury)
      }

      returnTx.freezeWith(client)

      // Contributor ThresholdKey (2-of-2): Key 1 = contributor KMS, Key 2 = guardian KMS
      const contributorPublicKey = await getHederaPublicKeyFromKMS(kmsKeyId)
      await returnTx.signWith(contributorPublicKey, async (msg: Uint8Array) =>
        signForHedera(kmsKeyId, msg)
      )
      await returnTx.signWith(guardianPublicKey, async (msg: Uint8Array) =>
        signForHedera(guardianKmsKeyId, msg)
      )

      console.log(
        `[nft/batch] NFT return tx prepared: contributor ${contributorAccountId}, ` +
        `${nftIds.length} NFT(s)`
      )
      batch.addInnerTransaction(returnTx)
    }

    // ── Step 2: TokenBurnTransaction for each unique token ───────────────────
    //
    // Group serials by tokenId so one burn tx handles all serials of the same
    // token (e.g. if multiple clips share a token collection — uncommon but safe).
    const burnsByToken = new Map<string, number[]>()
    for (const slot of burnSlots) {
      const existing = burnsByToken.get(slot.tokenId)
      if (existing) {
        existing.push(slot.serial)
      } else {
        burnsByToken.set(slot.tokenId, [slot.serial])
      }
    }

    for (const [tokenId, serials] of burnsByToken) {
      const burnTx = new TokenBurnTransaction()
        .setTokenId(TokenId.fromString(tokenId))
        .setSerials(serials.map((s) => Long.fromNumber(s)))
        .setMaxTransactionFee(new Hbar(10))
        .setTransactionMemo(`Burn token ${tokenId.slice(-8)} serial(s) ${serials.join(',')}`)
        .setBatchKey(operatorPublicKey)
        .freezeWith(client)

      // Only the supply key (treasury) is needed to burn
      await burnTx.sign(treasuryKey)

      console.log(
        `[nft/batch] Burn tx prepared: token ${tokenId}, ` +
        `serials [${serials.join(', ')}]`
      )
      batch.addInnerTransaction(burnTx)
    }

    // ── Step 3: HBAR revenue distribution TransferTransaction ───────────────
    if (hbarRecipients.length > 0) {
      const buyer = AccountId.fromString(buyerHederaAccountId)

      const hbarTx = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(10))
        .setTransactionMemo(memo)
        .setBatchKey(operatorPublicKey)

      // Debit buyer the full total
      const totalTinybars = String(Math.round(totalHbar * 100_000_000))
      hbarTx.addHbarTransfer(buyer, Hbar.fromTinybars('-' + totalTinybars))

      // Credit each recipient
      for (const r of hbarRecipients) {
        const recipientTinybars = String(Math.round(r.amountHbar * 100_000_000))
        hbarTx.addHbarTransfer(
          AccountId.fromString(r.hederaAccountId),
          Hbar.fromTinybars(recipientTinybars)
        )
      }

      hbarTx.freezeWith(client)

      // Buyer ThresholdKey (2-of-2): Key 1 = buyer KMS, Key 2 = guardian KMS
      const buyerPublicKey = await getHederaPublicKeyFromKMS(buyerKmsKeyId)
      await hbarTx.signWith(buyerPublicKey, async (msg: Uint8Array) =>
        signForHedera(buyerKmsKeyId, msg)
      )
      await hbarTx.signWith(guardianPublicKey, async (msg: Uint8Array) =>
        signForHedera(guardianKmsKeyId, msg)
      )

      console.log(
        `[nft/batch] HBAR distribution tx prepared: ` +
        `${totalHbar.toFixed(8)} HBAR → ${hbarRecipients.length} recipient(s)`
      )
      batch.addInnerTransaction(hbarTx)
    }

    // ── Step 4: Execute the atomic batch ────────────────────────────────────
    // The operator (treasury / platform account) pays the network fee for the
    // outer BatchTransaction. execute() automatically signs with the operator key.
    console.log(
      `[nft/batch] Submitting BatchTransaction with ` +
      `${burnSlots.length} burn slot(s), ` +
      `${hbarRecipients.length > 0 ? 1 : 0} HBAR distribution tx`
    )

    const batchResult = await batch.execute(client)
    const batchReceipt = await batchResult.getReceipt(client)

    const batchTxId = batchResult.transactionId.toString()
    console.log(`[nft/batch] Atomic batch SUCCESS: ${batchTxId}`)

    return { batchTransactionId: batchTxId }

  } catch (error) {
    console.error('[nft/batch] executeAtomicPurchaseBatch failed:', error)
    throw new Error(
      `Atomic purchase batch failed: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    await client.close()
  }
}

/**
 * Mint a full set of 300 NFTs for a single clip component.
 *
 * @param params.type             'audio' | 'transcript' | 'translation'
 * @param params.clipId           UUID of the audio clip
 * @param params.dialectName      Human-readable dialect name
 * @param params.metadataCid      IPFS CID for the JSON metadata
 * @param params.contributorAccountId  Hedera account to receive the NFTs
 */
export async function mintNftSet(params: {
  type: 'audio' | 'transcript' | 'translation'
  clipId: string
  dialectName: string
  metadataCid: string
  contributorAccountId: string
  count?: number
}): Promise<MintCollectionResult> {
  const { type, clipId, dialectName, metadataCid, contributorAccountId, count = NFT_MAX_SUPPLY } = params

  const typeLabel = type === 'audio' ? 'Audio' : type === 'transcript' ? 'Transcript' : 'Translation'
  const symbol = `AF${type.toUpperCase().slice(0, 6)}`
  const name = `Afridialect ${typeLabel} – ${dialectName}`

  console.log(`[nft] Creating ${name} token collection...`)
  const { tokenId, createTransactionId } = await createTokenCollection(
    name,
    symbol,
    metadataCid,
    count
  )
  console.log(`[nft] Token created: ${tokenId}`)

  console.log(`[nft] Minting ${count} serials for ${tokenId}...`)
  const { serialNumbers, mintTransactionIds } = await mintSerials(tokenId, metadataCid, count)
  console.log(`[nft] Minted serials: ${serialNumbers.length}`)

  console.log(`[nft] Transferring to contributor ${contributorAccountId}...`)
  const transferTransactionId = await transferNftsToContributor(
    tokenId,
    serialNumbers,
    contributorAccountId
  )
  console.log(`[nft] Transfer complete: ${transferTransactionId}`)

  return {
    tokenId,
    serialNumbers,
    createTransactionId,
    mintTransactionIds,
    transferTransactionId,
  }
}
