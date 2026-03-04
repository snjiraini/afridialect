/**
 * Common TypeScript type definitions for Afridialect.ai
 */

// ==========================================
// User & Auth Types
// ==========================================

export type UserRole =
  | 'uploader'
  | 'transcriber'
  | 'translator'
  | 'reviewer'
  | 'buyer'
  | 'admin'

export interface User {
  id: string
  email: string
  roles: UserRole[]
  hederaAccountId: string | null
  createdAt: string
  updatedAt: string
}

// ==========================================
// Audio Types
// ==========================================

export type AudioStatus =
  | 'uploaded'
  | 'audio_qc'
  | 'audio_rejected'
  | 'transcription_ready'
  | 'transcription_in_progress'
  | 'transcript_qc'
  | 'transcript_rejected'
  | 'translation_ready'
  | 'translation_in_progress'
  | 'translation_qc'
  | 'translation_rejected'
  | 'mint_ready'
  | 'ipfs_pinned'
  | 'minted'
  | 'sellable'

export interface AudioClip {
  id: string
  uploaderId: string
  dialectId: string
  status: AudioStatus
  audioUrl: string | null
  audioCid: string | null
  durationSeconds: number
  sampleRate: number
  speakerCount: number
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

// ==========================================
// Dialect Types
// ==========================================

export interface Dialect {
  id: string
  name: string
  code: string
  countryCode: string
  enabled: boolean
}

// ==========================================
// Task Types
// ==========================================

export type TaskType = 'audio_qc' | 'transcription' | 'transcript_qc' | 'translation' | 'translation_qc'

export interface Task {
  id: string
  audioClipId: string
  taskType: TaskType
  status: 'available' | 'claimed' | 'submitted' | 'approved' | 'rejected'
  claimedBy: string | null
  claimedAt: string | null
  submittedAt: string | null
  expiresAt: string | null
}

// ==========================================
// Transcription & Translation Types
// ==========================================

export interface Transcription {
  id: string
  audioClipId: string
  transcriberId: string
  content: string
  speakerCount: number
  speakerTurns: number
  tags: string[]
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface Translation {
  id: string
  audioClipId: string
  translatorId: string
  content: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}

// ==========================================
// QC Review Types
// ==========================================

export type ReviewDecision = 'approve' | 'reject'

export interface QCReview {
  id: string
  audioClipId: string
  reviewerId: string
  reviewType: TaskType
  decision: ReviewDecision
  reasons: string[]
  notes: string | null
  createdAt: string
}

// ==========================================
// NFT Types
// ==========================================

export type NFTType = 'audio' | 'transcript' | 'translation'

export interface NFTRecord {
  id: string
  audioClipId: string
  nftType: NFTType
  tokenId: string
  serialNumbers: number[]
  contributorId: string
  ipfsCid: string
  metadata: Record<string, any>
  mintedAt: string
}

export interface NFTBurn {
  id: string
  nftRecordId: string
  serialNumber: number
  purchaseId: string
  burnedAt: string
  transactionId: string | null
}

export interface MintRequest {
  clipId: string
}

export interface MintResponse {
  success: boolean
  clipId?: string
  audioCid?: string
  audioToken?: {
    tokenId: string
    serialNumbers: number[]
    metadataCid: string
  }
  transcriptToken?: {
    tokenId: string
    serialNumbers: number[]
    metadataCid: string
  }
  translationToken?: {
    tokenId: string
    serialNumbers: number[]
    metadataCid: string
  }
  warning?: string
  error?: string
}

// ==========================================
// IPFS / Phase 8 Types
// ==========================================

export type IPFSPinNftType =
  | 'audio'
  | 'transcript'
  | 'translation'
  | 'metadata_audio'
  | 'metadata_transcript'
  | 'metadata_translation'

export interface IPFSPinLog {
  id: string
  audioClipId: string
  nftType: IPFSPinNftType
  cid: string
  pinSizeBytes: number | null
  pinnedAt: string
  lastVerifiedAt: string | null
  verifiedPinned: boolean | null
  unpinnedAt: string | null
  createdAt: string
}

export interface IPFSVerifyResult {
  nftType: string
  cid: string
  pinned: boolean
  error?: string
}

export interface IPFSVerifyResponse {
  success: boolean
  clipId: string
  allPinned: boolean
  results: IPFSVerifyResult[]
}

export interface IPFSCleanupResponse {
  success: boolean
  clipId: string
  removedPath: string
}

// ==========================================
// Marketplace Types
// ==========================================

export interface DatasetFilter {
  dialects?: string[]       // dialect codes e.g. ['kikuyu', 'swahili']
  minDuration?: number      // seconds
  maxDuration?: number      // seconds
  speakerGender?: string[]  // 'male' | 'female' | 'mixed' | 'unknown'
  speakerAge?: string[]     // 'child' | 'teen' | 'adult' | 'senior' | 'mixed'
  speakerCount?: number     // exact speaker count filter
}

/** PRD §6.6.3 updated: $6.00 per sample bundle (includes audio QC reviewer at $1.00) */
export const PRICE_PER_SAMPLE_USD = 6.00

/** A sellable clip returned by the browse API */
export interface MarketplaceClip {
  id: string
  dialectName: string
  dialectCode: string
  durationSeconds: number
  speakerCount: number
  speakerGender: string
  speakerAge: string
  audioNftTokenId: string | null
  createdAt: string
}

export interface MarketplaceBrowseResponse {
  clips: MarketplaceClip[]
  total: number
}

export interface PurchaseRequest {
  clipIds: string[]         // buyer-selected clip IDs
  filters: DatasetFilter    // filters used (stored for audit)
  hbarRateUSD: number       // HBAR/USD rate at checkout (buyer-supplied, server validates)
}

export interface PurchaseResponse {
  success: boolean
  purchaseId?: string
  sampleCount?: number
  priceUSD?: number
  priceHBAR?: number
  hbarRate?: number
  /** True when the purchase record is created but on-chain payment is still pending */
  paymentRequired?: boolean
  error?: string
}

export interface DatasetPurchase {
  id: string
  buyerId: string
  filterCriteria: DatasetFilter
  sampleCount: number
  priceUsd: number
  priceHbar: number
  hbarRate: number
  audioClipIds: string[]
  paymentTransactionId: string | null
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
  exportUrl: string | null
  exportExpiresAt: string | null
  downloadedAt: string | null
  createdAt: string
  completedAt: string | null
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
