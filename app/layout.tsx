import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/components/ThemeProvider'
import Sidebar from '@/components/layouts/Sidebar'

export const metadata: Metadata = {
  title: 'Afridialect.ai - African Dialect Speech Datasets',
  description:
    'A web platform for creating and purchasing high-quality speech datasets in African local dialects. Starting with Kikuyu and Swahili.',
  keywords: ['speech datasets', 'african dialects', 'kikuyu', 'swahili', 'nft', 'hedera'],
  icons: [],
}

/**
 * Inline script injected into <head> BEFORE React hydrates.
 * This reads localStorage and applies 'dark' / 'light-mode' to <html>
 * synchronously, preventing the flash of unstyled content (FOUC).
 * It must be a raw string — no JSX transforms.
 */
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('af-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light-mode');
    }
  } catch(e) {}
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Blocking inline script: runs before paint to set dark/light class.
          suppressHydrationWarning is on <html> so React ignores the class
          mismatch between SSR (no class) and client (class set by script).
          dangerouslySetInnerHTML is intentional here — no user input is involved.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {/* Sidebar: fixed left panel, z-40 — always above content */}
            <Sidebar />
            {/*
              Main content shell:
              - margin-left matches sidebar width via CSS variable
              - min-h-screen fills the viewport
              - z-index is implicitly 0 (below sidebar z-40, below topbar z-30)
              - overflow-x-hidden prevents horizontal scroll on narrow content
            */}
            <div
              className="af-page-content min-h-screen overflow-x-hidden transition-colors duration-300"
              style={{ marginLeft: 'var(--af-sidebar-w)' }}
            >
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

