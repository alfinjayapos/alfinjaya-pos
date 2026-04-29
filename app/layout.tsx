import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alfin Jaya POS',
  description: 'Sistem Kasir Alfin Jaya 1 & 2',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AJ POS',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning={true}>
  <head>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#EAB308" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="AJ POS" />
    
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  </head>

  <body suppressHydrationWarning={true}>
    {children}
  </body>
</html>
  )
}