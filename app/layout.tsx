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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
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


