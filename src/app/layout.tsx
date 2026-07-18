import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SettingsProvider } from '@/lib/settings-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BMIS — Barangay Management Information System',
  description: 'Barangay Management Information System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  )
}