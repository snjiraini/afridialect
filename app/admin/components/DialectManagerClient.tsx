'use client'

/**
 * DialectManagerClient
 * Allows admin to add new dialects and toggle enabled/disabled status.
 * Lives inside /admin/settings page.
 */

import { useState } from 'react'

interface Dialect {
  id: string
  name: string
  code: string
  enabled: boolean
}

interface Props {
  initialDialects: Dialect[]
}

export default function DialectManagerClient({ initialDialects }: Props) {
  const [dialects, setDialects] = useState<Dialect[]>(initialDialects)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAddSuccess(false)
    setAddLoading(true)

    try {
      const res = await fetch('/api/admin/dialects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), code: newCode.trim().toLowerCase() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAddError(json.error ?? 'Failed to add dialect')
      } else {
        setDialects((prev) => [...prev, json.dialect].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName('')
        setNewCode('')
        setAddSuccess(true)
        setTimeout(() => setAddSuccess(false), 3000)
      }
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAddLoading(false)
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    setToggleError(null)
    setToggleLoading(id)

    try {
      const res = await fetch('/api/admin/dialects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled }),
      })
      const json = await res.json()
      if (!res.ok) {
        setToggleError(json.error ?? 'Failed to update dialect')
      } else {
        setDialects((prev) =>
          prev.map((d) => (d.id === id ? { ...d, enabled: !enabled } : d)),
        )
      }
    } catch {
      setToggleError('Network error — please try again')
    } finally {
      setToggleLoading(null)
    }
  }

  return (
    <div>
      {/* Add dialect form */}
      <form onSubmit={handleAdd} className="mb-6">
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--af-txt)' }}>Add New Dialect</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
              Display Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Luo"
              required
              className="w-full rounded-xl px-3 py-2 text-sm border"
              style={{
                background: 'var(--af-search-bg)',
                borderColor: 'var(--af-line)',
                color: 'var(--af-txt)',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
              Code (lowercase, no spaces)
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
              placeholder="e.g. luo"
              required
              className="w-full rounded-xl px-3 py-2 text-sm border"
              style={{
                background: 'var(--af-search-bg)',
                borderColor: 'var(--af-line)',
                color: 'var(--af-txt)',
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={addLoading || !newName.trim() || !newCode.trim()}
              className="w-full rounded-xl px-4 py-2 text-sm font-semibold transition-opacity"
              style={{
                background: 'var(--af-primary)',
                color: '#fff',
                opacity: addLoading || !newName.trim() || !newCode.trim() ? 0.5 : 1,
                cursor: addLoading ? 'wait' : 'pointer',
              }}
            >
              {addLoading ? 'Adding…' : '+ Add Dialect'}
            </button>
          </div>
        </div>
        {addError && (
          <p className="text-xs mt-2" style={{ color: 'var(--af-danger)' }}>{addError}</p>
        )}
        {addSuccess && (
          <p className="text-xs mt-2" style={{ color: '#10b981' }}>✅ Dialect added successfully!</p>
        )}
      </form>

      {toggleError && (
        <p className="text-xs mb-3" style={{ color: 'var(--af-danger)' }}>{toggleError}</p>
      )}

      {/* Dialect table */}
      {dialects.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
          No dialects configured. Add one above or run the seed SQL.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                {['Name', 'Code', 'Status', 'Action'].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-3 pr-6 text-xs font-semibold"
                    style={{ color: 'var(--af-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dialects.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--af-line)' }}>
                  <td className="py-3 pr-6 font-medium" style={{ color: 'var(--af-txt)' }}>{d.name}</td>
                  <td className="py-3 pr-6 font-mono text-xs" style={{ color: 'var(--af-muted)' }}>{d.code}</td>
                  <td className="py-3 pr-6">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: d.enabled ? 'var(--af-primary-light)' : 'var(--af-line)',
                        color: d.enabled ? 'var(--af-primary)' : 'var(--af-muted)',
                      }}
                    >
                      {d.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      disabled={toggleLoading === d.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleToggle(d.id, d.enabled)
                      }}
                      className="text-xs font-semibold px-3 py-1 rounded-lg transition-opacity"
                      style={{
                        background: d.enabled ? '#fee2e2' : 'var(--af-primary-light)',
                        color: d.enabled ? '#991b1b' : 'var(--af-primary)',
                        opacity: toggleLoading === d.id ? 0.5 : 1,
                        cursor: toggleLoading === d.id ? 'wait' : 'pointer',
                      }}
                    >
                      {toggleLoading === d.id ? '…' : d.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
