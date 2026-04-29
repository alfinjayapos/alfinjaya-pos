'use client'

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { supabaseOwner as supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Toko {
  id_toko: string
  nama_toko: string
}

interface ProdukTerlaris {
  id_varian: string
  nama_produk: string
  ukuran: string
  jenis: string
  total_terjual: number
  total_pendapatan: number
  harga_satuan: number
}

interface LogDiskon {
  id: string
  created_at: string
  nama_kasir: string
  nama_produk: string
  ukuran: string
  jenis: string
  harga_normal: number
  harga_jual: number
  diskon_nominal: number
  diskon_persen: number
  alasan: string | null
}

type Periode = 'hari' | 'bulan' | 'custom'
type Tab = 'terlaris' | 'diskon'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

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
      start: new Date(`${today}T00:00:00+07:00`).toISOString(),
      end:   new Date(`${today}T23:59:59+07:00`).toISOString(),
      label: 'Hari Ini',
    }
  }
  if (periode === 'bulan') {
    const [y, m] = month.split('-')
    const last = new Date(parseInt(y), parseInt(m), 0).getDate()
    return {
      start: new Date(`${month}-01T00:00:00+07:00`).toISOString(),
      end:   new Date(`${month}-${String(last).padStart(2, '0')}T23:59:59+07:00`).toISOString(),
      label: 'Bulan Ini',
    }
  }
  return {
    start: new Date(`${customStart}T00:00:00+07:00`).toISOString(),
    end:   new Date(`${customEnd}T23:59:59+07:00`).toISOString(),
    label: `${customStart} s/d ${customEnd}`,
  }
}

// Singkat nama toko — "Alfin Jaya 1" → "AJ1"
const singkatNamaToko = (nama: string) =>
  nama
    .split(' ')
    .map((w, i) => i === nama.split(' ').length - 1 && /^\d+$/.test(w) ? w : w[0])
    .join('')
    .toUpperCase()

// ─── Row Produk Terlaris ──────────────────────────────────────────────────────

const RowTerlaris = memo(({ item, rank }: { item: ProdukTerlaris; rank: number }) => {
  const namaVarian = [item.ukuran, item.jenis].filter(Boolean).join(' · ') || 'Default'
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <span className="w-6 text-xs font-semibold text-gray-400 text-center shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.nama_produk}</p>
        <p className="text-xs text-gray-400">{namaVarian}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">{item.total_terjual} terjual</p>
        <p className="text-xs text-gray-400">{formatRupiah(item.total_pendapatan)}</p>
      </div>
    </div>
  )
})
RowTerlaris.displayName = 'RowTerlaris'

// ─── Row Log Diskon ───────────────────────────────────────────────────────────

const RowDiskon = memo(({ log }: { log: LogDiskon }) => {
  const namaVarian = [log.ukuran, log.jenis].filter(Boolean).join(' · ') || 'Default'
  const tgl   = new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
  const waktu = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="flex items-start gap-4 px-5 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <span className="text-xs font-bold text-gray-500 shrink-0 mt-0.5 w-10">
        -{log.diskon_persen}%
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{log.nama_produk}
          <span className="text-xs font-normal text-gray-400 ml-1.5">{namaVarian}</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {log.nama_kasir} · {tgl}, {waktu}
          {log.alasan && <span className="italic"> · "{log.alasan}"</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">{formatRupiah(log.harga_jual)}</p>
        <p className="text-xs text-gray-400 line-through">{formatRupiah(log.harga_normal)}</p>
        <p className="text-xs text-gray-500">-{formatRupiah(log.diskon_nominal)}</p>
      </div>
    </div>
  )
})
RowDiskon.displayName = 'RowDiskon'

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function TokoPage() {
  const [tokoList, setTokoList]         = useState<Toko[]>([])
  const [selectedToko, setSelectedToko] = useState<string>('')
  const [tab, setTab]                   = useState<Tab>('terlaris')
  const [periode, setPeriode]           = useState<Periode>('bulan')
  const [customStart, setCustomStart]   = useState(getWIBDate)
  const [customEnd, setCustomEnd]       = useState(getWIBDate)
  const [loading, setLoading]           = useState(true)
  const [loadingData, setLoadingData]   = useState(false)
  const [terlarisList, setTerlarisList] = useState<ProdukTerlaris[]>([])
  const [diskonList, setDiskonList]     = useState<LogDiskon[]>([])
  const [openPeriode, setOpenPeriode]   = useState(false)
  const [downloading, setDownloading]   = useState(false)
  const periodeRef                      = useRef<HTMLDivElement>(null)

  // Tutup dropdown klik luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (periodeRef.current && !periodeRef.current.contains(e.target as Node))
        setOpenPeriode(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Fetch toko ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchToko = async () => {
      const { data } = await supabase.from('toko').select('id_toko, nama_toko')
      if (data) {
        setTokoList(data)
        if (data.length > 0) setSelectedToko(data[0].id_toko)
      }
      setLoading(false)
    }
    fetchToko()
  }, [])

  // ── Fetch data per tab ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!selectedToko) return
    setLoadingData(true)
    const { start, end } = getRangeUTC(periode, customStart, customEnd)

    if (tab === 'terlaris') {
      const { data } = await supabase
        .from('transaksi_item')
        .select(`
          jumlah, harga_satuan, nama_produk, id_varian,
          produk_varian(ukuran, jenis),
          transaksi!inner(id_toko, dibatalkan, created_at)
        `)
        .eq('transaksi.id_toko', selectedToko)
        .eq('transaksi.dibatalkan', false)
        .gte('transaksi.created_at', start)
        .lte('transaksi.created_at', end)

      if (data) {
        const map = new Map<string, ProdukTerlaris>()
        for (const item of data as any[]) {
          const key = item.id_varian ?? item.nama_produk
          if (map.has(key)) {
            const prev = map.get(key)!
            prev.total_terjual    += item.jumlah
            prev.total_pendapatan += item.jumlah * item.harga_satuan
          } else {
            map.set(key, {
              id_varian:        item.id_varian ?? key,
              nama_produk:      item.nama_produk,
              ukuran:           item.produk_varian?.ukuran ?? '',
              jenis:            item.produk_varian?.jenis ?? '',
              total_terjual:    item.jumlah,
              total_pendapatan: item.jumlah * item.harga_satuan,
              harga_satuan:     item.harga_satuan,
            })
          }
        }
        setTerlarisList(Array.from(map.values()).sort((a, b) => b.total_terjual - a.total_terjual))
      }

    } else {
      const { data } = await supabase
        .from('log_diskon')
        .select(`
          id, created_at,
          harga_normal, harga_jual, diskon_nominal, diskon_persen, alasan,
          karyawan(nama),
          produk_varian(ukuran, jenis),
          transaksi_item(nama_produk),
          transaksi!inner(id_toko, created_at)
        `)
        .eq('transaksi.id_toko', selectedToko)
        .gte('transaksi.created_at', start)
        .lte('transaksi.created_at', end)
        .order('created_at', { ascending: false })

      if (data) {
        setDiskonList((data as any[]).map(d => ({
          id:             d.id,
          created_at:     d.created_at,
          nama_kasir:     d.karyawan?.nama ?? '-',
          nama_produk:    d.transaksi_item?.nama_produk ?? '-',
          ukuran:         d.produk_varian?.ukuran ?? '',
          jenis:          d.produk_varian?.jenis ?? '',
          harga_normal:   d.harga_normal,
          harga_jual:     d.harga_jual,
          diskon_nominal: d.diskon_nominal,
          diskon_persen:  Number(d.diskon_persen),
          alasan:         d.alasan,
        })))
      }
    }
    setLoadingData(false)
  }, [selectedToko, tab, periode, customStart, customEnd])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Download CSV ───────────────────────────────────────────────────────────

  const handleDownloadCSV = useCallback(async () => {
    if (!selectedToko) return
    setDownloading(true)
    const { label } = getRangeUTC(periode, customStart, customEnd)
    const namaFile = `analitik_${tab}_${selectedToko}_${label.replace(/ /g, '_').replace(/\//g, '-')}.csv`

    if (tab === 'terlaris') {
      const rows = terlarisList.map((item, i) => {
        const namaVarian = [item.ukuran, item.jenis].filter(Boolean).join(' · ') || 'Default'
        return [i + 1, `"${item.nama_produk}"`, `"${namaVarian}"`, item.total_terjual, item.total_pendapatan].join(',')
      })
      const csv = '\uFEFF' + ['No,Nama Produk,Varian,Total Terjual,Total Pendapatan', ...rows].join('\n')
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
        download: namaFile,
      })
      a.click()
    } else {
      const rows = diskonList.map((log, i) => {
        const namaVarian = [log.ukuran, log.jenis].filter(Boolean).join(' · ') || 'Default'
        const tgl  = new Date(log.created_at).toLocaleDateString('id-ID')
        const waktu = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        return [i + 1, tgl, waktu, `"${log.nama_produk}"`, `"${namaVarian}"`, `"${log.nama_kasir}"`,
          log.harga_normal, log.harga_jual, log.diskon_nominal, log.diskon_persen, `"${log.alasan ?? ''}"`].join(',')
      })
      const csv = '\uFEFF' + ['No,Tanggal,Waktu,Nama Produk,Varian,Kasir,Harga Normal,Harga Jual,Diskon Nominal,Diskon %,Alasan', ...rows].join('\n')
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
        download: namaFile,
      })
      a.click()
    }
    setDownloading(false)
  }, [tab, terlarisList, diskonList, selectedToko, periode, customStart, customEnd])

  // ── Summary diskon ─────────────────────────────────────────────────────────

  const diskonSummary = useMemo(() => {
    if (!diskonList.length) return { total: 0, totalNominal: 0, rataDiskon: 0, kasirTerbanyak: '-' }
    const kasirCount = diskonList.reduce((acc, d) => {
      acc[d.nama_kasir] = (acc[d.nama_kasir] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
    return {
      total:          diskonList.length,
      totalNominal:   diskonList.reduce((s, d) => s + d.diskon_nominal, 0),
      rataDiskon:     Math.round(diskonList.reduce((s, d) => s + d.diskon_persen, 0) / diskonList.length),
      kasirTerbanyak: Object.entries(kasirCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-',
    }
  }, [diskonList])

  const { label: periodeLabel } = getRangeUTC(periode, customStart, customEnd)
  const selectedTokoNama = tokoList.find(t => t.id_toko === selectedToko)?.nama_toko ?? ''

  const periodeOptions: { id: Periode; label: string }[] = [
    { id: 'hari',   label: 'Hari Ini' },
    { id: 'bulan',  label: 'Bulan Ini' },
    { id: 'custom', label: 'Rentang Custom' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[1.2rem] font-bold text-gray-900">Analitik Toko</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={downloading || (tab === 'terlaris' ? terlarisList.length === 0 : diskonList.length === 0)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {downloading
              ? <><span className="w-3 h-3 border border-gray-400 border-t-gray-700 rounded-full animate-spin" />Mengunduh...</>
              : 'Unduh CSV'
            }
          </button>
        </div>
      </div>

      {/* ── KONTEN ── */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── FILTER BAR ── */}
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">

          {/* Chips toko */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {tokoList.map(t => (
              <button
                key={t.id_toko}
                onClick={() => setSelectedToko(t.id_toko)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                  ${selectedToko === t.id_toko
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
              >
                {singkatNamaToko(t.nama_toko)}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-gray-200 shrink-0" />

          {/* Dropdown periode */}
          <div className="relative" ref={periodeRef}>
            <button
              onClick={() => setOpenPeriode(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                ${periode !== 'bulan'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              {periodeLabel}
              <span className={`text-[10px] transition-transform duration-200 ${openPeriode ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {openPeriode && (
              <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg z-30 py-1.5 min-w-[200px]">
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
                      <input type="date" value={customStart}
                        onChange={e => setCustomStart(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Sampai</label>
                      <input type="date" value={customEnd}
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
        </div>

        {/* ── KONTEN UTAMA ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            {([
              { id: 'terlaris', label: 'Produk Terlaris' },
              { id: 'diskon',   label: 'Riwayat Diskon Kasir' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors
                  ${tab === t.id
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-400 hover:text-gray-600 bg-gray-50/50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB TERLARIS ── */}
          {tab === 'terlaris' && (
            <>
              {terlarisList.length > 0 && !loadingData && (
                <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100 bg-gray-50/40">
                  {[
                    { label: 'Terjual',    value: `${terlarisList.reduce((s, i) => s + i.total_terjual, 0)} pcs` },
                    { label: 'Pendapatan', value: formatRupiah(terlarisList.reduce((s, i) => s + i.total_pendapatan, 0)) },
                    { label: 'Varian ',   value: `${terlarisList.length} varian` },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-xl px-4 py-3 border border-gray-100">
                      <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                      <p className="text-sm font-bold text-gray-900">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {loadingData ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Memuat data...</p>
                </div>
              ) : terlarisList.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm font-medium text-gray-500">Belum ada transaksi</p>
                  <p className="text-xs text-gray-400 mt-1">{selectedTokoNama} · {periodeLabel}</p>
                </div>
              ) : (
                terlarisList.map((item, i) => (
                  <RowTerlaris key={item.id_varian} item={item} rank={i + 1} />
                ))
              )}
            </>
          )}

          {/* ── TAB DISKON ── */}
          {tab === 'diskon' && (
            <>
              {diskonList.length > 0 && !loadingData}

              {loadingData ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                  <p className="text-sm text-gray-400">Memuat data...</p>
                </div>
              ) : diskonList.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm font-medium text-gray-500">Tidak ada diskon tercatat</p>
                  <p className="text-xs text-gray-400 mt-1">{selectedTokoNama} · {periodeLabel}</p>
                </div>
              ) : (
                diskonList.map(log => (
                  <RowDiskon key={log.id} log={log} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}