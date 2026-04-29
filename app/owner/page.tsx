'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { supabaseOwner as supabase } from '@/lib/supabase'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProdukTerlaris {
  nama_produk: string
  total_terjual: number
  total_pendapatan: number
}

interface StokKategori {
  nama: string
  total_stok: number
  jumlah_produk: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

// ─── Skeleton Components ──────────────────────────────────────────────────────

const SkeletonCard = memo(() => (
  <div className="rounded-2xl border border-gray-200 p-4 animate-pulse">
    <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
    <div className="h-6 bg-gray-200 rounded w-32 mb-1" />
    <div className="h-3 bg-gray-200 rounded w-20" />
  </div>
))
SkeletonCard.displayName = 'SkeletonCard'

const SkeletonRow = memo(() => (
  <div className="flex items-center gap-3 py-2 animate-pulse">
    <div className="w-7 h-7 bg-gray-200 rounded-full flex-shrink-0" />
    <div className="flex-1">
      <div className="h-3 bg-gray-200 rounded w-32 mb-1" />
      <div className="h-2.5 bg-gray-200 rounded w-20" />
    </div>
    <div className="h-5 bg-gray-200 rounded-full w-16" />
  </div>
))
SkeletonRow.displayName = 'SkeletonRow'

const SkeletonBar = memo(() => (
  <div className="mb-3 animate-pulse">
    <div className="flex justify-between mb-1">
      <div className="h-3 bg-gray-200 rounded w-20" />
      <div className="h-3 bg-gray-200 rounded w-16" />
    </div>
    <div className="h-1.5 bg-gray-200 rounded-full" />
  </div>
))
SkeletonBar.displayName = 'SkeletonBar'

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = memo(({ label, value, sub }: {
  label: string; value: string; sub: string
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">{label}</p>
    <p className="text-xl font-bold text-gray-900">{value}</p>
    <p className="text-xs text-gray-400 mt-1">{sub}</p>
  </div>
))
StatCard.displayName = 'StatCard'

// ─── Stok Bar Row ─────────────────────────────────────────────────────────────
// dipisah jadi komponen agar tidak re-render seluruh list saat maxStok sama

const StokBarRow = memo(({ k, maxStok }: { k: StokKategori; maxStok: number }) => {
  const pct = maxStok > 0 ? Math.round((k.total_stok / maxStok) * 100) : 0
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{k.nama}</span>
        <span className="text-xs text-gray-400">
          {k.jumlah_produk} produk · {k.total_stok} stok
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-800 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
})
StokBarRow.displayName = 'StokBarRow'

// ─── Page Header ──────────────────────────────────────────────────────────────

const PageHeader = memo(({ title, onRefresh }: {
  title: string
  onRefresh?: () => void
}) => (
  <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div>
        <h1 className="text-[1.2rem] font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
        >  
        </button>
      )}
    </div>
  </div>
))
PageHeader.displayName = 'PageHeader'

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  const [pendapatanHari, setPendapatanHari]   = useState(0)
  const [pendapatanBulan, setPendapatanBulan] = useState(0)
  const [totalTrx, setTotalTrx]               = useState(0)
  const [produkTerlaris, setProdukTerlaris]   = useState<ProdukTerlaris[]>([])
  const [stokKategori, setStokKategori]       = useState<StokKategori[]>([])

  const [loadingStat, setLoadingStat]         = useState(true)
  const [loadingTerlaris, setLoadingTerlaris] = useState(true)
  const [loadingStok, setLoadingStok]         = useState(true)

  // ── Range WIB — tidak perlu useCallback karena tidak ada deps ─────────────
  const getWibRange = useCallback(() => {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const parts  = formatter.formatToParts(new Date())
    const year   = parts.find(p => p.type === 'year')?.value  ?? ''
    const month  = parts.find(p => p.type === 'month')?.value ?? ''
    const day    = parts.find(p => p.type === 'day')?.value   ?? ''
    const today  = `${year}-${month}-${day}`
    return {
      hariDari:    `${today}T00:00:00+07:00`,
      hariSampai:  `${today}T23:59:59+07:00`,
      bulanDari:   `${year}-${month}-01T00:00:00+07:00`,
      bulanSampai: `${today}T23:59:59+07:00`,
    }
  }, [])

  // ── Fetch semua paralel ───────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoadingStat(true)
    setLoadingTerlaris(true)
    setLoadingStok(true)

    const { hariDari, hariSampai, bulanDari, bulanSampai } = getWibRange()

    const [trxHariRes, trxBulanRes, countRes, itemRes, varianRes] = await Promise.all([
      supabase.from('transaksi').select('total')
        .eq('dibatalkan', false)
        .gte('created_at', hariDari)
        .lte('created_at', hariSampai),

      supabase.from('transaksi').select('total')
        .eq('dibatalkan', false)
        .gte('created_at', bulanDari)
        .lte('created_at', bulanSampai),

      supabase.from('transaksi')
        .select('*', { count: 'exact', head: true })
        .eq('dibatalkan', false)
        .gte('created_at', hariDari)
        .lte('created_at', hariSampai),

      supabase.from('transaksi_item')
        .select('nama_produk, jumlah, harga_satuan'),

      supabase.from('produk_varian')
        .select('stok, produk(id_kategori, kategori(nama))')
        .eq('aktif', true),
    ])

    // ── Statistik ────────────────────────────────────────────────────────────
    setPendapatanHari(trxHariRes.data?.reduce((s, t) => s + (t.total || 0), 0) ?? 0)
    setPendapatanBulan(trxBulanRes.data?.reduce((s, t) => s + (t.total || 0), 0) ?? 0)
    setTotalTrx(countRes.count ?? 0)
    setLoadingStat(false)

    // ── Produk Terlaris ───────────────────────────────────────────────────────
    if (itemRes.data) {
      const map = new Map<string, { terjual: number; pendapatan: number }>()
      for (const item of itemRes.data) {
        const prev = map.get(item.nama_produk) ?? { terjual: 0, pendapatan: 0 }
        map.set(item.nama_produk, {
          terjual:    prev.terjual    + (item.jumlah      || 0),
          pendapatan: prev.pendapatan + (item.jumlah || 0) * (item.harga_satuan || 0),
        })
      }
      setProdukTerlaris(
        Array.from(map.entries())
          .map(([nama, v]) => ({
            nama_produk:      nama,
            total_terjual:    v.terjual,
            total_pendapatan: v.pendapatan,
          }))
          .sort((a, b) => b.total_terjual - a.total_terjual)
          .slice(0, 5)
      )
    }
    setLoadingTerlaris(false)

    // ── Stok per Kategori ─────────────────────────────────────────────────────
    if (varianRes.data) {
      const map = new Map<string, { stok: number; produkIds: Set<string> }>()
      for (const v of varianRes.data as any[]) {
        const produk   = v.produk
        const katNama  = produk?.kategori?.nama
          ?? (Array.isArray(produk?.kategori) ? produk.kategori[0]?.nama : null)
          ?? 'Lainnya'
        const produkId = produk?.id_kategori ?? 'unknown'
        const prev     = map.get(katNama) ?? { stok: 0, produkIds: new Set<string>() }
        prev.stok += v.stok || 0
        prev.produkIds.add(produkId)
        map.set(katNama, prev)
      }
      setStokKategori(
        Array.from(map.entries())
          .map(([nama, v]) => ({
            nama,
            total_stok:    v.stok,
            jumlah_produk: v.produkIds.size,
          }))
          .sort((a, b) => b.total_stok - a.total_stok)
      )
    }
    setLoadingStok(false)
  }, [getWibRange])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── maxStok dihitung sekali di sini, bukan di dalam render loop ───────────
  const maxStok = useMemo(
    () => Math.max(...stokKategori.map(x => x.total_stok), 1),
    [stokKategori]
  )

  const statCards = useMemo(() => [
    {
      label: 'Pendapatan Hari Ini',
      value: formatRupiah(pendapatanHari),
      sub:   ``,
    },
    {
      label: 'Pendapatan Bulan',
      value: formatRupiah(pendapatanBulan),
      sub:  '',
    },
    {
      label: 'Transaksi Hari Ini',
      value: String(totalTrx),
      sub:   '',
    },
    {
      label: 'Kategori Produk',
      value: String(stokKategori.length),
      sub:   '',
    },
  ], [pendapatanHari, pendapatanBulan, totalTrx, stokKategori.length])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50">

      <PageHeader title="Dashboard" onRefresh={fetchAll} />

      <div className="max-w-7xl mx-auto p-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loadingStat
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : statCards.map(card => <StatCard key={card.label} {...card} />)
          }
        </div>

        {/* Terlaris + Stok */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Produk Terlaris */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Produk Terlaris</h2>
              <Link href="/owner/transaksi" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                Lihat semua →
              </Link>
            </div>

            {loadingTerlaris ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : produkTerlaris.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <p className="text-sm">Belum ada transaksi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {produkTerlaris.map((p, i) => (
                  <div key={p.nama_produk} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-400 flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.nama_produk}</p>
                      <p className="text-xs text-gray-400">{formatRupiah(p.total_pendapatan)}</p>
                    </div>
                    <span className="text-xs text-gray-500 font-medium flex-shrink-0">
                      {p.total_terjual} terjual
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stok per Kategori */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Stok per Kategori</h2>
              <Link href="/owner/produk" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                Kelola →
              </Link>
            </div>

            {loadingStok ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonBar key={i} />)}
              </div>
            ) : stokKategori.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <p className="text-sm">Belum ada produk</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stokKategori.map(k => (
                  <StokBarRow key={k.nama} k={k} maxStok={maxStok} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}