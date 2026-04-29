import type { NextConfig } from 'next'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')

const pwaConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.*'],
  turbopack: {},
}

export default pwaConfig(nextConfig)