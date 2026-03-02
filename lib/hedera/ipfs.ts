/**
 * IPFS / Pinata Pinning Service
 * Pins audio, transcript, and translation files to IPFS via Pinata.
 * Used as the last step before NFT minting.
 */

export interface PinResult {
  cid: string
  pinSize: number
  timestamp: string
}

export interface NftMetadata {
  name: string
  description: string
  image: string          // ipfs://CID  (audio file CID used as primary asset)
  type: 'audio' | 'transcript' | 'translation'
  attributes: Array<{ trait_type: string; value: string | number }>
}

/**
 * Build Pinata base URL from environment.
 * Falls back gracefully so builds never break when keys are absent.
 */
function getPinataJwt(): string {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    throw new Error('PINATA_JWT is not configured in environment variables')
  }
  return jwt
}

/**
 * Pin a JSON metadata object to IPFS via Pinata.
 * Returns the resulting IPFS CID.
 */
export async function pinJsonToIPFS(
  metadata: NftMetadata,
  name: string
): Promise<PinResult> {
  const jwt = getPinataJwt()

  const body = JSON.stringify({
    pinataMetadata: { name },
    pinataContent: metadata,
  })

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Pinata pinJSONToIPFS failed (${response.status}): ${text}`)
  }

  const data = await response.json()

  return {
    cid: data.IpfsHash as string,
    pinSize: data.PinSize as number,
    timestamp: data.Timestamp as string,
  }
}

/**
 * Pin a file from a Supabase signed URL to IPFS via Pinata's pinByHash-compatible approach.
 * Since we cannot stream from private Supabase buckets server-side easily, we download
 * the bytes first then upload to Pinata via pinFileToIPFS.
 */
export async function pinFileFromUrl(
  signedUrl: string,
  fileName: string,
  mimeType: string
): Promise<PinResult> {
  const jwt = getPinataJwt()

  // Download the file from signed URL
  const fileResponse = await fetch(signedUrl)
  if (!fileResponse.ok) {
    throw new Error(`Failed to download file from Supabase (${fileResponse.status})`)
  }

  const fileBuffer = await fileResponse.arrayBuffer()
  const fileBlob = new Blob([fileBuffer], { type: mimeType })

  // Upload to Pinata
  const formData = new FormData()
  formData.append('file', fileBlob, fileName)
  formData.append(
    'pinataMetadata',
    JSON.stringify({ name: fileName })
  )
  formData.append(
    'pinataOptions',
    JSON.stringify({ cidVersion: 1 })
  )

  const pinResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  })

  if (!pinResponse.ok) {
    const text = await pinResponse.text()
    throw new Error(`Pinata pinFileToIPFS failed (${pinResponse.status}): ${text}`)
  }

  const data = await pinResponse.json()

  return {
    cid: data.IpfsHash as string,
    pinSize: data.PinSize as number,
    timestamp: data.Timestamp as string,
  }
}

/**
 * Verify that a CID is currently pinned on Pinata.
 * Returns true if pinned, false if not found.
 */
export async function verifyPin(cid: string): Promise<boolean> {
  const jwt = getPinataJwt()

  const response = await fetch(
    `https://api.pinata.cloud/pinning/pinJobs?ipfs_pin_hash=${encodeURIComponent(cid)}&status=pinned&limit=1`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Pinata pin verification failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  // pinJobs returns { count, rows }
  if (typeof data.count === 'number') return data.count > 0

  // Fallback: check pinList endpoint
  const listResponse = await fetch(
    `https://api.pinata.cloud/data/pinList?hashContains=${encodeURIComponent(cid)}&status=pinned&pageLimit=1`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
    }
  )

  if (!listResponse.ok) return false

  const listData = await listResponse.json()
  return (listData.count ?? 0) > 0
}

/**
 * Unpin a CID from Pinata (remove from IPFS pinset).
 * Use only after confirming the NFT has been minted on-chain.
 * Note: The content remains on IPFS until all other nodes unpin it.
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  const jwt = getPinataJwt()

  const response = await fetch(
    `https://api.pinata.cloud/pinning/unpin/${encodeURIComponent(cid)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Pinata unpin failed (${response.status}): ${text}`)
  }
}

/**
 * Build a standard NFT metadata object for an Afridialect clip component.
 */
export function buildNftMetadata(params: {
  type: 'audio' | 'transcript' | 'translation'
  clipId: string
  dialectName: string
  dialectCode: string
  durationSeconds: number
  audioCid: string
  transcriptContent?: string
  translationContent?: string
  contributorAccountId: string
}): NftMetadata {
  const { type, clipId, dialectName, dialectCode, durationSeconds, audioCid } = params

  const typeLabel =
    type === 'audio' ? 'Audio' : type === 'transcript' ? 'Transcript' : 'Translation'

  const description =
    type === 'audio'
      ? `Afridialect ${dialectName} audio clip – ${durationSeconds.toFixed(1)}s`
      : type === 'transcript'
      ? `Afridialect verbatim transcript of a ${dialectName} audio clip`
      : `Afridialect English translation of a ${dialectName} audio clip`

  const attributes: NftMetadata['attributes'] = [
    { trait_type: 'Type', value: typeLabel },
    { trait_type: 'Dialect', value: dialectName },
    { trait_type: 'Dialect Code', value: dialectCode },
    { trait_type: 'Duration (s)', value: durationSeconds },
    { trait_type: 'Clip ID', value: clipId },
    { trait_type: 'Contributor Account', value: params.contributorAccountId },
  ]

  return {
    name: `Afridialect ${typeLabel} – ${dialectName}`,
    description,
    image: `ipfs://${audioCid}`,
    type,
    attributes,
  }
}
