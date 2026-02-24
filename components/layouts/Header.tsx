'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-soft-sm">
      <div className="container-modern">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-accent-purple rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-gradient-to-br from-primary-600 to-accent-purple p-2 rounded-xl shadow-soft-md">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-display font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Afridialect.ai
              </h1>
              <p className="text-xs text-gray-500">African Speech Datasets</p>
            </div>
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link 
              href="/dashboard" 
              className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium transition-all duration-200"
            >
              Dashboard
            </Link>
            <Link 
              href="/profile" 
              className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium transition-all duration-200"
            >
              Profile
            </Link>
            <Link 
              href="/marketplace" 
              className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <span>Marketplace</span>
                <span className="badge badge-primary text-xs">New</span>
              </div>
            </Link>
            <Link 
              href="/admin" 
              className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium transition-all duration-200"
            >
              Admin
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden lg:flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 border border-gray-100 hover:border-gray-200 transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search datasets..."
                className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 w-40"
              />
            </div>

            {/* Notifications */}
            <button className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-pink rounded-full border-2 border-white" />
            </button>

            {/* Auth Buttons */}
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl text-gray-700 hover:bg-red-50 hover:text-red-600 font-medium transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="hidden sm:block px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  className="btn-primary"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

