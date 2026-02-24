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
  const client = getHederaClient()

  try {
    // Step 1: Create user's KMS key
    console.log(`Creating KMS key for user ${userId}...`)
    const { keyId: userKmsKeyId, publicKeyDer: userPublicKeyDer } = await createUserKey(userId)
    console.log(`Created user KMS key: ${userKmsKeyId}`)

    // Step 2: Get platform guardian public key
    console.log('Getting platform guardian key...')
    const guardianKmsKeyId = getPlatformGuardianKeyId()
    const guardianPublicKeyDer = await getPublicKey(guardianKmsKeyId)
    console.log(`Platform guardian key: ${guardianKmsKeyId}`)

    // Step 3: Convert DER keys to Hedera PublicKey format
    const userPublicKey = derToHederaPublicKey(userPublicKeyDer)
    const guardianPublicKey = derToHederaPublicKey(guardianPublicKeyDer)

    // Step 4: Create ThresholdKey (2-of-2)
    const thresholdKey = new KeyList([userPublicKey, guardianPublicKey], 2)
    console.log('Created ThresholdKey (2-of-2)')

    // Step 5: Create Hedera account with ThresholdKey
    console.log('Creating Hedera account...')
    const accountCreateTx = new AccountCreateTransaction()
      .setKey(thresholdKey)
      .setInitialBalance(new Hbar(1)) // Initial balance: 1 HBAR
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
  const client = getHederaClient()

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
  const client = getHederaClient()

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
  const client = getHederaClient()

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
