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
import { getSecret } from '@/lib/secrets'

/**
 * Get Hedera client configured for the appropriate network
 */
export async function getHederaClient(): Promise<Client> {
  const network = process.env.HEDERA_NETWORK || 'testnet'
  const operatorId = await getSecret('HEDERA_OPERATOR_ACCOUNT_ID').catch(() => undefined)
  const operatorKey = await getSecret('HEDERA_OPERATOR_PRIVATE_KEY').catch(() => undefined)

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
export async function getTreasuryAccountId(): Promise<AccountId> {
  const treasuryId = await getSecret('HEDERA_TREASURY_ACCOUNT_ID').catch(() => undefined)

  if (!treasuryId) {
    throw new Error('HEDERA_TREASURY_ACCOUNT_ID not configured')
  }

  return AccountId.fromString(treasuryId)
}

/**
 * Get treasury private key (resolves from secrets loader)
 */
export async function getTreasuryPrivateKey(): Promise<PrivateKey> {
  const treasuryKey = await getSecret('HEDERA_TREASURY_PRIVATE_KEY').catch(() => undefined)

  if (!treasuryKey) {
    throw new Error('HEDERA_TREASURY_PRIVATE_KEY not configured')
  }

  return PrivateKey.fromString(treasuryKey)
}

/**
 * Get operator account ID
 */
export async function getOperatorAccountId(): Promise<AccountId> {
  const operatorId = await getSecret('HEDERA_OPERATOR_ACCOUNT_ID').catch(() => undefined)

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
