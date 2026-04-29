'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseOwner as supabase } from '@/lib/supabase'
import Link from 'next/link'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/owner',           label: 'Dashboard'},
  { href: '/owner/toko',      label: 'Per Toko'},
  { href: '/owner/produk',    label: 'Produk' },
  { href: '/owner/karyawan',  label: 'Karyawan' },
  { href: '/owner/keuangan',  label: 'Keuangan' },
  { href: '/owner/transaksi', label: 'Log Transaksi' },
]

// ─── NavItem ──────────────────────────────────────────────────────────────────

const NavItem = memo(({
  href, label, aktif, onClick,
}: {
  href: string
  label: string
  aktif: boolean
  onClick?: () => void
}) => (
  <Link
    href={href}
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all
      ${aktif
        ? 'bg-yellow-500 text-gray-900'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
  >
    <span className="text-base"></span>
    <span>{label}</span>
  </Link>
))
NavItem.displayName = 'NavItem'

// ─── Sidebar Content ──────────────────────────────────────────────────────────

const SidebarContent = memo(({
  pathname, onNavClick, onLogout,
}: {
  pathname: string
  onNavClick?: () => void
  onLogout: () => void
}) => (
  <div className="flex flex-col h-full">
    {/* Logo */}
    <div className="p-5 border-b border-gray-800 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-gray-900 font-bold text-sm">AJ</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm">Alfin Jaya</p>
          <p className="text-gray-400 text-xs">Owner Panel</p>
        </div>
      </div>
    </div>

    {/* Nav */}
    <nav className="flex-1 p-3 overflow-y-auto">
      {NAV_ITEMS.map(item => (
        <NavItem
          key={item.href}
          href={item.href}
          label={item.label}
          aktif={pathname === item.href}
          onClick={onNavClick}
        />
      ))}
    </nav>

    {/* Bottom */}
    <div className="p-3 border-t border-gray-800 flex-shrink-0">
      <Link
        href="/login"
        onClick={onNavClick}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-all mb-1"
      >
        <span>🛒</span>
        <span>Buka Kasir</span>
      </Link>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all"
      >
        <span>Keluar</span>
      </button>
    </div>
  </div>
))
SidebarContent.displayName = 'SidebarContent'

// ─── Layout Utama ─────────────────────────────────────────────────────────────

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router   = useRouter()
  const pathname = usePathname()
  const [ready, setReady]         = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Proteksi halaman owner
// Proteksi halaman owner
useEffect(() => {
  if (pathname === '/owner/login') { setReady(true); return }

  const checkOwner = async () => {
    const session = localStorage.getItem('owner_session')
    if (!session) {
      router.push('/owner/login')
      return
    }
    setReady(true)
  }

  checkOwner()
}, [pathname, router])

  // Tutup sidebar saat navigasi
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Tutup sidebar saat klik luar (escape key)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])
  
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()          // ← tambah ini
    localStorage.removeItem('owner_session')
    document.cookie = 'owner_session=; path=/; max-age=0'
    router.push('/owner/login')
  }, [router])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), [])

  // Halaman login tidak pakai layout
  if (pathname === '/owner/login') return <>{children}</>
  if (!ready) return null

  // Label halaman aktif untuk header mobile
  const halamanAktif =
  NAV_ITEMS.find(n => n.href === pathname) ??
  NAV_ITEMS.find(n => pathname.startsWith(n.href) && n.href !== '/owner') ??
  NAV_ITEMS[0]

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">

      {/* ── OVERLAY MOBILE (klik untuk tutup) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── SIDEBAR DESKTOP (selalu tampil) ── */}
      <aside className="hidden md:flex w-56 bg-gray-900 flex-col flex-shrink-0 h-full">
        <SidebarContent
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── SIDEBAR MOBILE (slide dari kiri) ── */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 z-40 flex flex-col
        transform transition-transform duration-300 ease-in-out md:hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SidebarContent
          pathname={pathname}
          onNavClick={closeSidebar}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── KONTEN UTAMA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header Mobile (hanya tampil di HP) */}
        <header className="md:hidden flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Buka menu"
          >
            {/* Hamburger icon */}
            <div className="flex flex-col gap-1.5">
              <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300
                ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300
                ${sidebarOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-300
                ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-gray-900 font-bold text-xs">AJ</span>
            </div>
            <p className="font-semibold text-gray-800 text-sm truncate">
              {NAV_ITEMS.find(n => n.href === pathname)?.label ?? 'Owner Panel'}
            </p>
          </div>

          {/* Shortcut kasir di header mobile */}
          <Link
            href="/login"
            className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 px-2 py-1 rounded-lg hover:bg-gray-100"
          >
            🛒
          </Link>
        </header>

        {/* Konten halaman */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}