/**
 * Admin — Audit Logs
 * View system activity, security events, and admin actions.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

const ACTION_LABELS: Record<string, string> = {
  audio_upload: '🎙️ Audio Upload',
  create_hedera_account: '⛓️ Hedera Account Created',
  mint_nfts: '🪙 NFTs Minted',
  ipfs_verify_pins: '🔍 IPFS Pins Verified',
  ipfs_cleanup_staging: '🗑️ Staging Cleaned',
  assign_role: '🔐 Role Assigned',
  remove_role: '🔓 Role Removed',
  transcription_claim: '📝 Transcription Claimed',
  transcription_submit: '📝 Transcription Submitted',
  translation_claim: '🌐 Translation Claimed',
  translation_submit: '🌐 Translation Submitted',
  audio_qc_submit: '✅ Audio QC Submitted',
  transcript_qc_submit: '✅ Transcript QC Submitted',
  translation_qc_submit: '✅ Translation QC Submitted',
}

export default async function AdminAuditLogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // Require admin role
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleRow) {
    return (
      <>
        <Topbar title="Audit Logs" subtitle="System activity and security events" />
        <div className="container-modern py-8">
          <div className="af-card p-6 border-l-4" style={{ borderColor: 'var(--af-danger)' }}>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>Access Denied</h3>
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
              You need the <strong>admin</strong> role to view audit logs.
            </p>
          </div>
        </div>
      </>
    )
  }

  // Fetch the 200 most recent audit log entries
  const { data: logs } = await admin
    .from('audit_logs')
    .select('id, user_id, action, resource_type, resource_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // Collect unique user_ids to resolve names
  const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))]

  const { data: profiles } = userIds.length
    ? await admin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds)
    : { data: [] }

  const profileMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = p.full_name ?? p.email ?? p.id
  }

  // Action counts for summary bar
  const actionCounts: Record<string, number> = {}
  for (const log of logs ?? []) {
    actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1
  }

  return (
    <>
      <Topbar title="Audit Logs" subtitle="System activity and security events" />
      <div className="container-modern py-8">

        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm flex items-center gap-1.5 w-fit"
            style={{ color: 'var(--af-primary)' }}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Admin
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Events', value: logs?.length ?? 0, icon: '📋' },
            { label: 'Audio Uploads', value: actionCounts['audio_upload'] ?? 0, icon: '🎙️' },
            { label: 'NFTs Minted', value: actionCounts['mint_nfts'] ?? 0, icon: '🪙' },
            { label: 'Role Changes', value: (actionCounts['assign_role'] ?? 0) + (actionCounts['remove_role'] ?? 0), icon: '🔐' },
          ].map((s) => (
            <div key={s.label} className="af-card p-5">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-xl font-bold mb-1" style={{ color: 'var(--af-txt)' }}>{s.value}</div>
              <div className="text-xs" style={{ color: 'var(--af-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Log table */}
        <div className="af-card overflow-hidden">
          <div className="p-5 border-b" style={{ borderColor: 'var(--af-line)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--af-txt)' }}>
              Recent Events (last {logs?.length ?? 0})
            </h2>
          </div>

          {!logs || logs.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--af-muted)' }}>
              No audit log entries yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                    {['Timestamp', 'User', 'Action', 'Resource', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold"
                        style={{ color: 'var(--af-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid var(--af-line)' }}
                    >
                      <td className="px-5 py-3 whitespace-nowrap font-mono text-xs" style={{ color: 'var(--af-muted)' }}>
                        {new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-xs max-w-[160px] truncate" style={{ color: 'var(--af-txt)' }}>
                        {profileMap[log.user_id] ?? log.user_id?.slice(0, 8) ?? '—'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-xs font-medium" style={{ color: 'var(--af-txt)' }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--af-muted)' }}>
                        <span className="font-medium">{log.resource_type}</span>
                        {log.resource_id && (
                          <span className="font-mono ml-1 opacity-70">
                            {log.resource_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {log.details && (
                          <details className="text-xs cursor-pointer">
                            <summary
                              className="font-medium"
                              style={{ color: 'var(--af-primary)' }}
                            >
                              Details
                            </summary>
                            <pre
                              className="mt-2 p-2 rounded text-xs overflow-x-auto max-w-xs"
                              style={{ background: 'var(--af-search-bg)', color: 'var(--af-muted)' }}
                            >
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
