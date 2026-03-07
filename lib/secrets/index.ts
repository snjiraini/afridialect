/**
 * Unified Secrets Loader — Afridialect.ai
 *
 * Priority order (server-side only):
 *   1. OS environment variables / .env.local (already loaded by Next.js)
 *   2. AWS Secrets Manager (fetched once, cached in memory)
 *
 * Rules:
 *  - Development: env vars first, AWS fallback
 *  - Production:  env vars first (CI/CD injected), AWS fallback
 *  - NEXT_PUBLIC_* keys are NOT fetched from AWS — they are browser-exposed
 *    and must always come from the build-time environment.
 *  - This module must only be imported in server-side code (API routes,
 *    Server Components, lib/). Never import in client components.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class SecretNotFoundError extends Error {
  constructor(key: string) {
    super(
      `Secret "${key}" was not found in environment variables or AWS Secrets Manager.`
    )
    this.name = 'SecretNotFoundError'
  }
}

export class SecretsAuthError extends Error {
  constructor(detail: string) {
    super(
      `AWS credentials error while fetching secrets: ${detail}\n` +
        'Ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set, ' +
        'or an IAM role is attached to the running instance.'
    )
    this.name = 'SecretsAuthError'
  }
}

export class SecretsPermissionError extends Error {
  constructor(secretId: string) {
    super(
      `Access denied to AWS secret "${secretId}". ` +
        'Attach a policy with secretsmanager:GetSecretValue for this secret ARN.'
    )
    this.name = 'SecretsPermissionError'
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * The AWS Secrets Manager secret name / ARN that holds the flat JSON map
 * of all application secrets.
 *
 * Override with the AWS_SECRET_ID environment variable.
 * Default matches the recommended naming convention for this project.
 */
const SECRET_ID =
  process.env.AWS_SECRET_ID ?? 'afridialect/production/env'

/**
 * Cache TTL in milliseconds.  Default: 5 minutes.
 * Override with SECRETS_CACHE_TTL_MS environment variable.
 */
const CACHE_TTL_MS = parseInt(
  process.env.SECRETS_CACHE_TTL_MS ?? String(5 * 60 * 1000),
  10
)

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface SecretsCache {
  data: Record<string, string>
  fetchedAt: number
}

let _cache: SecretsCache | null = null

// ---------------------------------------------------------------------------
// AWS client (lazy-init — only constructed when actually needed)
// ---------------------------------------------------------------------------

let _awsClient: SecretsManagerClient | null = null

function getAwsClient(): SecretsManagerClient {
  if (!_awsClient) {
    _awsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      // Credentials resolved from the default provider chain:
      //   1. Explicit env vars (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
      //   2. ~/.aws/credentials (CLI profile, respects AWS_PROFILE)
      //   3. IAM instance/task role
    })
  }
  return _awsClient
}

// ---------------------------------------------------------------------------
// Core fetch with retry + exponential back-off
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3

async function fetchFromAws(): Promise<Record<string, string>> {
  const client = getAwsClient()
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.send(
        new GetSecretValueCommand({ SecretId: SECRET_ID })
      )

      const raw = response.SecretString
      if (!raw) {
        throw new Error(
          `AWS secret "${SECRET_ID}" exists but has no SecretString value.`
        )
      }

      return JSON.parse(raw) as Record<string, string>
    } catch (err: unknown) {
      lastError = err

      // Non-retryable errors — surface immediately
      if (err instanceof ResourceNotFoundException) {
        throw new SecretNotFoundError(SECRET_ID)
      }

      const errName = (err as { name?: string }).name ?? ''
      const errMsg = (err as { message?: string }).message ?? ''

      if (errName === 'UnrecognizedClientException' || errMsg.includes('security token')) {
        throw new SecretsAuthError(errMsg)
      }

      if (
        errName === 'AccessDeniedException' ||
        errMsg.includes('AccessDenied')
      ) {
        throw new SecretsPermissionError(SECRET_ID)
      }

      // Retryable — network timeout, throttling, etc.
      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 300  // 600ms, 1200ms
        console.warn(
          `[secrets] AWS fetch attempt ${attempt}/${MAX_RETRIES} failed: ${errMsg}. ` +
            `Retrying in ${backoffMs}ms…`
        )
        await new Promise((r) => setTimeout(r, backoffMs))
      }
    }
  }

  throw lastError
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the full secrets map from AWS (or the in-memory cache if still fresh).
 * Called automatically by `getSecret()` — you rarely need this directly.
 */
export async function loadSecrets(): Promise<Record<string, string>> {
  const now = Date.now()

  if (_cache && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.data
  }

  console.log(`[secrets] Fetching secrets from AWS Secrets Manager ("${SECRET_ID}")…`)
  const data = await fetchFromAws()
  _cache = { data, fetchedAt: now }
  console.log(`[secrets] Secrets loaded (${Object.keys(data).length} keys).`)
  return data
}

/**
 * Retrieve a single secret value.
 *
 * Lookup priority:
 *   1. `process.env[key]` — covers .env.local (dev) and injected CI vars
 *   2. AWS Secrets Manager cached map
 *
 * @throws {SecretNotFoundError} if the key is absent from both sources
 *
 * @example
 *   const key = await getSecret('HEDERA_OPERATOR_PRIVATE_KEY')
 */
export async function getSecret(key: string): Promise<string> {
  // 1️⃣ Environment variable (fastest path — no network call)
  const envValue = process.env[key]
  if (envValue !== undefined && envValue !== '') {
    return envValue
  }

  // 2️⃣ AWS Secrets Manager
  try {
    const secrets = await loadSecrets()
    const awsValue = secrets[key]
    if (awsValue !== undefined && awsValue !== '') {
      return awsValue
    }
  } catch (err) {
    // Re-throw typed errors
    if (
      err instanceof SecretNotFoundError ||
      err instanceof SecretsAuthError ||
      err instanceof SecretsPermissionError
    ) {
      throw err
    }
    // Unexpected error — log and fall through to the final throw
    console.error('[secrets] Unexpected error fetching from AWS:', err)
  }

  throw new SecretNotFoundError(key)
}

/**
 * Force-clear the in-memory cache so the next `getSecret()` call
 * re-fetches from AWS Secrets Manager.
 *
 * Useful in long-running processes (e.g., workers) that need to pick
 * up rotated secrets without restarting.
 */
export function refreshSecrets(): void {
  _cache = null
  console.log('[secrets] Cache cleared — next fetch will pull from AWS.')
}
