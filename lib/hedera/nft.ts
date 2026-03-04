/**
 * Hedera NFT Minting Service
 *
 * Implements the PRD §6 minting rules:
 *  - 300 audio NFTs      → uploader Hedera account
 *  - 300 transcript NFTs → transcriber Hedera account
 *  - 300 translation NFTs→ translator Hedera account
 *
 * Flow per clip:
 *  1. Create HTS NFT token collection (operator as treasury / supply key)
 *  2. Mint 300 serials in batches of 10 (HTS limit per tx)
 *  3. Transfer serials to contributor
 *  4. Return token ID, serial numbers, and transaction IDs
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

/**
 * Create an HTS NFT token collection for a single clip component (audio | transcript | translation).
 *
 * @param name         Token name (e.g. "Afridialect Audio – Kikuyu")
 * @param symbol       Token symbol (e.g. "AFAUDIO")
 * @param metadataCid  IPFS CID for the token-level metadata URI
 * @param maxSupply    300 for all component types
 */
async function createTokenCollection(
  name: string,
  symbol: string,
  metadataCid: string,
  maxSupply: number = 300
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
  count: number = 300
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

/**
 * Burn a specific set of NFT serials from a token.
 *
 * Per PRD §6: when a buyer purchases a dataset package, one NFT serial is burned
 * from each of the three clip component collections (audio, transcript, translation).
 * This represents the contributor "selling" that serial — the HBAR they receive is
 * the sale proceeds. QC reviewers have no NFT records and are NOT burned here.
 *
 * Only the treasury (supply key holder) can burn. No contributor signature needed.
 *
 * @param tokenId  Hedera token ID (e.g. "0.0.123456")
 * @param serials  Array of serial numbers to burn
 * @returns        Hedera transaction ID of the burn transaction
 */
export async function burnNftSerials(
  tokenId: string,
  serials: number[]
): Promise<string> {
  if (serials.length === 0) throw new Error('burnNftSerials: serials array is empty')

  const client = getHederaClient()
  const treasuryKey = getTreasuryPrivateKey()

  try {
    const burnTx = new TokenBurnTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .setSerials(serials.map((s) => Long.fromNumber(s)))
      .setMaxTransactionFee(new Hbar(10))
      .freezeWith(client)

    const signedBurn = await burnTx.sign(treasuryKey)
    const burnResult = await signedBurn.execute(client)
    await burnResult.getReceipt(client) // confirm success

    console.log(`[nft] Burned serials ${serials.join(',')} from token ${tokenId}: ${burnResult.transactionId}`)
    return burnResult.transactionId.toString()
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
  const { type, clipId, dialectName, metadataCid, contributorAccountId, count = 300 } = params

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
