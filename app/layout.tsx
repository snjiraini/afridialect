import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layouts/Header'
import Footer from '@/components/layouts/Footer'

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
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
