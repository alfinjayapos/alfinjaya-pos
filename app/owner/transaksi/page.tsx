'use client'

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { supabaseOwner as supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransaksiItem {
  nama_produk: string
  jumlah: number
  harga_satuan: number
  id_produk: string | null
  id_varian: string | null
}

interface Transaksi {
  id: string
  total: number
  metode_bayar: string
  created_at: string
  id_toko: string
  dibatalkan: boolean
  karyawan: { nama: string } | null
  transaksi_item: TransaksiItem[]
}

type Periode = 'hari' | 'bulan' | 'custom'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah  = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const formatTanggal = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const formatWaktu   = (s: string) =>
  new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
const getNamaKasir  = (trx: Transaksi) => (trx.karyawan as any)?.nama ?? '-'

const getWIBDate = () => {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return wib.toISOString().split('T')[0]
}

const getWIBMonth = () => {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return wib.toISOString().slice(0, 7)
}

const getRangeUTC = (periode: Periode, customStart: string, customEnd: string) => {
  const today = getWIBDate()
  const month = getWIBMonth()
  if (periode === 'hari') {
    return {
      start:    new Date(`${today}T00:00:00+07:00`).toISOString(),
      end:      new Date(`${today}T23:59:59+07:00`).toISOString(),
      label:    today,
      namaFile: `transaksi_${today}.csv`,
    }
  }
  if (periode === 'bulan') {
    const [y, m] = month.split('-')
    const last = new Date(parseInt(y), parseInt(m), 0).getDate()
    return {
      start:    new Date(`${month}-01T00:00:00+07:00`).toISOString(),
      end:      new Date(`${month}-${String(last).padStart(2, '0')}T23:59:59+07:00`).toISOString(),
      label:    month,
      namaFile: `transaksi_${month}.csv`,
    }
  }
  return {
    start:    new Date(`${customStart}T00:00:00+07:00`).toISOString(),
    end:      new Date(`${customEnd}T23:59:59+07:00`).toISOString(),
    label:    `${customStart} s/d ${customEnd}`,
    namaFile: `transaksi_${customStart}_sd_${customEnd}.csv`,
  }
}

// ─── Badge Metode ─────────────────────────────────────────────────────────────

const BadgeMetode = memo(({ metode }: { metode: string }) => (
  <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-200 capitalize">
    {metode}
  </span>
))
BadgeMetode.displayName = 'BadgeMetode'

// ─── Row Tabel Desktop ────────────────────────────────────────────────────────

const RowTrx = memo(({ trx, onClick, aktif }: {
  trx: Transaksi; onClick: () => void; aktif: boolean
}) => (
  <tr
    onClick={onClick}
    className={`border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50
      ${trx.dibatalkan ? 'opacity-50' : aktif ? 'bg-gray-50' : ''}`}
  >
    <td className="px-6 py-4">
      <p className="text-xs text-gray-600">{formatTanggal(trx.created_at)}</p>
      <p className="text-xs text-gray-400">{formatWaktu(trx.created_at)}</p>
    </td>
    <td className="px-6 py-4">
      <p className={`text-sm font-semibold ${trx.dibatalkan ? 'line-through text-gray-400' : 'text-gray-900'}`}>
        {formatRupiah(trx.total)}
      </p>
      <p className="text-xs text-gray-400">{trx.transaksi_item.length} item</p>
    </td>
    <td className="px-6 py-4"><BadgeMetode metode={trx.metode_bayar} /></td>
    <td className="px-6 py-4 text-sm text-gray-700">{getNamaKasir(trx)}</td>
    <td className="px-6 py-4 text-sm text-gray-600">{trx.id_toko}</td>
    <td className="px-6 py-4">
      {trx.dibatalkan ? (
        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-50 text-red-600 border border-red-200">Dibatalkan</span>
      ) : (
        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">Berhasil</span>
      )}
    </td>
  </tr>
))
RowTrx.displayName = 'RowTrx'

// ─── Card Mobile ──────────────────────────────────────────────────────────────

const CardTrx = memo(({ trx, onClick, aktif }: {
  trx: Transaksi; onClick: () => void; aktif: boolean
}) => (
  <div
    onClick={onClick}
    className={`px-5 py-4 border-b border-gray-100 cursor-pointer transition-colors active:bg-gray-50
      ${trx.dibatalkan ? 'opacity-50' : aktif ? 'bg-gray-50' : ''}`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <BadgeMetode metode={trx.metode_bayar} />
          {trx.dibatalkan ? (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">Dibatalkan</span>
          ) : (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">Berhasil</span>
          )}
        </div>
        <p className={`text-base font-semibold ${trx.dibatalkan ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {formatRupiah(trx.total)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {getNamaKasir(trx)} · {trx.id_toko} · {trx.transaksi_item.length} item
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-gray-500">{formatTanggal(trx.created_at)}</p>
        <p className="text-xs text-gray-400">{formatWaktu(trx.created_at)}</p>
        <p className="text-xs text-gray-400 mt-2">Lihat detail →</p>
      </div>
    </div>
  </div>
))
CardTrx.displayName = 'CardTrx'

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = memo(({ trx, membatalkan, onBatalkan, onClose }: {
  trx: Transaksi; membatalkan: boolean; onBatalkan: () => void; onClose: () => void
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50"
    onClick={e => { if (e.target === e.currentTarget) onClose() }}
  >
    <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
      <div className="flex justify-center pt-3 pb-1 md:hidden">
        <div className="w-10 h-1 rounded-full bg-gray-200" />
      </div>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Detail Transaksi</h3>
          <p className="text-xs text-gray-400 mt-0.5">{formatTanggal(trx.created_at)} · {formatWaktu(trx.created_at)}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Kasir',  value: getNamaKasir(trx) },
            { label: 'Toko',   value: trx.id_toko },
            { label: 'Metode', value: trx.metode_bayar.toUpperCase() },
            { label: 'Total',  value: formatRupiah(trx.total) },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-gray-800 truncate">{item.value}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Item yang dibeli</p>
          <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden border border-gray-100">
            {trx.transaksi_item.map((item, i) => (
              <div key={i} className="flex justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.nama_produk}</p>
                  <p className="text-xs text-gray-400">{formatRupiah(item.harga_satuan)} × {item.jumlah}</p>
                </div>
                <p className="text-sm font-semibold text-gray-800">{formatRupiah(item.harga_satuan * item.jumlah)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
          <span className="font-semibold text-gray-800">Total</span>
          <span className={`text-xl font-bold ${trx.dibatalkan ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {formatRupiah(trx.total)}
          </span>
        </div>
        {!trx.dibatalkan ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">Batalkan transaksi</p>
            <p className="text-xs text-red-600 mb-3">Stok produk akan dikembalikan. Tindakan ini tidak dapat dibatalkan.</p>
            <button
              onClick={onBatalkan}
              disabled={membatalkan}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {membatalkan ? 'Membatalkan...' : 'Batalkan & Kembalikan Stok'}
            </button>
          </div>
        ) : (
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Transaksi ini sudah dibatalkan dan stok telah dikembalikan.</p>
          </div>
        )}
      </div>
    </div>
  </div>
))
DetailModal.displayName = 'DetailModal'

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function TransaksiPage() {
  const [transaksiList, setTrxList]     = useState<Transaksi[]>([])
  const [tokoList, setTokoList]         = useState<{ id_toko: string; nama_toko: string }[]>([])
  const [loading, setLoading]           = useState(true)
  const [membatalkan, setMembatalkan]   = useState(false)
  const [filterToko, setFilterToko]     = useState('semua')
  const [filterMetode, setFilterMetode] = useState('semua')
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'batal'>('semua')
  const [search, setSearch]             = useState('')
  const [selectedTrx, setSelectedTrx]   = useState<Transaksi | null>(null)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [openFilter, setOpenFilter]     = useState<string | null>(null)
  const [downloading, setDownloading]   = useState(false)

  // ── State periode ─────────────────────────────────────────────────────────
  const [periode, setPeriode]         = useState<Periode>('hari')
  const [customStart, setCustomStart] = useState(getWIBDate)
  const [customEnd, setCustomEnd]     = useState(getWIBDate)
  const [openPeriode, setOpenPeriode] = useState(false)
  const periodeRef                    = useRef<HTMLDivElement>(null)

  // Tutup dropdown periode klik luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (periodeRef.current && !periodeRef.current.contains(e.target as Node))
        setOpenPeriode(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const range = useMemo(
    () => getRangeUTC(periode, customStart, customEnd),
    [periode, customStart, customEnd]
  )

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [tokoRes, trxRes] = await Promise.all([
      supabase.from('toko').select('id_toko, nama_toko'),
      supabase
        .from('transaksi')
        .select('id, total, metode_bayar, created_at, id_toko, dibatalkan, karyawan(nama), transaksi_item(nama_produk, jumlah, harga_satuan, id_produk, id_varian)')
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false }),
    ])
    if (tokoRes.data) setTokoList(tokoRes.data)
    if (trxRes.data) setTrxList(trxRes.data as unknown as Transaksi[])
    setLoading(false)
  }, [range.start, range.end])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!selectedTrx) return
    const updated = transaksiList.find(t => t.id === selectedTrx.id)
    if (updated) setSelectedTrx(updated)
  }, [transaksiList])

  // ── Filter lokal ──────────────────────────────────────────────────────────

  const trxFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return transaksiList.filter(t => {
      if (filterToko !== 'semua' && t.id_toko !== filterToko) return false
      if (filterMetode !== 'semua' && t.metode_bayar !== filterMetode) return false
      if (filterStatus === 'aktif' && t.dibatalkan) return false
      if (filterStatus === 'batal' && !t.dibatalkan) return false
      if (q && !getNamaKasir(t).toLowerCase().includes(q)) return false
      return true
    })
  }, [transaksiList, filterToko, filterMetode, filterStatus, search])

  const stats = useMemo(() => {
    const aktif = trxFiltered.filter(t => !t.dibatalkan)
    return {
      total:  aktif.reduce((s, t) => s + t.total, 0),
      jumlah: aktif.length,
      batal:  trxFiltered.filter(t => t.dibatalkan).length,
    }
  }, [trxFiltered])

  // ── Batalkan ──────────────────────────────────────────────────────────────

  const confirmBatalkan = useCallback(async () => {
    if (!selectedTrx) return
    setShowConfirm(false)
    setMembatalkan(true)
    await supabase.from('transaksi').update({ dibatalkan: true }).eq('id', selectedTrx.id)
    await Promise.all(
      selectedTrx.transaksi_item
        .filter(item => item.id_varian)
        .map(item => supabase.rpc('kembalikan_stok_varian', { p_id_varian: item.id_varian, p_jumlah: item.jumlah }))
    )
    await Promise.all(
      selectedTrx.transaksi_item
        .filter(item => item.id_varian)
        .map(item => supabase.from('log_stok').insert({
          id_produk:  item.id_produk,
          id_varian:  item.id_varian,
          perubahan:  item.jumlah,
          keterangan: `Pembatalan transaksi ${selectedTrx.id.slice(0, 8)}`,
        }))
    )
    setMembatalkan(false)
    setSelectedTrx(null)
    fetchData()
  }, [selectedTrx, fetchData])

  // ── Download CSV ──────────────────────────────────────────────────────────

  const buildCsv = (data: Transaksi[]) => {
    const header = ['No', 'Tanggal', 'Waktu', 'ID Transaksi', 'Kasir', 'Toko', 'Metode Bayar', 'Item Produk', 'Total', 'Status'].join(',')
    const rows = data.map((trx, idx) => [
      idx + 1,
      `"${formatTanggal(trx.created_at)}"`,
      formatWaktu(trx.created_at),
      trx.id,
      `"${getNamaKasir(trx)}"`,
      trx.id_toko,
      trx.metode_bayar,
      `"${trx.transaksi_item.map(i => `${i.nama_produk} x${i.jumlah}`).join(' | ')}"`,
      trx.total,
      trx.dibatalkan ? 'Dibatalkan' : 'Berhasil',
    ].join(','))
    return '\uFEFF' + [header, ...rows].join('\n')
  }

  const triggerDownload = (csv: string, namaFile: string) => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: namaFile,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleDownloadCSV = useCallback(() => {
    if (trxFiltered.length === 0) return
    setDownloading(true)
    triggerDownload(buildCsv(trxFiltered), range.namaFile)
    setDownloading(false)
  }, [trxFiltered, range.namaFile])

  // ── Label filter ──────────────────────────────────────────────────────────

  const labelToko   = filterToko   === 'semua' ? 'Semua Toko' : tokoList.find(t => t.id_toko === filterToko)?.nama_toko ?? filterToko
  const labelMetode = filterMetode === 'semua' ? 'Metode'     : filterMetode.charAt(0).toUpperCase() + filterMetode.slice(1)
  const labelStatus = filterStatus === 'semua' ? 'Status'     : filterStatus === 'aktif' ? 'Berhasil' : 'Batal'

  const toggleFilter = (key: string) => setOpenFilter(prev => prev === key ? null : key)

  const periodeOptions: { id: Periode; label: string }[] = [
    { id: 'hari',   label: 'Hari Ini' },
    { id: 'bulan',  label: 'Bulan Ini' },
    { id: 'custom', label: 'Rentang Custom' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => setOpenFilter(null)}>

      {/* ── STICKY HEADER ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Log Transaksi</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={downloading || trxFiltered.length === 0}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {downloading
              ? <><span className="w-3 h-3 border border-gray-400 border-t-gray-700 rounded-full animate-spin" />Mengunduh...</>
              : 'Unduh CSV'
            }
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">

        {/* ── FILTER ── */}
        <div className="space-y-3" onClick={e => e.stopPropagation()}>

          {/* Baris 1: Dropdown periode */}
          <div ref={periodeRef} className="relative inline-block w-full md:w-auto">
            <button
              onClick={() => setOpenPeriode(p => !p)}
              className="w-full md:w-auto border border-gray-200 bg-white rounded-xl px-4 py-2.5 text-sm text-left focus:outline-none focus:border-gray-400 flex items-center justify-between gap-3 md:min-w-[220px]"
            >
              <span className={periode !== 'hari' ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                {range.label}
              </span>
              <span className={`text-xs text-gray-400 transition-transform duration-200 ${openPeriode ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {openPeriode && (
              <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-lg z-30 py-1.5 min-w-[220px]">
                {periodeOptions.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPeriode(p.id); if (p.id !== 'custom') setOpenPeriode(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors
                      ${periode === p.id ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {p.label}
                    {periode === p.id && <span className="text-xs text-gray-400">✓</span>}
                  </button>
                ))}
                {periode === 'custom' && (
                  <div className="px-4 pt-2 pb-3 space-y-2 border-t border-gray-100 mt-1">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Dari</label>
                      <input
                        type="date" value={customStart}
                        onChange={e => setCustomStart(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Sampai</label>
                      <input
                        type="date" value={customEnd}
                        onChange={e => setCustomEnd(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-gray-400"
                      />
                    </div>
                    <button
                      onClick={() => setOpenPeriode(false)}
                      className="w-full py-1.5 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-gray-700 transition-colors"
                    >
                      Terapkan
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Baris 2: Filter toko, metode, status */}
          <div className="flex flex-wrap gap-2">

            {/* Filter Toko */}
            <div className="relative">
              <button
                onClick={() => toggleFilter('toko')}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5
                  ${filterToko !== 'semua' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}`}
              >
                {labelToko}<span className="text-xs opacity-60">▾</span>
              </button>
              {openFilter === 'toko' && (
                <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48 z-30">
                  {[{ id: 'semua', nama: 'Semua Toko' }, ...tokoList.map(t => ({ id: t.id_toko, nama: t.nama_toko }))].map(t => (
                    <button key={t.id} onClick={() => { setFilterToko(t.id); setOpenFilter(null) }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors ${filterToko === t.id ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {t.nama}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Metode */}
            <div className="relative">
              <button
                onClick={() => toggleFilter('metode')}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5
                  ${filterMetode !== 'semua' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}`}
              >
                {labelMetode}<span className="text-xs opacity-60">▾</span>
              </button>
              {openFilter === 'metode' && (
                <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40 z-30">
                  {[{ id: 'semua', label: 'Metode' }, { id: 'tunai', label: 'Tunai' }, { id: 'qris', label: 'QRIS' }, { id: 'transfer', label: 'Transfer' }].map(m => (
                    <button key={m.id} onClick={() => { setFilterMetode(m.id); setOpenFilter(null) }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors ${filterMetode === m.id ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Status */}
            <div className="relative">
              <button
                onClick={() => toggleFilter('status')}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5
                  ${filterStatus !== 'semua' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}`}
              >
                {labelStatus}<span className="text-xs opacity-60">▾</span>
              </button>
              {openFilter === 'status' && (
                <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40 z-30">
                  {[{ id: 'semua', label: 'Status' }, { id: 'aktif', label: 'Berhasil' }, { id: 'batal', label: 'Batal' }].map(s => (
                    <button key={s.id} onClick={() => { setFilterStatus(s.id as any); setOpenFilter(null) }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors ${filterStatus === s.id ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── STAT MINI ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pendapatan',         value: formatRupiah(stats.total), warna: 'text-gray-900' },
            { label: 'Transaksi Berhasil', value: `${stats.jumlah}x`,        warna: 'text-gray-900' },
            { label: 'Dibatalkan',         value: `${stats.batal}x`,          warna: stats.batal > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
              <p className={`text-sm font-bold ${s.warna}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── LIST ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Memuat transaksi...</p>
            </div>
          ) : trxFiltered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-gray-500">Tidak ada transaksi ditemukan</p>
              <p className="text-xs text-gray-400 mt-1">Coba ubah filter atau periode</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Waktu', 'Total', 'Metode', 'Kasir', 'Toko', 'Status'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trxFiltered.map(trx => (
                      <RowTrx key={trx.id} trx={trx} aktif={selectedTrx?.id === trx.id} onClick={() => setSelectedTrx(trx)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-100">
                {trxFiltered.map(trx => (
                  <CardTrx key={trx.id} trx={trx} aktif={selectedTrx?.id === trx.id} onClick={() => setSelectedTrx(trx)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── DETAIL MODAL ── */}
      {selectedTrx && (
        <DetailModal
          trx={selectedTrx}
          membatalkan={membatalkan}
          onBatalkan={() => setShowConfirm(true)}
          onClose={() => setSelectedTrx(null)}
        />
      )}

      {/* ── KONFIRMASI BATALKAN ── */}
      {showConfirm && selectedTrx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <p className="text-base font-semibold text-gray-900 mb-1">Batalkan transaksi ini?</p>
              <p className="text-sm text-gray-500 leading-relaxed">Stok semua produk akan dikembalikan ke inventory. Tindakan ini tidak dapat diurungkan.</p>
            </div>
            <div className="border-t border-gray-100 flex text-sm font-semibold">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 text-gray-600 hover:bg-gray-50 border-r border-gray-100 transition-colors">Batal</button>
              <button onClick={confirmBatalkan} disabled={membatalkan} className="flex-1 py-4 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
                {membatalkan ? 'Memproses...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}