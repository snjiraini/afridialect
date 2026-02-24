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
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-500 rounded-lg p-3">
          <p className="text-green-800 dark:text-green-400 text-sm">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-500 rounded-lg p-3">
          <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Assign Role Form */}
      {unassignedRoles.length > 0 && (
        <form onSubmit={handleAssignRole} className="flex gap-3">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          >
            <option value="">Select a role to assign</option>
            {unassignedRoles.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !selectedRole}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Assigning...' : 'Assign Role'}
          </button>
        </form>
      )}

      {/* Remove Roles */}
      {currentRoles.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
            Remove Roles
          </label>
          <div className="flex flex-wrap gap-2">
            {currentRoles.map((role) => (
              <button
                key={role}
                onClick={() => handleRemoveRole(role)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              >
                <span className="capitalize">{role}</span>
                <span className="text-xs">✕</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-lg p-3">
        <p className="text-blue-700 dark:text-blue-300 text-sm">
          <strong>Note:</strong> Role changes take effect immediately and control
          access to different features of the platform.
        </p>
      </div>
    </div>
  )
}
