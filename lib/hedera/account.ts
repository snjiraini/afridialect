/**
 * Hedera Account Service
 * Creates and manages Hedera accounts with ThresholdKey (2-of-2) custody
 */

import {
  AccountCreateTransaction,
  PublicKey,
  KeyList,
  Hbar,
  AccountInfoQuery,
  AccountId,
  TransferTransaction,
} from '@hashgraph/sdk'
import { getHederaClient, closeClient } from './client'
import { createUserKey, getPublicKey, getPlatformGuardianKeyId } from '../aws/kms'

export interface CreateAccountResult {
  accountId: string
  kmsKeyId: string
  evmAddress: string
  transactionId: string
}

/**
 * Convert DER-encoded public key to Hedera PublicKey
 */
function derToHederaPublicKey(derBytes: Uint8Array): PublicKey {
  try {
    // Hedera SDK's PublicKey.fromBytes can handle DER format directly
    // This is the most reliable method for secp256k1 keys from AWS KMS
    return PublicKey.fromBytes(derBytes)
  } catch (error) {
    console.error('Error converting DER to Hedera PublicKey:', error)
    console.error('DER bytes (hex):', Buffer.from(derBytes).toString('hex'))
    throw error
  }
}

/**
 * Create a Hedera account with ThresholdKey (2-of-2) custody
 * 
 * ThresholdKey structure:
 * - Threshold: 2 (both keys required)
 * - Key 1: User's KMS key (newly created)
 * - Key 2: Platform Guardian key (from environment)
 */
export async function createHederaAccount(userId: string): Promise<CreateAccountResult> {
  const client = await getHederaClient()

  try {
    // Step 1: Create user's KMS key
    console.log(`Creating KMS key for user ${userId}...`)
    const { keyId: userKmsKeyId, publicKeyDer: userPublicKeyDer } = await createUserKey(userId)
    console.log(`Created user KMS key: ${userKmsKeyId}`)

    // Step 2: Get platform guardian public key
    console.log('Getting platform guardian key...')
    const guardianKmsKeyId = await getPlatformGuardianKeyId()
    const guardianPublicKeyDer = await getPublicKey(guardianKmsKeyId)
    console.log(`Platform guardian key: ${guardianKmsKeyId}`)

    // Step 3: Convert DER keys to Hedera PublicKey format
    const userPublicKey = derToHederaPublicKey(userPublicKeyDer)
    const guardianPublicKey = derToHederaPublicKey(guardianPublicKeyDer)

    // Step 4: Create ThresholdKey (2-of-2)
    const thresholdKey = new KeyList([userPublicKey, guardianPublicKey], 2)
    console.log('Created ThresholdKey (2-of-2)')

    // Step 5: Create Hedera account with ThresholdKey
    // The 1 HBAR initial balance is transferred from the operator account to the
    // new account as part of AccountCreateTransaction.  This single step both
    // creates *and* activates the account on the ledger - no separate activation
    // transfer is needed for newly created accounts.
    console.log('Creating Hedera account (operator funds 1 HBAR for activation)...')
    const accountCreateTx = new AccountCreateTransaction()
      .setKey(thresholdKey)
      .setInitialBalance(new Hbar(1)) // 1 HBAR — activates account on ledger immediately
      .setAccountMemo(`Afridialect user: ${userId}`)
      .setMaxAutomaticTokenAssociations(10) // Allow automatic token associations

    const accountCreateSubmit = await accountCreateTx.execute(client)
    const accountCreateReceipt = await accountCreateSubmit.getReceipt(client)

    const accountId = accountCreateReceipt.accountId
    if (!accountId) {
      throw new Error('Account ID not returned from transaction')
    }

    console.log(`Created Hedera account: ${accountId.toString()}`)

    // Step 6: Get account info to retrieve EVM address
    const accountInfo = await new AccountInfoQuery()
      .setAccountId(accountId)
      .execute(client)

    const evmAddress = accountInfo.contractAccountId || '0x0000000000000000000000000000000000000000'

    return {
      accountId: accountId.toString(),
      kmsKeyId: userKmsKeyId,
      evmAddress,
      transactionId: accountCreateSubmit.transactionId.toString(),
    }
  } catch (error) {
    console.error('Error creating Hedera account:', error)
    throw new Error(`Failed to create Hedera account: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await closeClient(client)
  }
}

/**
 * Get account balance
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  const client = await getHederaClient()

  try {
    const accountInfo = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client)

    return accountInfo.balance.toBigNumber().toNumber()
  } catch (error) {
    console.error('Error getting account balance:', error)
    throw new Error(`Failed to get account balance: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await closeClient(client)
  }
}

/**
 * Get account info
 */
export async function getAccountInfo(accountId: string) {
  const client = await getHederaClient()

  try {
    const accountInfo = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client)

    return {
      accountId: accountInfo.accountId.toString(),
      balance: accountInfo.balance.toString(),
      evmAddress: accountInfo.contractAccountId || '0x',
      key: accountInfo.key.toString(),
      memo: accountInfo.accountMemo,
      autoRenewPeriod: accountInfo.autoRenewPeriod?.seconds.toNumber(),
      expirationTime: accountInfo.expirationTime?.toDate(),
      isDeleted: accountInfo.isDeleted,
    }
  } catch (error) {
    console.error('Error getting account info:', error)
    throw new Error(`Failed to get account info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await closeClient(client)
  }
}

/**
 * Transfer HBAR from operator to account
 * Useful for funding user accounts
 */
export async function fundAccount(
  recipientAccountId: string,
  amount: number
): Promise<string> {
  const client = await getHederaClient()

  try {
    const transferTx = new TransferTransaction()
      .addHbarTransfer(client.operatorAccountId!, new Hbar(-amount))
      .addHbarTransfer(AccountId.fromString(recipientAccountId), new Hbar(amount))

    const transferSubmit = await transferTx.execute(client)
    const transferReceipt = await transferSubmit.getReceipt(client)

    return transferSubmit.transactionId.toString()
  } catch (error) {
    console.error('Error funding account:', error)
    throw new Error(`Failed to fund account: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await closeClient(client)
  }
}

/**
 * Check whether a Hedera account ID exists on the ledger.
 * Returns true if the account is active (found on testnet/mainnet),
 * false if it is missing or has been deleted.
 */
export async function isAccountActivated(accountId: string): Promise<boolean> {
  const client = await getHederaClient()

  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client)

    return !info.isDeleted
  } catch (error) {
    // INVALID_ACCOUNT_ID or ACCOUNT_DELETED both mean the account is not active
    const msg = error instanceof Error ? error.message : String(error)
    if (
      msg.includes('INVALID_ACCOUNT_ID') ||
      msg.includes('ACCOUNT_DELETED') ||
      msg.includes('account does not exist') ||
      msg.includes('5')  // gRPC status 5 = NOT_FOUND
    ) {
      return false
    }
    // Re-throw unexpected errors
    throw error
  } finally {
    await closeClient(client)
  }
}

/**
 * Activate a Hedera account that is stored in the database but not yet
 * present on the ledger by sending the minimum required HBAR from the
 * operator account.
 *
 * On Hedera testnet (and mainnet) an account record is only created on
 * the ledger when it receives its first HBAR transfer.  Accounts that
 * were created via AccountCreateTransaction already receive their initial
 * balance at creation time, so this function is primarily used to
 * activate accounts whose ledger record may have expired or that were
 * registered in the database without a successful on-chain transaction.
 *
 * @param accountId - The Hedera account ID to activate (e.g. "0.0.12345")
 * @param activationHbar - Amount of HBAR to send (default: 1 HBAR)
 * @returns The Hedera transaction ID of the activation transfer
 */
export async function activateHederaAccount(
  accountId: string,
  activationHbar = 1
): Promise<string> {
  const client = await getHederaClient()

  try {
    console.log(`Activating Hedera account ${accountId} with ${activationHbar} HBAR...`)

    const transferTx = new TransferTransaction()
      .addHbarTransfer(client.operatorAccountId!, new Hbar(-activationHbar))
      .addHbarTransfer(AccountId.fromString(accountId), new Hbar(activationHbar))
      .setTransactionMemo(`Afridialect account activation: ${accountId}`)

    const transferSubmit = await transferTx.execute(client)
    await transferSubmit.getReceipt(client) // Confirms SUCCESS status

    const txId = transferSubmit.transactionId.toString()
    console.log(`✅ Account ${accountId} activated. Transaction: ${txId}`)
    return txId
  } catch (error) {
    console.error(`Error activating Hedera account ${accountId}:`, error)
    throw new Error(
      `Failed to activate Hedera account ${accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  } finally {
    await closeClient(client)
  }
}
