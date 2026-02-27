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
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        suppressHydrationWarning on <html> prevents React hydration warnings
        caused by the ThemeProvider adding/removing 'dark' class on the client.
      */}
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            {/* Sidebar: fixed, always visible */}
            <Sidebar />
            {/* Main content: offset by sidebar width */}
            <div
              className="min-h-screen transition-colors duration-300"
              style={{
                marginLeft: 'var(--af-sidebar-w)',
                background: 'var(--af-bg)',
              }}
            >
              {children}
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

