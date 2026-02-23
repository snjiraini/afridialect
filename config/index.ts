/**
 * Application Configuration
 * Central configuration for the Afridialect.ai platform
 */

export const config = {
  app: {
    name: 'Afridialect.ai',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    environment: process.env.NODE_ENV || 'development',
  },

  audio: {
    minDurationSeconds: parseInt(process.env.MIN_AUDIO_DURATION_SECONDS || '30'),
    maxDurationSeconds: parseInt(process.env.MAX_AUDIO_DURATION_SECONDS || '40'),
    maxFileSizeMB: parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB || '50'),
    supportedFormats: (process.env.SUPPORTED_AUDIO_FORMATS || 'mp3,wav,m4a,ogg').split(','),
  },

  tasks: {
    claimTimeoutHours: parseInt(process.env.TASK_CLAIM_TIMEOUT_HOURS || '24'),
  },

  pricing: {
    audioSampleUSD: parseFloat(process.env.PRICE_PER_AUDIO_SAMPLE || '0.50'),
    transcriptSampleUSD: parseFloat(process.env.PRICE_PER_TRANSCRIPT_SAMPLE || '0.50'),
    translationSampleUSD: parseFloat(process.env.PRICE_PER_TRANSLATION_SAMPLE || '0.50'),
    qcReviewPayoutUSD: parseFloat(process.env.QC_REVIEW_PAYOUT_USD || '1.00'),
  },

  nft: {
    supplyPerComponent: 300,
  },

  dataset: {
    exportTTLHours: parseInt(process.env.DATASET_EXPORT_TTL_HOURS || '24'),
  },

  features: {
    audioUpload: process.env.ENABLE_AUDIO_UPLOAD === 'true',
    marketplace: process.env.ENABLE_MARKETPLACE === 'true',
    nftMinting: process.env.ENABLE_NFT_MINTING === 'true',
  },

  security: {
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60'),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },

  dialects: {
    supported: ['kikuyu', 'swahili'],
    default: 'swahili',
  },
} as const

export type Config = typeof config
