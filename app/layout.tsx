import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Afridialect.ai',
  description: 'A web platform for creating and purchasing high-quality speech datasets in African local dialects',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
