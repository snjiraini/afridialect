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
  dialects?: string[]
  minDuration?: number
  maxDuration?: number
  speakerGender?: string[]
  speakerAge?: string[]
  tags?: string[]
}

export interface DatasetPurchase {
  id: string
  buyerId: string
  filterCriteria: DatasetFilter
  sampleCount: number
  totalPriceHBAR: string
  totalPriceUSD: string
  hbarRate: string
  transactionId: string
  downloadUrl: string | null
  downloadExpiresAt: string | null
  createdAt: string
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
