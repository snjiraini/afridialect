'use client'

/**
 * TaskUnlockClient
 * Admin override: lists claimed tasks and allows unlocking them.
 */

import { useState } from 'react'

interface ClaimedTask {
  id: string
  task_type: string
  status: string
  claimed_by: string | null
  claimed_at: string | null
  expires_at: string | null
  audio_clip_id: string | null
  claimerName: string
}

interface Props {
  initialTasks: ClaimedTask[]
}

function fmtType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export default function TaskUnlockClient({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<ClaimedTask[]>(initialTasks)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleUnlock(taskId: string) {
    setError(null)
    setSuccessMsg(null)
    setUnlocking(taskId)

    try {
      const res = await fetch('/api/admin/tasks/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to unlock task')
      } else {
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
        setSuccessMsg(`Task ${taskId.slice(0, 8)}… unlocked successfully.`)
        setTimeout(() => setSuccessMsg(null), 4000)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setUnlocking(null)
    }
  }

  return (
    <div>
      {error && (
        <div
          className="mb-4 text-sm p-3 rounded-xl"
          style={{ background: '#fee2e2', color: '#991b1b' }}
        >
          {error}
        </div>
      )}
      {successMsg && (
        <div
          className="mb-4 text-sm p-3 rounded-xl"
          style={{ background: '#d1fae5', color: '#065f46' }}
        >
          ✅ {successMsg}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
          No claimed tasks. All tasks are available or already submitted.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                {['Task Type', 'Claimed By', 'Claimed At', 'Expires', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-3 pr-4 text-xs font-semibold"
                    style={{ color: 'var(--af-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const expired = isExpired(t.expires_at)
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--af-line)' }}>
                    <td className="py-3 pr-4">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'var(--af-primary-light)',
                          color: 'var(--af-primary)',
                        }}
                      >
                        {fmtType(t.task_type)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs" style={{ color: 'var(--af-txt)' }}>
                      {t.claimerName}
                    </td>
                    <td className="py-3 pr-4 text-xs font-mono" style={{ color: 'var(--af-muted)' }}>
                      {t.claimed_at ? new Date(t.claimed_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {t.expires_at ? (
                        <span
                          className="text-xs font-semibold"
                          style={{ color: expired ? '#ef4444' : 'var(--af-muted)' }}
                        >
                          {expired ? '⚠️ Expired' : new Date(t.expires_at).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--af-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={unlocking === t.id}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleUnlock(t.id)
                        }}
                        className="text-xs font-semibold px-3 py-1 rounded-lg"
                        style={{
                          background: '#fee2e2',
                          color: '#991b1b',
                          opacity: unlocking === t.id ? 0.5 : 1,
                          cursor: unlocking === t.id ? 'wait' : 'pointer',
                        }}
                      >
                        {unlocking === t.id ? '…' : 'Unlock'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
