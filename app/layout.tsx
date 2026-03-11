import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/hooks/useAuth'
import { ThemeProvider } from '@/components/ThemeProvider'
import ConditionalSidebar from '@/components/layouts/ConditionalSidebar'
import ConditionalContentShell from '@/components/layouts/ConditionalContentShell'

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
            {/* Sidebar: conditionally hidden on the public landing page */}
            <ConditionalSidebar />
            {/*
              Main content shell:
              - margin-left matches sidebar width via CSS variable on app routes
              - on the public landing page (/) no left margin is applied
              - min-h-screen fills the viewport
            */}
            <ConditionalContentShell>
              {children}
            </ConditionalContentShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}


