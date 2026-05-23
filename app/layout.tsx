import type { Metadata, Viewport } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SessionProviderClient from '@/components/SessionProviderClient'
import UserMenu from '@/components/ui/UserMenu'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cortexx — CortexBuild',
  description: 'Mobile-first construction management',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#06101e',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" style={{ background: '#06101e' }}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ background: '#06101e', minHeight: '100dvh', overflowX: 'hidden' }}>
        <SessionProviderClient session={session}>
          <div
            id="app-root"
            style={{
              maxWidth: '480px',
              margin: '0 auto',
              minHeight: '100dvh',
              position: 'relative',
              background: '#06101e',
            }}
          >
            {children}
          </div>
          <UserMenu />
        </SessionProviderClient>
      </body>
    </html>
  )
}
