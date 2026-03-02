/**
 * Authentication Hook
 * Provides authentication state and methods for the application
 */

'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      console.log('signIn: Starting authentication for', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        console.error('signIn: Authentication error:', error)
      } else {
        console.log('signIn: Authentication successful', data)
      }
      
      return { error }
    } catch (error) {
      console.error('signIn: Caught exception:', error)
      return { error: error as Error }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log('signUp: Creating account for', email)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          // Disable email confirmation requirement
          // Note: This requires "Enable email confirmations" to be OFF in Supabase Dashboard
          // Or configure autoConfirm in your Supabase project settings
        },
      })
      
      if (error) {
        console.error('signUp: Registration error:', error)
      } else {
        console.log('signUp: Registration successful', data)
        console.log('signUp: User confirmed?', data.user?.email_confirmed_at)
      }
      
      return { error }
    } catch (error) {
      console.error('signUp: Caught exception:', error)
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    // scope: 'local' clears the browser session without a network call to
    // /auth/v1/logout (which can fail with NetworkError due to CORS or
    // connectivity issues). The server-side refresh token expires on its own.
    await supabase.auth.signOut({ scope: 'local' })
    // Hard-navigate to login so all React state is wiped and the middleware
    // sees a fully unauthenticated request — prevents stale-state loops.
    window.location.href = '/auth/login'
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
