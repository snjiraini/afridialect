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
 * NFT Burn (on purchase) — Sequential Transactions:
 *  HTS NFTs held by contributor accounts cannot be burned directly.
 *  The correct on-chain flow uses three sequential transactions:
 *    Step 1: TransferTransaction — contributor(s) → treasury for each NFT serial
 *    Step 2: TokenBurnTransaction × N (one per token collection)
 *    Step 3: TransferTransaction — buyer → contributors (HBAR revenue distribution)
 *  Note: Hedera BatchTransaction is incompatible with ThresholdKey (KeyList) accounts
 *  on testnet — inner txs from ThresholdKey senders fail precheck with INVALID_SIGNATURE.
 *  Sequential execution is used instead.
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
  AccountId,
  TokenId,
  PrivateKey,
  Hbar,
  CustomRoyaltyFee,
  CustomFixedFee,
  NftId,
  Long,
} from '@hashgraph/sdk'
import { getHederaClient, getTreasuryAccountId, getTreasuryPrivateKey } from './client'
import { signForHedera, getHederaPublicKeyFromKMS, getPlatformGuardianKeyId } from '../aws/kms'

/**
 * Query the Hedera mirror node for the current on-chain owner of an NFT serial.
 * Returns the account ID string (e.g. "0.0.123456") or null on any error.
 */
async function getNftCurrentOwner(tokenId: string, serial: number): Promise<string | null> {
  const network = process.env.HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  const url = `https://${network}.mirrornode.hedera.com/api/v1/tokens/${tokenId}/nfts/${serial}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json() as { account_id?: string }
    return json.account_id ?? null
  } catch {
    return null
  }
}

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
  const client = await getHederaClient()
  const treasury = getTreasuryAccountId()
  const treasuryKey = await getTreasuryPrivateKey()

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
  const client = await getHederaClient()
  const treasuryKey = await getTreasuryPrivateKey()
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
  const client = await getHederaClient()
  const treasury = getTreasuryAccountId()
  const treasuryKey = await getTreasuryPrivateKey()
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
 * Execute the full purchase settlement as sequential Hedera transactions.
 *
 * Why sequential (not BatchTransaction)?
 *   Hedera `BatchTransaction` is incompatible with `KeyList` / `ThresholdKey` accounts
 *   on testnet. When a ThresholdKey account is the sender of an inner transaction,
 *   the network rejects it with `INVALID_SIGNATURE` at precheck — regardless of key
 *   type (confirmed with both KMS secp256k1 keys and plain local Ed25519 keys, so
 *   this is a Hedera protocol restriction, not a signing bug).
 *
 * Sequential execution order:
 *   Step 1 — NFT return:        contributor(s) → treasury  (one tx per contributor)
 *   Step 2 — TokenBurn:         treasury burns returned serials  (one tx per tokenId)
 *   Step 3 — HBAR distribution: buyer → contributors + platform  (one tx)
 *
 * Signing strategy:
 * ┌──────────────────────────────┬───────────────────────────────┬──────────┐
 * │ Transaction                  │ Required signers              │ Method   │
 * ├──────────────────────────────┼───────────────────────────────┼──────────┤
 * │ NFT return (contrib→treas)   │ contributor KMS key (secp256k1│ signWith │
 * │                              │ + guardian KMS key (secp256k1)│ signWith │
 * ├──────────────────────────────┼───────────────────────────────┼──────────┤
 * │ TokenBurnTransaction         │ treasury supply key (Ed25519) │ sign()   │
 * ├──────────────────────────────┼───────────────────────────────┼──────────┤
 * │ HBAR transfer (buyer→recips) │ buyer KMS key (secp256k1)     │ signWith │
 * │                              │ + guardian KMS key (secp256k1)│ signWith │
 * └──────────────────────────────┴───────────────────────────────┴──────────┘
 *
 * The returned `batchTransactionId` holds the HBAR distribution tx ID.
 *
 * @throws if any step fails (e.g. NFTs already returned, insufficient HBAR balance)
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

  const client = await getHederaClient()

  // ── Treasury key (Ed25519, from .env.local) — supply key for token burn ──
  const treasury    = getTreasuryAccountId()
  const treasuryKey = await getTreasuryPrivateKey()

  // ── Guardian KMS key (secp256k1, Key 2 of every user ThresholdKey) ───────
  const guardianKmsKeyId  = await getPlatformGuardianKeyId()
  const guardianPublicKey = await getHederaPublicKeyFromKMS(guardianKmsKeyId)

  try {
    // ── Step 1: NFT return — contributor → treasury (one tx per contributor) ─
    //
    // Each contributor account is a ThresholdKey(2-of-2):
    //   Key 1 = contributor's per-user KMS key  (secp256k1, AWS KMS)
    //   Key 2 = platform guardian KMS key       (secp256k1, AWS KMS)
    // Both must sign the NFT return transfer.
    //
    // Before building the return tx, check the mirror node for the actual
    // on-chain owner of each serial. If treasury already holds it (e.g. from
    // a previous partial purchase attempt), skip the return for that serial —
    // it is already ready to burn.
    //
    // Group by contributor to send all their NFTs in one tx.
    const transfersByContributor = new Map<
      string,
      { kmsKeyId: string; nftIds: NftId[] }
    >()

    const treasuryStr = treasury.toString()

    for (const slot of burnSlots) {
      const currentOwner = await getNftCurrentOwner(slot.tokenId, slot.serial)
      if (currentOwner === treasuryStr) {
        // Already at treasury — no return needed, burn directly in Step 2
        console.log(
          `[nft/purchase] Serial ${slot.serial} of ${slot.tokenId} already at treasury — skipping return`
        )
        continue
      }
      const nftId = new NftId(TokenId.fromString(slot.tokenId), slot.serial)
      const existing = transfersByContributor.get(slot.contributorAccountId)
      if (existing) {
        existing.nftIds.push(nftId)
      } else {
        transfersByContributor.set(slot.contributorAccountId, {
          kmsKeyId: slot.contributorKmsKeyId,
          nftIds:   [nftId],
        })
      }
    }

    for (const [contributorAccountId, { kmsKeyId, nftIds }] of transfersByContributor) {
      const contributor = AccountId.fromString(contributorAccountId)

      const returnTx = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(10))
        .setTransactionMemo(`NFT return: …${contributorAccountId.slice(-6)} → treasury`)

      for (const nftId of nftIds) {
        returnTx.addNftTransfer(nftId, contributor, treasury)
      }

      returnTx.freezeWith(client)

      // Sign with contributor's KMS key (Key 1 of their ThresholdKey)
      const contributorPublicKey = await getHederaPublicKeyFromKMS(kmsKeyId)
      await returnTx.signWith(
        contributorPublicKey,
        async (msg: Uint8Array) => signForHedera(kmsKeyId, msg)
      )

      // Sign with platform guardian KMS key (Key 2 of their ThresholdKey)
      await returnTx.signWith(
        guardianPublicKey,
        async (msg: Uint8Array) => signForHedera(guardianKmsKeyId, msg)
      )

      const returnResult = await returnTx.execute(client)
      await returnResult.getReceipt(client)  // throws on non-SUCCESS

      console.log(
        `[nft/purchase] NFT return OK: contributor ${contributorAccountId}, ` +
        `${nftIds.length} NFT(s) → treasury`
      )
    }

    // ── Step 2: TokenBurn — treasury burns the returned serials ──────────────
    //
    // Only the supply key is required to burn HTS NFTs.
    // The treasury Ed25519 key (from .env.local) is the supply key.
    // Group by tokenId to minimise tx count.
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
        .setTransactionMemo(`Burn …${tokenId.slice(-8)} serial(s) [${serials.join(',')}]`)
        .freezeWith(client)

      // Sign with treasury Ed25519 supply key (from .env.local)
      await burnTx.sign(treasuryKey)

      const burnResult = await burnTx.execute(client)
      await burnResult.getReceipt(client)  // throws on non-SUCCESS

      console.log(
        `[nft/purchase] Burn OK: token ${tokenId}, serials [${serials.join(', ')}]`
      )
    }

    // ── Step 3: HBAR distribution — buyer → contributors + platform ──────────
    //
    // The buyer account is a ThresholdKey(2-of-2):
    //   Key 1 = buyer's per-user KMS key  (secp256k1, AWS KMS)
    //   Key 2 = platform guardian KMS key  (secp256k1, AWS KMS)
    // Both must sign the HBAR debit.
    let settlementTxId = ''

    if (hbarRecipients.length > 0) {
      const buyer = AccountId.fromString(buyerHederaAccountId)

      const hbarTx = new TransferTransaction()
        .setMaxTransactionFee(new Hbar(10))
        .setTransactionMemo(memo)

      // Debit buyer the full amount (integer tinybars to avoid float drift)
      const totalTinybars = Math.round(totalHbar * 100_000_000)
      hbarTx.addHbarTransfer(buyer, Hbar.fromTinybars(-totalTinybars))

      // Credit each recipient
      for (const r of hbarRecipients) {
        const recipientTinybars = Math.round(r.amountHbar * 100_000_000)
        hbarTx.addHbarTransfer(
          AccountId.fromString(r.hederaAccountId),
          Hbar.fromTinybars(recipientTinybars)
        )
      }

      hbarTx.freezeWith(client)

      // Sign with buyer's KMS key (Key 1 of their ThresholdKey)
      const buyerPublicKey = await getHederaPublicKeyFromKMS(buyerKmsKeyId)
      await hbarTx.signWith(
        buyerPublicKey,
        async (msg: Uint8Array) => signForHedera(buyerKmsKeyId, msg)
      )

      // Sign with platform guardian KMS key (Key 2 of their ThresholdKey)
      await hbarTx.signWith(
        guardianPublicKey,
        async (msg: Uint8Array) => signForHedera(guardianKmsKeyId, msg)
      )

      const hbarResult = await hbarTx.execute(client)
      await hbarResult.getReceipt(client)  // throws on non-SUCCESS

      settlementTxId = hbarResult.transactionId.toString()
      console.log(
        `[nft/purchase] HBAR distribution OK: ${totalHbar.toFixed(8)} HBAR ` +
        `from buyer → ${hbarRecipients.length} recipient(s), tx: ${settlementTxId}`
      )
    }

    console.log(
      `[nft/purchase] Purchase settlement complete: ` +
      `${transfersByContributor.size} NFT-return tx(s), ` +
      `${burnsByToken.size} burn tx(s), ` +
      `${hbarRecipients.length > 0 ? 1 : 0} HBAR distribution tx`
    )

    return { batchTransactionId: settlementTxId }

  } catch (error) {
    console.error('[nft/purchase] executeAtomicPurchaseBatch failed:', error)
    throw new Error(
      `Purchase settlement failed: ${error instanceof Error ? error.message : String(error)}`
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
