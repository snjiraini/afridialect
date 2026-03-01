'use client'

/**
 * ThemeProvider
 * Light mode is the sole UI palette — dark mode has been removed.
 * The context is kept so existing consumers of useTheme() continue to compile.
 */

import { createContext, useContext } from 'react'

type Theme = 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
