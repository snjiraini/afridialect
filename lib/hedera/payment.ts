/**
 * Hedera Payment Service — PRD §6.6
 *
 * Executes a single atomic TransferTransaction that distributes HBAR
 * from the buyer's Hedera account to every contributor and the platform
 * treasury in one network transaction.
 *
 * A Hedera TransferTransaction with multiple debits/credits is fully
 * atomic on-chain (all transfers commit or all revert together), making
 * it the idiomatic "smart contract payout" for the Hedera native SDK
 * path required by PRD §6.1 ("Hedera SDKs (not EVM tooling)").
 *
 * Payout breakdown per PRD §6.6.3 ($6.00 per sample):
 *   uploader         — $0.50  (audio)
 *   audio QC reviewer— $1.00  (audio moderation/QC)
 *   transcriber      — $1.00  (transcription)
 *   translator       — $1.00  (translation)
 *   transcript QC    — $1.00  (transcript QC)
 *   translation QC   — $1.00  (translation QC)
 *   platform         — $0.50  (markup, sent to treasury)
 *
 * All amounts are converted to HBAR using the rate supplied at checkout.
 */

import {
  TransferTransaction,
  AccountId,
  Hbar,
} from '@hashgraph/sdk'
import { getHederaClient, closeClient } from './client'
import { signForHedera, getHederaPublicKeyFromKMS, getPlatformGuardianKeyId } from '../aws/kms'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PayoutRecipient {
  /** Hedera account ID of the contributor (e.g. "0.0.12345") */
  hederaAccountId: string
  /** Amount in HBAR (tinybars internally) to send */
  amountHbar: number
  /** Human-readable label for logging */
  label: string
}

export interface PurchasePaymentParams {
  /** Hedera account ID of the buyer (funds debited from here) */
  buyerHederaAccountId: string
  /** AWS KMS key ID that controls the buyer's Hedera account */
  buyerKmsKeyId: string
  /** Total HBAR to debit from buyer (sum of all payouts) */
  totalAmountHbar: number
  /** Individual recipients — contributors + platform treasury */
  recipients: PayoutRecipient[]
  /** Memo stored on-chain for auditability */
  memo?: string
}

export interface PurchasePaymentResult {
  /** Hedera transaction ID (canonical string form) */
  transactionId: string
  /** Consensus timestamp as ISO string (from receipt) */
  consensusTimestamp: string | null
  /** Individual recipient breakdown echoed back */
  recipients: PayoutRecipient[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert a USD amount to HBAR using the supplied rate, rounded to 8 dp.
 */
export function usdToHbar(amountUsd: number, hbarRateUSD: number): number {
  return parseFloat((amountUsd / hbarRateUSD).toFixed(8))
}

/**
 * Convert HBAR to tinybars as a string accepted by Hbar.fromTinybars.
 * 1 HBAR = 100,000,000 tinybars.
 */
function hbarToTinybarString(hbar: number): string {
  return String(Math.round(hbar * 100_000_000))
}

// ──────────────────────────────────────────────────────────────────────────────
// Core payment function
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single atomic HBAR distribution from buyer to all contributors
 * and the platform treasury on Hedera testnet/mainnet.
 *
 * The transaction is:
 *   - Signed by the operator (platform guardian key) acting as payer
 *   - Signed by the buyer's KMS key (buyer authorises the debit)
 *
 * Because the buyer's Hedera account uses a ThresholdKey (2-of-2), both
 * the buyer's KMS key AND the platform guardian KMS key must explicitly sign.
 * The client operator (HEDERA_OPERATOR_PRIVATE_KEY) only pays the network fee
 * and does NOT satisfy Key 2 of the ThresholdKey — so we call signWith() twice,
 * once per KMS key, before submitting via execute().
 *
 * @throws if the transaction fails or consensus status is not SUCCESS
 */
export async function executePurchasePayment(
  params: PurchasePaymentParams
): Promise<PurchasePaymentResult> {
  const {
    buyerHederaAccountId,
    buyerKmsKeyId,
    totalAmountHbar,
    recipients,
    memo = 'Afridialect dataset purchase payout',
  } = params

  if (recipients.length === 0) {
    throw new Error('executePurchasePayment: no recipients provided')
  }

  const client = getHederaClient()

  try {
    const buyerAccount = AccountId.fromString(buyerHederaAccountId)

    // ── Build the multi-transfer transaction ──────────────────────────────
    const transferTx = new TransferTransaction()
      .setTransactionMemo(memo)
      .setMaxTransactionFee(new Hbar(10)) // 10 HBAR ceiling; actual fee is ~$0.0001

    // Debit buyer the full total in one line
    const totalTinybars = hbarToTinybarString(totalAmountHbar)
    transferTx.addHbarTransfer(
      buyerAccount,
      Hbar.fromTinybars('-' + totalTinybars)
    )

    // Credit each recipient
    for (const r of recipients) {
      const recipientTinybars = hbarToTinybarString(r.amountHbar)
      transferTx.addHbarTransfer(
        AccountId.fromString(r.hederaAccountId),
        Hbar.fromTinybars(recipientTinybars)
      )
    }

    // Freeze so we can sign
    transferTx.freezeWith(client)

    // ── Sign with buyer's KMS key ─────────────────────────────────────────
    // The buyer's ThresholdKey (2-of-2) requires BOTH keys to sign:
    //   • Key 1: Buyer's KMS key   — signed here
    //   • Key 2: Platform guardian KMS key — also signed here explicitly
    //
    // IMPORTANT: The client operator (HEDERA_OPERATOR_PRIVATE_KEY) is the
    // fee-payer account, which is NOT the same key as the platform guardian
    // KMS key embedded in the buyer's ThresholdKey. `execute()` only supplies
    // the operator's fee-payer signature — it does NOT satisfy Key 2 of the
    // ThresholdKey. We must sign with the guardian KMS key explicitly.
    const buyerHederaPublicKey    = await getHederaPublicKeyFromKMS(buyerKmsKeyId)

    const guardianKmsKeyId        = getPlatformGuardianKeyId()
    const guardianHederaPublicKey = await getHederaPublicKeyFromKMS(guardianKmsKeyId)

    // Sign with buyer KMS key (Key 1 of ThresholdKey)
    await transferTx.signWith(buyerHederaPublicKey, async (_msg: Uint8Array) => {
      return await signForHedera(buyerKmsKeyId, _msg)
    })

    // Sign with platform guardian KMS key (Key 2 of ThresholdKey)
    await transferTx.signWith(guardianHederaPublicKey, async (_msg: Uint8Array) => {
      return await signForHedera(guardianKmsKeyId, _msg)
    })

    // ── Execute (operator pays the network fee) ───────────────────────────
    const submitResult = await transferTx.execute(client)
    const receipt = await submitResult.getReceipt(client)

    // Receipt status must be SUCCESS (getReceipt throws on failure)
    const txId = submitResult.transactionId.toString()
    console.log(`[payment] Payout transaction SUCCESS: ${txId}`)

    // Consensus timestamp is not directly on receipt; derive from mirror node
    // For testnet we can construct the HashScan URL. Return null for now.
    return {
      transactionId: txId,
      consensusTimestamp: null,
      recipients,
    }
  } catch (error) {
    console.error('[payment] executePurchasePayment failed:', error)
    throw new Error(
      `Hedera payment transaction failed: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    await closeClient(client)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Payout builder helper
// ──────────────────────────────────────────────────────────────────────────────

export interface ClipContributors {
  uploaderHederaAccountId: string | null
  audioQcReviewerHederaAccountId: string | null
  transcriberHederaAccountId: string | null
  translatorHederaAccountId: string | null
  transcriptQcReviewerHederaAccountId: string | null
  translationQcReviewerHederaAccountId: string | null
}

/**
 * Build the recipient list for one clip purchase based on PRD §6.6.3.
 *
 * Missing contributor accounts (null) fall back to the platform treasury
 * so funds are never lost.
 *
 * @param contributors  Hedera account IDs of the clip contributors
 * @param hbarRateUSD   HBAR/USD exchange rate at checkout
 * @param platformTreasuryId  Hedera account to receive platform markup + fallbacks
 */
export function buildClipRecipients(
  contributors: ClipContributors,
  hbarRateUSD: number,
  platformTreasuryId: string
): PayoutRecipient[] {
  const fallback = platformTreasuryId

  const slots: Array<{
    accountId: string | null
    amountUsd: number
    label: string
  }> = [
    { accountId: contributors.uploaderHederaAccountId,              amountUsd: 0.50, label: 'audio uploader' },
    { accountId: contributors.audioQcReviewerHederaAccountId,       amountUsd: 1.00, label: 'audio QC reviewer' },
    { accountId: contributors.transcriberHederaAccountId,           amountUsd: 1.00, label: 'transcriber' },
    { accountId: contributors.translatorHederaAccountId,            amountUsd: 1.00, label: 'translator' },
    { accountId: contributors.transcriptQcReviewerHederaAccountId,  amountUsd: 1.00, label: 'transcript QC reviewer' },
    { accountId: contributors.translationQcReviewerHederaAccountId, amountUsd: 1.00, label: 'translation QC reviewer' },
    { accountId: platformTreasuryId,                                amountUsd: 0.50, label: 'platform markup' },
  ]

  return slots.map((slot) => ({
    hederaAccountId: slot.accountId ?? fallback,
    amountHbar:      usdToHbar(slot.amountUsd, hbarRateUSD),
    label:           slot.label,
  }))
}

/**
 * Aggregate recipients across multiple clips by summing HBAR amounts for
 * the same Hedera account, reducing the number of transfer entries in the
 * transaction (Hedera allows up to ~50 account changes per tx).
 */
export function aggregateRecipients(
  perClipRecipients: PayoutRecipient[][]
): PayoutRecipient[] {
  const map = new Map<string, { amountHbar: number; labels: string[] }>()

  for (const clipRecipients of perClipRecipients) {
    for (const r of clipRecipients) {
      const existing = map.get(r.hederaAccountId)
      if (existing) {
        existing.amountHbar += r.amountHbar
        existing.labels.push(r.label)
      } else {
        map.set(r.hederaAccountId, { amountHbar: r.amountHbar, labels: [r.label] })
      }
    }
  }

  return Array.from(map.entries()).map(([hederaAccountId, { amountHbar, labels }]) => ({
    hederaAccountId,
    amountHbar: parseFloat(amountHbar.toFixed(8)),
    label: labels.join(', '),
  }))
}
