/**
 * Role Assignment Form Component
 * Client component for assigning/removing roles
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RoleAssignmentFormProps {
  userId: string
  currentRoles: string[]
  availableRoles: string[]
}

export default function RoleAssignmentForm({
  userId,
  currentRoles,
  availableRoles,
}: RoleAssignmentFormProps) {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const unassignedRoles = availableRoles.filter(
    (role) => !currentRoles.includes(role)
  )

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRole) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: selectedRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign role')
      }

      setSuccess(`Role "${selectedRole}" assigned successfully`)
      setSelectedRole('')
      
      // Refresh the page to show updated roles
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveRole = async (role: string) => {
    if (!confirm(`Are you sure you want to remove the "${role}" role?`)) {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/remove-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove role')
      }

      setSuccess(`Role "${role}" removed successfully`)
      
      // Refresh the page to show updated roles
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Success/Error Messages */}
      {success && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Assign Role Form */}
      {unassignedRoles.length > 0 && (
        <form onSubmit={handleAssignRole} className="flex gap-3">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="af-select flex-1"
            disabled={loading}
          >
            <option value="">Select a role to assign</option>
            {unassignedRoles.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={loading || !selectedRole} className="btn-primary">
            {loading ? 'Assigning…' : 'Assign Role'}
          </button>
        </form>
      )}

      {/* Remove Roles */}
      {currentRoles.length > 0 && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--af-muted)' }}>Remove Roles</p>
          <div className="flex flex-wrap gap-2">
            {currentRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveRole(role) }}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
              >
                {role} <span>✕</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.14)', color: 'var(--af-muted)' }}>
        <strong style={{ color: 'var(--af-primary)' }}>Note:</strong> Role changes take effect immediately and control access to different features of the platform.
      </div>
    </div>
  )
}
