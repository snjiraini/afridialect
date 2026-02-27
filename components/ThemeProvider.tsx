'use client'

/**
 * ThemeProvider
 * Handles dark/light mode with localStorage persistence.
 * Applies 'dark' class to <html> — compatible with Tailwind darkMode: 'class'.
 *
 * Hydration safety:
 *  - suppressHydrationWarning on <html> in layout.tsx prevents React warnings.
 *  - The inline <script> in layout.tsx reads localStorage BEFORE React hydrates,
 *    eliminating the flash of unstyled content (FOUC).
 *  - We initialise React state from document.documentElement.classList so the
 *    client state always matches what the inline script already set.
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

/** Read the theme that the blocking inline script already applied to <html>. */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialise directly from the DOM so React state matches on first paint.
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // Keep <html> class in sync whenever theme changes (covers toggleTheme calls).
  useEffect(() => {
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
      // localStorage may be blocked in some privacy modes
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
