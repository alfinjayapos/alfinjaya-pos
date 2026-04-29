'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabaseOwner as supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaksi {
  total: number
  metode_bayar: string
  created_at: string
  id_toko: string
}

interface Pengeluaran {
  id: string
  jumlah: number
  keterangan: string
  kategori: string
  id_toko: string
  created_at: string
}

type Periode  = 'hari' | 'minggu' | 'bulan'
type TabAktif = 'ringkasan' | 'pengeluaran'

// ─── Konstanta ────────────────────────────────────────────────────────────────

const formatRupiah  = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const formatTanggal = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const formatWaktu = (s: string) =>
  new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

const KATEGORI_PENGELUARAN = [
  'Operasional', 'Gaji', 'Belanja Stok', 'Transport', 'Listrik & Air', 'Lainnya',
]

const LABEL_PERIODE: Record<Periode, string> = {
  hari: 'Hari Ini',
  minggu: 'Minggu Ini',
  bulan: 'Bulan Ini',
}

// ─── Modal Konfirmasi ─────────────────────────────────────────────────────────

const ModalKonfirmasi = memo(({
  pesan, onYa, onTidak, loading,
}: {
  pesan: string; onYa: () => void; onTidak: () => void; loading: boolean
}) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.5)' }}>
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
      <div className="p-6 text-center">
        <p className="font-bold text-gray-800 mb-1">Hapus Pengeluaran?</p>
        <p className="text-sm text-gray-500">{pesan}</p>
      </div>
      <div className="flex border-t border-gray-100">
        <button onClick={onTidak} disabled={loading}
          className="flex-1 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all border-r border-gray-100"
        >Batal</button>
        <button onClick={onYa} disabled={loading}
          className="flex-1 py-4 text-sm font-bold text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
        >{loading ? 'Menghapus...' : 'Ya, Hapus'}</button>
      </div>
    </div>
  </div>
))
ModalKonfirmasi.displayName = 'ModalKonfirmasi'

// ─── Modal Notif ──────────────────────────────────────────────────────────────

const ModalNotif = memo(({
  pesan, tipe, onClose,
}: {
  pesan: string; tipe: 'error' | 'sukses'; onClose: () => void
}) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.5)' }}>
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
      <div className="p-6 text-center">
        <p className="font-bold text-gray-800 mb-1">
          {tipe === 'sukses' ? 'Berhasil!' : 'Gagal'}
        </p>
        <p className="text-sm text-gray-500">{pesan}</p>
      </div>
      <div className="border-t border-gray-100">
        <button onClick={onClose}
          className="w-full py-4 text-sm font-bold text-gray-800 hover:bg-gray-50 transition-all"
        >OK</button>
      </div>
    </div>
  </div>
))
ModalNotif.displayName = 'ModalNotif'

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function KeuanganPage() {
  const [periode, setPeriode]         = useState<Periode>('hari')
  const [tabAktif, setTabAktif]       = useState<TabAktif>('ringkasan')
  const [filterToko, setFilterToko]   = useState('semua')
  const [tokoList, setTokoList]       = useState<{ id_toko: string; nama_toko: string }[]>([])
  const [transaksiList, setTrxList]   = useState<Transaksi[]>([])
  const [pengeluaranList, setPenList] = useState<Pengeluaran[]>([])
  const [loading, setLoading]         = useState(true)

  const [showForm, setShowForm]   = useState(false)
  const [fJumlah, setFJumlah]     = useState('')
  const [fKet, setFKet]           = useState('')
  const [fKat, setFKat]           = useState('Operasional')
  const [fToko, setFToko]         = useState('')
  const [saving, setSaving]       = useState(false)

  const [hapusTarget, setHapusTarget]   = useState<Pengeluaran | null>(null)
  const [hapusLoading, setHapusLoading] = useState(false)
  const [notif, setNotif]               = useState<{ pesan: string; tipe: 'error' | 'sukses' } | null>(null)

  // ── Rentang tanggal (WIB) ─────────────────────────────────────────────────

  const rentang = useMemo(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    const hariIniWIB = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}`

    if (periode === 'hari') {
      return { dari: `${hariIniWIB}T00:00:00+07:00`, sampai: `${hariIniWIB}T23:59:59+07:00` }
    }
    if (periode === 'minggu') {
      const hariAngka = wib.getUTCDay()
      const selisih   = hariAngka === 0 ? 6 : hariAngka - 1
      const senin     = new Date(wib.getTime() - selisih * 24 * 60 * 60 * 1000)
      const seninStr  = `${senin.getUTCFullYear()}-${pad(senin.getUTCMonth() + 1)}-${pad(senin.getUTCDate())}`
      return { dari: `${seninStr}T00:00:00+07:00`, sampai: `${hariIniWIB}T23:59:59+07:00` }
    }
    const bulanStr = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}`
    return { dari: `${bulanStr}-01T00:00:00+07:00`, sampai: `${hariIniWIB}T23:59:59+07:00` }
  }, [periode])

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [tokoRes, trxRes, penRes] = await Promise.all([
      supabase.from('toko').select('id_toko, nama_toko'),
      supabase.from('transaksi')
        .select('total, metode_bayar, created_at, id_toko')
        .gte('created_at', rentang.dari)
        .lte('created_at', rentang.sampai)
        .order('created_at', { ascending: false }),
      supabase.from('pengeluaran')
        .select('id, jumlah, keterangan, kategori, id_toko, created_at')
        .gte('created_at', rentang.dari)
        .lte('created_at', rentang.sampai)
        .order('created_at', { ascending: false }),
    ])
    if (tokoRes.data) {
      setTokoList(tokoRes.data)
      setFToko(prev => prev || tokoRes.data![0]?.id_toko || '')
    }
    if (trxRes.data) setTrxList(trxRes.data)
    if (penRes.data) setPenList(penRes.data)
    setLoading(false)
  }, [rentang])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Kalkulasi ─────────────────────────────────────────────────────────────

  const { pendapatan, pengeluaran, laba } = useMemo(() => {
    const filtered = filterToko === 'semua'
      ? transaksiList : transaksiList.filter(t => t.id_toko === filterToko)
    const pen = filterToko === 'semua'
      ? pengeluaranList : pengeluaranList.filter(p => p.id_toko === filterToko)

    const pendapatan  = filtered.reduce((s, t) => s + t.total, 0)
    const pengeluaran = pen.reduce((s, p) => s + p.jumlah, 0)

    return { pendapatan, pengeluaran, laba: pendapatan - pengeluaran }
  }, [transaksiList, pengeluaranList, filterToko])

  const penListFiltered = useMemo(() =>
    filterToko === 'semua' ? pengeluaranList : pengeluaranList.filter(p => p.id_toko === filterToko),
    [pengeluaranList, filterToko]
  )

  const trxFiltered = useMemo(() =>
    filterToko === 'semua' ? transaksiList : transaksiList.filter(t => t.id_toko === filterToko),
    [transaksiList, filterToko]
  )

  // ── Simpan & Hapus ────────────────────────────────────────────────────────

  const handleSavePen = useCallback(async () => {
    if (!fJumlah || !fKet || !fToko) return
    setSaving(true)
    const { error } = await supabase.from('pengeluaran').insert({
      jumlah: parseInt(fJumlah), keterangan: fKet.trim(), kategori: fKat, id_toko: fToko,
    })
    setSaving(false)
    if (error) { setNotif({ pesan: error.message, tipe: 'error' }); return }
    setFJumlah(''); setFKet(''); setShowForm(false)
    setNotif({ pesan: 'Pengeluaran berhasil dicatat!', tipe: 'sukses' })
    fetchData()
  }, [fJumlah, fKet, fKat, fToko, fetchData])

  const handleHapusPen = useCallback(async () => {
    if (!hapusTarget) return
    setHapusLoading(true)
    const { error } = await supabase.from('pengeluaran').delete().eq('id', hapusTarget.id)
    setHapusLoading(false)
    setHapusTarget(null)
    if (error) { setNotif({ pesan: error.message, tipe: 'error' }); return }
    fetchData()
  }, [hapusTarget, fetchData])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Laporan Keuangan</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-all">
            <span className="text-base">+</span>
            <span>Pengeluaran</span>
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">

        {/* ── FILTER PERIODE & TOKO — satu baris ── */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Dropdown periode */}
          <select
            value={periode}
            onChange={e => setPeriode(e.target.value as Periode)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer"
            style={{
              appearance: 'none',
              paddingRight: '28px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 9px center',
            }}
          >
            {(['hari', 'minggu', 'bulan'] as Periode[]).map(p => (
              <option key={p} value={p}>{LABEL_PERIODE[p]}</option>
            ))}
          </select>

          <span className="text-gray-300 text-sm select-none">·</span>

          {/* Filter Toko */}
          {['semua', ...tokoList.map(t => t.id_toko)].map(t => (
            <button key={t} onClick={() => setFilterToko(t)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                ${filterToko === t
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'}`}>
              {t === 'semua' ? 'Semua Toko' : t}
            </button>
          ))}
        </div>

        {/* ── KARTU RINGKASAN ── */}
        <div className="grid grid-cols-2 gap-3">

          {/* Pendapatan */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 col-span-2">
            <p className="text-xs text-gray-400 font-medium mb-1">Pendapatan {LABEL_PERIODE[periode]}</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{formatRupiah(pendapatan)}</p>
            <p className="text-xs text-gray-400">{trxFiltered.length} transaksi</p>
          </div>

          {/* Pengeluaran */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-medium mb-1">Pengeluaran</p>
            <p className="text-lg font-bold text-red-500">{formatRupiah(pengeluaran)}</p>
            <p className="text-xs text-gray-400 mt-1">{penListFiltered.length} catatan</p>
          </div>

          {/* Laba */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-medium mb-1">Laba Bersih</p>
            <p className={`text-lg font-bold ${laba >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
              {formatRupiah(laba)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{laba >= 0 ? '▲ Surplus' : '▼ Defisit'}</p>
          </div>
        </div>

        {/* ── TAB ── */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
          {(['ringkasan', 'pengeluaran'] as TabAktif[]).map(t => (
            <button key={t} onClick={() => setTabAktif(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                ${tabAktif === t ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'ringkasan' ? 'Transaksi' : 'Pengeluaran'}
            </button>
          ))}
        </div>

        {/* ── KONTEN TAB ── */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Memuat data...</p>
          </div>
        ) : tabAktif === 'ringkasan' ? (

          /* Tab Transaksi */
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{trxFiltered.length} Transaksi</p>
              <p className="text-sm font-bold text-gray-700">{formatRupiah(pendapatan)}</p>
            </div>
            {trxFiltered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-sm font-medium">Belum ada transaksi</p>
                <p className="text-xs mt-1">pada periode {LABEL_PERIODE[periode].toLowerCase()}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {trxFiltered.map((t, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{formatRupiah(t.total)}</p>
                      <p className="text-xs text-gray-400 capitalize">{t.metode_bayar} · {t.id_toko}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{formatTanggal(t.created_at)}</p>
                      <p className="text-xs text-gray-300">{formatWaktu(t.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : (

          /* Tab Pengeluaran */
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">{penListFiltered.length} Pengeluaran</p>
              <p className="text-sm font-bold text-red-500">{formatRupiah(pengeluaran)}</p>
            </div>
            {penListFiltered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-sm font-medium">Belum ada pengeluaran</p>
                <button onClick={() => setShowForm(true)}
                  className="mt-3 text-xs font-semibold text-gray-900 underline">
                  + Catat sekarang
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                {penListFiltered.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.keterangan}</p>
                      <p className="text-xs text-gray-400">{p.kategori} · {p.id_toko} · {formatTanggal(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold text-red-500">{formatRupiah(p.jumlah)}</p>
                      <button onClick={() => setHapusTarget(p)}
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-400 text-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL CATAT PENGELUARAN ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Catat Pengeluaran</h3>
                <p className="text-xs text-gray-400 mt-0.5">Tambah catatan pengeluaran toko</p>
              </div>
              <button onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Jumlah */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Jumlah
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">Rp</span>
                  <input type="number" value={fJumlah}
                    onChange={e => setFJumlah(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-3 text-sm font-semibold focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  Keterangan
                </label>
                <input value={fKet} onChange={e => setFKet(e.target.value)}
                  placeholder="cth: Beli kantong plastik"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100" />
              </div>

              {/* Kategori & Toko */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                    Kategori
                  </label>
                  <select value={fKat} onChange={e => setFKat(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-gray-400 bg-white">
                    {KATEGORI_PENGELUARAN.map(k => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                    Toko
                  </label>
                  <select value={fToko} onChange={e => setFToko(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-gray-400 bg-white">
                    {tokoList.map(t => (
                      <option key={t.id_toko} value={t.id_toko}>{t.nama_toko}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                Batal
              </button>
              <button onClick={handleSavePen}
                disabled={saving || !fJumlah || !fKet}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-700 disabled:opacity-40 transition-all">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {hapusTarget && (
        <ModalKonfirmasi
          pesan={`"${hapusTarget.keterangan}" · ${formatRupiah(hapusTarget.jumlah)}`}
          onYa={handleHapusPen}
          onTidak={() => setHapusTarget(null)}
          loading={hapusLoading}
        />
      )}

      {notif && (
        <ModalNotif
          pesan={notif.pesan}
          tipe={notif.tipe}
          onClose={() => setNotif(null)}
        />
      )}
    </div>
  )
}