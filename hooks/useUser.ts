/**
 * User Profile Hook
 * Manages user profile data and roles
 */

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { UserRole } from '@/types'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  hedera_account_id: string | null
  kms_key_id: string | null
  created_at: string
  updated_at: string
}

interface UserProfileWithRoles extends UserProfile {
  roles: UserRole[]
}

export function useUser() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfileWithRoles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  // createClient() returns a singleton — always valid in the browser.
  const supabase = createClient()

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    async function loadProfile() {
      try {
        setLoading(true)
        setError(null)

        // Get profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user!.id)
          .single()

        if (profileError) throw profileError

        // Get roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)

        if (rolesError) throw rolesError

        setProfile({
          ...profileData,
          roles: rolesData.map((r: { role: string }) => r.role as UserRole),
        })
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in')

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) throw error

    // Reload profile
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile((prev) => (prev ? { ...prev, ...data } : null))
    }
  }

  const hasRole = (role: UserRole): boolean => {
    return profile?.roles.includes(role) ?? false
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some((role) => hasRole(role))
  }

  const isAdmin = (): boolean => {
    return hasRole('admin')
  }

  return {
    profile,
    loading,
    error,
    updateProfile,
    hasRole,
    hasAnyRole,
    isAdmin,
  }
}
