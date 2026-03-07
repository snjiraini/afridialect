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
import { ec as EC } from 'elliptic'
import { keccak_256 } from '@noble/hashes/sha3'
import { getSecret } from '@/lib/secrets'

const secp256k1 = new EC('secp256k1')

// KMS client is lazily initialised after secrets are resolved.
let _kmsClient: KMSClient | null = null

async function getKmsClient(): Promise<KMSClient> {
  if (_kmsClient) return _kmsClient

  const [region, accessKeyId, secretAccessKey] = await Promise.all([
    getSecret('AWS_REGION').catch(() => 'us-east-1'),
    getSecret('AWS_ACCESS_KEY_ID'),
    getSecret('AWS_SECRET_ACCESS_KEY'),
  ])

  _kmsClient = new KMSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  return _kmsClient
}

// Legacy sync reference retained for backward compat — lazily replaced at runtime.
// All exported functions now call getKmsClient() internally.

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

    const client = await getKmsClient()
    const { KeyMetadata } = await client.send(createKeyCommand)

    if (!KeyMetadata?.KeyId || !KeyMetadata?.Arn) {
      throw new Error('Failed to create KMS key')
    }

    // Create an alias for easier reference.
    // Use full key ID suffix to guarantee uniqueness across users and retries.
    const alias = `alias/afridialect-user-${KeyMetadata.KeyId.slice(0, 8)}`
    try {
      await client.send(
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

    const { PublicKey } = await client.send(publicKeyCommand)

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
    const response = await (await getKmsClient()).send(command)

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

    const { Signature } = await (await getKmsClient()).send(command)

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
 * Extract a Hedera-compatible ECDSA PublicKey from a KMS key.
 *
 * KMS returns a DER-encoded SubjectPublicKeyInfo blob. We must:
 *  1. Strip the fixed 26-byte ASN.1 header for secp256k1 keys to get the
 *     raw 65-byte uncompressed point (04 || x || y).
 *  2. Compress it to 33 bytes using elliptic.
 *  3. Pass the compressed bytes to PublicKey.fromBytesECDSA — NOT fromBytes,
 *     which fails to derive the correct Hedera key from the DER blob.
 *
 * @param keyId  AWS KMS key ID
 * @returns      Hedera SDK PublicKey (ECDSA secp256k1, compressed)
 */
export async function getHederaPublicKeyFromKMS(keyId: string): Promise<import('@hashgraph/sdk').PublicKey> {
  const { PublicKey } = await import('@hashgraph/sdk')

  const response = await (await getKmsClient()).send(new GetPublicKeyCommand({ KeyId: keyId }))
  if (!response.PublicKey) throw new Error(`KMS returned no public key for ${keyId}`)

  // The DER SubjectPublicKeyInfo for secp256k1 has a fixed 26-byte ASN.1 header.
  // After stripping it we get the raw 65-byte uncompressed EC point: 04 || x(32) || y(32)
  const derHex = Buffer.from(response.PublicKey).toString('hex')
  // Known prefix for ECC_SECG_P256K1 SubjectPublicKeyInfo
  const ASN1_PREFIX = '3056301006072a8648ce3d020106052b8104000a034200'
  const rawHex = derHex.replace(ASN1_PREFIX, '')

  // Compress the point using elliptic (03/02 prefix + x only)
  const ecKey = secp256k1.keyFromPublic(rawHex, 'hex')
  const compressedHex = ecKey.getPublic().encodeCompressed('hex')
  const compressedBytes = Buffer.from(compressedHex, 'hex')

  return PublicKey.fromBytesECDSA(compressedBytes)
}

/**
 * Sign a Hedera transaction body with a KMS key, returning the raw 64-byte
 * r‖s signature that the Hedera SDK's `signWith` callback requires.
 *
 * Follows the canonical pattern from the reference implementation:
 *  1. Hash the raw bodyBytes with keccak256 (required for Hedera ECDSA accounts)
 *  2. Send the 32-byte digest to KMS with MessageType:'DIGEST'
 *  3. DER-decode the returned signature using big-endian toArray(32) per component
 *     so leading zeros are correctly preserved in both r and s.
 *
 * @param keyId   AWS KMS key ID
 * @param message Raw transaction body bytes passed by the Hedera SDK signWith callback
 * @returns       64-byte Uint8Array (r‖s) for the Hedera SDK
 */
export async function signForHedera(
  keyId: string,
  message: Uint8Array
): Promise<Uint8Array> {
  // Step 1: keccak256 hash — Hedera ECDSA accounts verify against keccak256(bodyBytes)
  const hash = keccak_256(Buffer.from(message))

  // Step 2: Sign the digest with KMS (MessageType:'DIGEST' = KMS skips its own hashing)
  const { Signature } = await (await getKmsClient()).send(new SignCommand({
    KeyId: keyId,
    Message: hash,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }))

  if (!Signature) throw new Error('KMS returned no signature')

  // Step 3: DER-decode → raw 64-byte r‖s
  // Right-align r and s into 32-byte slots:
  //   - strips DER's leading 0x00 padding byte (added when high bit is set)
  //   - preserves short values by right-aligning into the slot
  const derBuf = Buffer.from(Signature)
  let offset = 0
  if (derBuf[offset++] !== 0x30) throw new Error('Expected DER SEQUENCE')
  if (derBuf[offset] & 0x80) offset += (derBuf[offset] & 0x7f) + 1
  else offset++

  if (derBuf[offset++] !== 0x02) throw new Error('Expected INTEGER tag for r')
  const rLen = derBuf[offset++]
  const rBytes = derBuf.slice(offset, offset + rLen)
  offset += rLen

  if (derBuf[offset++] !== 0x02) throw new Error('Expected INTEGER tag for s')
  const sLen = derBuf[offset++]
  const sBytes = derBuf.slice(offset, offset + sLen)

  const result = new Uint8Array(64)
  const rTrimmed = rBytes.slice(Math.max(0, rBytes.length - 32))
  result.set(rTrimmed, 32 - rTrimmed.length)
  const sTrimmed = sBytes.slice(Math.max(0, sBytes.length - 32))
  result.set(sTrimmed, 64 - sTrimmed.length)

  return result
}

/**
 * Get key metadata
 */
export async function describeKey(keyId: string) {
  try {
    const command = new DescribeKeyCommand({ KeyId: keyId })
    const response = await (await getKmsClient()).send(command)
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
    await (await getKmsClient()).send(
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
 * Get the platform guardian key ID from environment / AWS Secrets Manager
 * This is the second key in the ThresholdKey (2-of-2)
 */
export async function getPlatformGuardianKeyId(): Promise<string> {
  const keyId = await getSecret('AWS_KMS_KEY_ID')

  if (!keyId) {
    throw new Error('AWS_KMS_KEY_ID not configured in environment or AWS Secrets Manager')
  }

  return keyId
}
