/**
 * Hedera Client
 * Manages Hedera Hashgraph network connections
 */

import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
} from '@hashgraph/sdk'

/**
 * Get Hedera client configured for the appropriate network
 */
export function getHederaClient(): Client {
  const network = process.env.HEDERA_NETWORK || 'testnet'
  const operatorId = process.env.HEDERA_OPERATOR_ACCOUNT_ID
  const operatorKey = process.env.HEDERA_OPERATOR_PRIVATE_KEY

  if (!operatorId || !operatorKey) {
    throw new Error(
      'HEDERA_OPERATOR_ACCOUNT_ID and HEDERA_OPERATOR_PRIVATE_KEY must be set'
    )
  }

  let client: Client

  if (network === 'mainnet') {
    client = Client.forMainnet()
  } else {
    client = Client.forTestnet()
  }

  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  )

  // Set default transaction fees
  client.setDefaultMaxTransactionFee(new Hbar(100)) // 100 HBAR
  client.setDefaultMaxQueryPayment(new Hbar(50)) // 50 HBAR

  return client
}

/**
 * Get treasury account ID
 */
export function getTreasuryAccountId(): AccountId {
  const treasuryId = process.env.HEDERA_TREASURY_ACCOUNT_ID

  if (!treasuryId) {
    throw new Error('HEDERA_TREASURY_ACCOUNT_ID not configured')
  }

  return AccountId.fromString(treasuryId)
}

/**
 * Get treasury private key
 */
export function getTreasuryPrivateKey(): PrivateKey {
  const treasuryKey = process.env.HEDERA_TREASURY_PRIVATE_KEY

  if (!treasuryKey) {
    throw new Error('HEDERA_TREASURY_PRIVATE_KEY not configured')
  }

  return PrivateKey.fromString(treasuryKey)
}

/**
 * Get operator account ID
 */
export function getOperatorAccountId(): AccountId {
  const operatorId = process.env.HEDERA_OPERATOR_ACCOUNT_ID

  if (!operatorId) {
    throw new Error('HEDERA_OPERATOR_ACCOUNT_ID not configured')
  }

  return AccountId.fromString(operatorId)
}

/**
 * Close client connection
 */
export async function closeClient(client: Client): Promise<void> {
  await client.close()
}
