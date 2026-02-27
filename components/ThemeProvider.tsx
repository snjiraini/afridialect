'use client'

/**
 * ThemeProvider
 * Handles dark/light mode with localStorage persistence.
 * Applies 'dark' class to <html> — compatible with Tailwind darkMode: 'class'.
 * Also sets data-theme for legacy CSS tokens.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Read persisted preference once mounted (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('af-theme') as Theme | null
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const resolved: Theme = stored ?? (prefersDark ? 'dark' : 'light')
      setTheme(resolved)
    } catch {
      // localStorage may be blocked
    }
    setMounted(true)
  }, [])

  // Apply class to <html> whenever theme changes
  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light-mode')
    } else {
      root.classList.remove('dark')
      root.classList.add('light-mode')
    }
    try {
      localStorage.setItem('af-theme', theme)
    } catch {
      // ignore
    }
  }, [theme, mounted])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  // Prevent flash: render children normally (SSR will always output light)
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
