import type { Metadata, Viewport } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SessionProviderClient from '@/components/SessionProviderClient'
import AuthedShell from '@/components/ui/AuthedShell'
import SWRegister from '@/components/ui/SWRegister'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cortexbuildpro.com'
const DESCRIPTION = 'Mobile-first construction management for UK SMEs — projects, tasks, capture, invoices, and a real-time site view.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Cortexx — CortexBuild', template: '%s · Cortexx' },
  description: DESCRIPTION,
  manifest: '/manifest.json',
  applicationName: 'Cortexx',
  appleWebApp: {
    capable: true,
    title: 'Cortexx',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    siteName: 'Cortexx',
    title: 'Cortexx — CortexBuild',
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Cortexx' }],
  },
  twitter: {
    card: 'summary',
    title: 'Cortexx — CortexBuild',
    description: DESCRIPTION,
    images: ['/icon-512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png',   sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png',   sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png',     sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-167.png', sizes: '167x167', type: 'image/png' },
      { url: '/apple-touch-icon-152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
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
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS splash screens (one per device — Safari picks the matching media query) */}
        <link rel="apple-touch-startup-image" href="/apple-splash-1290-2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1179-2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1170-2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-1125-2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-828-1792.png"  media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />
        <link rel="apple-touch-startup-image" href="/apple-splash-750-1334.png"  media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
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
          <AuthedShell />
          <SWRegister />
        </SessionProviderClient>
      </body>
    </html>
  )
}
