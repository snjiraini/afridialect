/**
 * AWS KMS Service
 * Manages per-user asymmetric keys for Hedera account signing
 */

import {
  KMSClient,
  CreateKeyCommand,
  GetPublicKeyCommand,
  SignCommand,
  DescribeKeyCommand,
  CreateAliasCommand,
  ScheduleKeyDeletionCommand,
  type MessageType,
} from '@aws-sdk/client-kms'

// Initialize KMS client
const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export interface CreateKeyResult {
  keyId: string
  arn: string
  publicKeyDer: Uint8Array
}

/**
 * Create a new KMS asymmetric key for a user
 * Uses ECDSA_secp256k1 for Hedera compatibility
 */
export async function createUserKey(userId: string): Promise<CreateKeyResult> {
  try {
    // Create asymmetric key with ECDSA_secp256k1
    const createKeyCommand = new CreateKeyCommand({
      KeyUsage: 'SIGN_VERIFY',
      KeySpec: 'ECC_SECG_P256K1', // secp256k1 for Hedera
      Description: `Hedera user key for user ${userId}`,
      Tags: [
        {
          TagKey: 'Purpose',
          TagValue: 'HederaUserAccount',
        },
        {
          TagKey: 'UserId',
          TagValue: userId,
        },
        {
          TagKey: 'Project',
          TagValue: 'Afridialect',
        },
      ],
    })

    const { KeyMetadata } = await kmsClient.send(createKeyCommand)

    if (!KeyMetadata?.KeyId || !KeyMetadata?.Arn) {
      throw new Error('Failed to create KMS key')
    }

    // Create an alias for easier reference.
    // Use full key ID suffix to guarantee uniqueness across users and retries.
    const alias = `alias/afridialect-user-${KeyMetadata.KeyId.slice(0, 8)}`
    try {
      await kmsClient.send(
        new CreateAliasCommand({
          AliasName: alias,
          TargetKeyId: KeyMetadata.KeyId,
        })
      )
    } catch (err: any) {
      // AlreadyExistsException is expected when the same key is aliased twice;
      // any other error is logged but not fatal — alias is non-critical.
      if (err?.__type !== 'AlreadyExistsException') {
        console.warn(`Could not create alias ${alias}:`, err)
      }
    }

    // Get the public key
    const publicKeyCommand = new GetPublicKeyCommand({
      KeyId: KeyMetadata.KeyId,
    })

    const { PublicKey } = await kmsClient.send(publicKeyCommand)

    if (!PublicKey) {
      throw new Error('Failed to retrieve public key')
    }

    return {
      keyId: KeyMetadata.KeyId,
      arn: KeyMetadata.Arn,
      publicKeyDer: new Uint8Array(PublicKey),
    }
  } catch (error) {
    console.error('Error creating user KMS key:', error)
    throw new Error(`Failed to create KMS key: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the public key for an existing KMS key
 */
export async function getPublicKey(keyId: string): Promise<Uint8Array> {
  try {
    const command = new GetPublicKeyCommand({ KeyId: keyId })
    const response = await kmsClient.send(command)

    if (!response.PublicKey) {
      throw new Error('Public key not found')
    }

    return new Uint8Array(response.PublicKey)
  } catch (error) {
    console.error('Error getting public key:', error)
    throw new Error(`Failed to get public key: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Sign data using KMS key
 * Used for Hedera transaction signing
 */
export async function signWithKMS(
  keyId: string,
  message: Uint8Array,
  messageType: MessageType = 'RAW'
): Promise<Uint8Array> {
  try {
    const command = new SignCommand({
      KeyId: keyId,
      Message: message,
      MessageType: messageType,
      SigningAlgorithm: 'ECDSA_SHA_256',
    })

    const { Signature } = await kmsClient.send(command)

    if (!Signature) {
      throw new Error('Signature not returned')
    }

    return new Uint8Array(Signature)
  } catch (error) {
    console.error('Error signing with KMS:', error)
    throw new Error(`Failed to sign with KMS: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get key metadata
 */
export async function describeKey(keyId: string) {
  try {
    const command = new DescribeKeyCommand({ KeyId: keyId })
    const response = await kmsClient.send(command)
    return response.KeyMetadata
  } catch (error) {
    console.error('Error describing key:', error)
    throw new Error(`Failed to describe key: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Schedule key deletion (for testing/cleanup)
 * WARNING: This is irreversible after the waiting period
 */
export async function scheduleKeyDeletion(
  keyId: string,
  pendingWindowInDays: number = 7
): Promise<void> {
  try {
    await kmsClient.send(
      new ScheduleKeyDeletionCommand({
        KeyId: keyId,
        PendingWindowInDays: pendingWindowInDays,
      })
    )
  } catch (error) {
    console.error('Error scheduling key deletion:', error)
    throw new Error(`Failed to schedule key deletion: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the platform guardian key ID from environment
 * This is the second key in the ThresholdKey (2-of-2)
 */
export function getPlatformGuardianKeyId(): string {
  const keyId = process.env.AWS_KMS_KEY_ID

  if (!keyId) {
    throw new Error('AWS_KMS_KEY_ID not configured in environment')
  }

  return keyId
}
