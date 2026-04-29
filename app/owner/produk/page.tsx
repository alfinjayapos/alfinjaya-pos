'use client'
import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { supabaseOwner as supabase } from '@/lib/supabase'
import {
  uploadFotoProduk,
  hapusFotoProduk,
  buatPreviewLokal,
  bebaskanPreview,
  type UploadResult,
} from '@/lib/storage'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProdukVarian {
  id?: string
  id_produk?: string
  kode_sku: string
  ukuran: string
  jenis: string
  harga: number
  harga_modal: number
  stok: number
  batas_diskon_persen: number
  aktif: boolean
}

interface Produk {
  id: string
  nama: string
  deskripsi: string
  foto_url: string | null
  id_toko: string
  id_kategori: string | null
  kategori: { id: string; nama: string } | { id: string; nama: string }[] | null
  produk_varian: ProdukVarian[]
  // precomputed
  _totalStok?: number
  _hargaMulai?: number
}

interface Kategori {
  id: string
  nama: string
  id_toko: string
}

interface Toko {
  id_toko: string
  nama_toko: string
}

type FormData = {
  nama: string
  deskripsi: string
  id_toko: string
  id_kategori: string
  foto_url: string
  variants: ProdukVarian[]
}

type FilterStok = 'semua' | 'habis' | 'menipis' | 'aman'

// ─── Konstanta ────────────────────────────────────────────────────────────────
const EMPTY_VARIAN: ProdukVarian = {
  kode_sku: '',
  ukuran: '',
  jenis: '',
  harga: 0,
  harga_modal: 0,
  stok: 0,
  batas_diskon_persen: 0,
  aktif: true,
}

const EMPTY_FORM: FormData = {
  nama: '',
  deskripsi: '',
  id_toko: '',
  id_kategori: '',
  foto_url: '',
  variants: [{ ...EMPTY_VARIAN }],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

const getKatNama = (p: Produk): string => {
  if (!p.kategori) return '-'
  return Array.isArray(p.kategori) ? p.kategori[0]?.nama ?? '-' : p.kategori.nama
}

const getRingkasanStok  = (p: Produk): number => p.produk_varian?.reduce((sum, v) => sum + v.stok, 0) ?? 0
const getHargaMulai     = (p: Produk): number => {
  const list = p.produk_varian?.map(v => v.harga) ?? [0]
  return list.length ? Math.min(...list) : 0
}

const generateSKU = (nama: string, ukuran: string, jenis: string, id: string): string => {
  const base = nama.replace(/\s+/g, '').toUpperCase().slice(0, 5)
  const uk   = ukuran.replace(/\s+/g, '').toUpperCase().slice(0, 2)
  const jn   = jenis.replace(/\s+/g, '').toUpperCase().slice(0, 3)
  const uid  = id.replace(/-/g, '').toUpperCase().slice(0, 4)
  return [base, `${uk}${jn}`, uid].filter(Boolean).join('-')
}

// ─── Custom hook debounce ─────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Badge stok ───────────────────────────────────────────────────────────────
const Badge = memo(({ stok }: { stok: number }) => {
  if (stok === 0)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Habis</span>
  if (stok <= 5)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Menipis ({stok})</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{stok}</span>
})
Badge.displayName = 'Badge'

// ─── Filter Chip Dropdown ─────────────────────────────────────────────────────
interface FilterChipProps {
  label: string
  value: string
  isActive: boolean
  isOpen: boolean
  onToggle: () => void
  onClear: () => void
  children: React.ReactNode
}

const FilterChip = memo(({ label, value, isActive, isOpen, onToggle, onClear, children }: FilterChipProps) => (
  <div className="filter-box relative">
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all
        ${isActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'}`}
    >
      <span className="max-w-[140px] truncate">{isActive ? value : label}</span>
      {isActive ? (
        <span
          onClick={e => { e.stopPropagation(); onClear() }}
          className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 cursor-pointer text-xs text-white/70"
        >✕</span>
      ) : (
        <span className={`text-xs opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      )}
    </button>
    {isOpen && (
      <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 py-1 min-w-[200px]">
        <div className="max-h-52 overflow-auto">{children}</div>
      </div>
    )}
  </div>
))
FilterChip.displayName = 'FilterChip'

interface FilterItemProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  indicator?: React.ReactNode
}

const FilterItem = memo(({ selected, onClick, children, indicator }: FilterItemProps) => (
  <button
    className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors
      ${selected ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-600 hover:bg-gray-50'}`}
    onClick={onClick}
  >
    <span>{children}</span>
    {indicator}
  </button>
))
FilterItem.displayName = 'FilterItem'

// ─── Panel Varian ─────────────────────────────────────────────────────────────
interface VarianPanelProps {
  varian: ProdukVarian
  index: number
  total: number
  namaProduk: string
  produkId: string
  onChange: (index: number, field: keyof ProdukVarian, value: string | number | boolean) => void
  onRemove: (index: number) => void
  onAutoSKU: (index: number) => void
}

const VarianPanel = memo(({ varian, index, total, onChange, onRemove, onAutoSKU }: VarianPanelProps) => {
  const [expanded, setExpanded] = useState(true)
  const label    = [varian.ukuran, varian.jenis].filter(Boolean).join(' · ') || `Varian ${index + 1}`
  const skuLabel = varian.kode_sku || 'SKU belum diisi'

  // ── handlers di-memo agar tidak trigger re-render child ──────────────────
  const handleToggleAktif = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onChange(index, 'aktif', !varian.aktif) },
    [index, varian.aktif, onChange]
  )
  const handleRemove = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onRemove(index) },
    [index, onRemove]
  )
  const handleAutoSKU = useCallback(() => onAutoSKU(index), [index, onAutoSKU])

  return (
    <div className={`border rounded-xl transition-all ${varian.aktif ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="text-sm font-semibold text-gray-800 truncate">{label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium shrink-0">{skuLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleAktif}
            className={`relative rounded-full flex items-center px-0.5 transition-colors ${varian.aktif ? 'bg-green-500' : 'bg-gray-300'}`}
            style={{ width: '32px', height: '18px' }}
            title={varian.aktif ? 'Nonaktifkan' : 'Aktifkan'}
          >
            <span
              className="rounded-full bg-white shadow transition-transform"
              style={{ width: '14px', height: '14px', transform: varian.aktif ? 'translateX(14px)' : 'translateX(0px)', transition: 'transform 0.2s' }}
            />
          </button>
          {total > 1 && (
            <button onClick={handleRemove} className="text-xs text-red-400 hover:text-red-600 px-1">hapus</button>
          )}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-2.5">

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ukuran</label>
              <input
                type="text" value={varian.ukuran}
                onChange={e => onChange(index, 'ukuran', e.target.value)}
                placeholder="S / M / L / 250ml"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Jenis / Warna</label>
              <input
                type="text" value={varian.jenis}
                onChange={e => onChange(index, 'jenis', e.target.value)}
                placeholder="Hitam / Vanilla"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Kode SKU</label>
              <button onClick={handleAutoSKU} className="text-xs text-green-600 hover:text-green-700 font-medium">⟳ Generate otomatis</button>
            </div>
            <input
              type="text" value={varian.kode_sku}
              onChange={e => onChange(index, 'kode_sku', e.target.value.toUpperCase())}
              placeholder="cth: POLO-SPTIH-A1B2"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Harga Jual (Rp)</label>
              <input
                type="number" value={varian.harga || ''}
                onChange={e => onChange(index, 'harga', parseInt(e.target.value) || 0)}
                placeholder="85000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block"> Modal (Rp)</label>
              <input
                type="number" value={varian.harga_modal || ''}
                onChange={e => onChange(index, 'harga_modal', parseInt(e.target.value) || 0)}
                placeholder="55000"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Stok Awal</label>
              <input
                type="number" value={varian.stok || ''}
                onChange={e => onChange(index, 'stok', parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* ── Slider diskon — ubah max={100} untuk izinkan hingga 100% ── */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400">Max Diskon Kasir (%)</label>
              {varian.harga > 0 && varian.batas_diskon_persen > 0 && (
                <span className="text-xs text-gray-400">
                  = {formatRupiah(Math.floor(varian.harga * varian.batas_diskon_persen / 100))} max
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={0} max={50} step={1} 
                value={varian.batas_diskon_persen}
                onChange={e => onChange(index, 'batas_diskon_persen', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-semibold text-gray-700 w-10 text-right">
                {varian.batas_diskon_persen}%
              </span>
            </div>
            {varian.batas_diskon_persen === 0 && (<p className="text-xs text-gray-400 mt-0.5"></p>
              
            )}
            {varian.harga_modal > 0 && varian.harga > 0 && varian.batas_diskon_persen > 0 && (
              (() => {
                const hargaMin = varian.harga - Math.floor(varian.harga * varian.batas_diskon_persen / 100)
                const margin   = hargaMin - varian.harga_modal
                if (margin < 0)
                  return <p className="text-xs text-red-500 mt-1 font-medium">Diskon ini menyebabkan harga di bawah modal</p>
                if (margin < varian.harga_modal * 0.1)
                  return <p className="text-xs text-yellow-600 mt-1">Margin tipis — harga min: {formatRupiah(hargaMin)}</p>
                return <p className="text-xs text-green-600 mt-1">Margin aman — harga min: {formatRupiah(hargaMin)}</p>
              })()
            )}
          </div>

        </div>
      )}
    </div>
  )
}, (prev, next) =>
  // custom comparator — skip re-render jika varian & index tidak berubah
  prev.varian === next.varian &&
  prev.index  === next.index  &&
  prev.total  === next.total  &&
  prev.onChange   === next.onChange   &&
  prev.onRemove   === next.onRemove   &&
  prev.onAutoSKU  === next.onAutoSKU
)
VarianPanel.displayName = 'VarianPanel'

// ─── Modal Form ───────────────────────────────────────────────────────────────
const ModalForm = memo(({
  form, tokoList, katFiltered, editId, saving,
  onChange, onVarianChange, onVarianAdd, onVarianRemove, onVarianAutoSKU,
  onSave, onClose, onKategoriAdded,
}: {
  form: FormData
  tokoList: Toko[]
  katFiltered: Kategori[]        // ← sudah difilter dari parent
  editId: string | null
  saving: boolean
  onChange: (k: keyof Omit<FormData, 'variants'>, v: string) => void
  onVarianChange: (index: number, field: keyof ProdukVarian, value: string | number | boolean) => void
  onVarianAdd: () => void
  onVarianRemove: (index: number) => void
  onVarianAutoSKU: (index: number) => void
  onSave: () => void
  onClose: () => void
  onKategoriAdded: (k: Kategori) => void
}) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading]         = useState(false)
  const [preview, setPreview]             = useState<string>(form.foto_url)
  const [showTambahKat, setShowTambahKat] = useState(false)
  const [namaKatBaru, setNamaKatBaru]     = useState('')
  const [savingKat, setSavingKat]         = useState(false)
  const [tab, setTab]                     = useState<'info' | 'varian'>('info')

  useEffect(() => { setPreview(form.foto_url) }, [form.foto_url])

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const lokal = buatPreviewLokal(file)
    setPreview(lokal)
    setUploading(true)
    const result: UploadResult = await uploadFotoProduk(file)
    bebaskanPreview(lokal)
    if (!result.ok) {
      alert(result.error)
      setPreview(form.foto_url)
      setUploading(false)
      return
    }
    onChange('foto_url', result.url)
    setPreview(result.url)
    setUploading(false)
  }

  const hapusFotoLokal = () => {
    bebaskanPreview(preview)
    setPreview('')
    onChange('foto_url', '')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleTambahKategori = async () => {
    const nama = namaKatBaru.trim()
    if (!nama || !form.id_toko) return
    setSavingKat(true)
    const { data, error } = await supabase
      .from('kategori')
      .insert({ nama, id_toko: form.id_toko })
      .select('id, nama, id_toko')
      .single()
    if (!error && data) {
      onKategoriAdded(data as Kategori)
      onChange('id_kategori', data.id)
      setNamaKatBaru('')
      setShowTambahKat(false)
    } else {
      alert('Gagal tambah kategori')
    }
    setSavingKat(false)
  }

  const varianErrors  = form.variants.filter(v => v.harga <= 0).length
  const varianWarning = form.variants.some(v =>
    v.harga_modal > 0 &&
    v.harga - Math.floor(v.harga * v.batas_diskon_persen / 100) < v.harga_modal
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-800">{editId ? 'Edit Produk' : 'Tambah Produk'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab('info')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${tab === 'info' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}
          >Info Produk</button>
          <button
            onClick={() => setTab('varian')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${tab === 'varian' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Varian
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold
              ${varianErrors > 0 ? 'bg-red-100 text-red-600' : varianWarning ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
              {form.variants.length}
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">

          {/* ── TAB INFO ── */}
          {tab === 'info' && (
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Foto Produk</label>
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className={`relative w-full h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-all
                    ${uploading ? 'opacity-60 cursor-wait' : 'hover:border-green-400 hover:bg-green-50'}
                    ${preview ? 'border-green-400' : 'border-gray-200 bg-gray-50'}`}
                >
                  {preview ? (
                    <>
                      <img src={preview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={e => { e.stopPropagation(); hapusFotoLokal() }}
                        className="absolute top-2 right-2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-500 shadow text-xs"
                      >✕</button>
                    </>
                  ) : (
                    <div className="text-center pointer-events-none">
                      {uploading
                        ? <p className="text-xs text-gray-400">Mengupload...</p>
                        : <><p className="text-2xl mb-1">📷</p><p className="text-xs text-gray-400">Klik untuk pilih foto</p><p className="text-xs text-gray-300 mt-0.5">JPG / PNG · maks 2 MB</p></>
                      }
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nama Produk *</label>
                <input
                  value={form.nama} onChange={e => onChange('nama', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                  placeholder="cth: Baju Polo Pria"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Deskripsi</label>
                <textarea
                  value={form.deskripsi} onChange={e => onChange('deskripsi', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 resize-none"
                  placeholder="Opsional — deskripsi singkat produk"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Toko *</label>
                <select
                  value={form.id_toko} onChange={e => onChange('id_toko', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500"
                >
                  <option value="">Pilih toko...</option>
                  {tokoList.map(t => <option key={t.id_toko} value={t.id_toko}>{t.nama_toko}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">Kategori</label>
                  {form.id_toko && !showTambahKat && (
                    <button onClick={() => setShowTambahKat(true)} className="text-xs text-green-600 hover:text-green-700 font-medium">+ Kategori Baru</button>
                  )}
                </div>
                {showTambahKat && (
                  <div className="flex gap-2 mb-2">
                    <input
                      autoFocus value={namaKatBaru}
                      onChange={e => setNamaKatBaru(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleTambahKategori()
                        if (e.key === 'Escape') { setShowTambahKat(false); setNamaKatBaru('') }
                      }}
                      placeholder="cth: Sandal"
                      className="flex-1 border border-green-400 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                    <button
                      onClick={handleTambahKategori} disabled={savingKat || !namaKatBaru.trim()}
                      className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                    >{savingKat ? '...' : 'Simpan'}</button>
                    <button
                      onClick={() => { setShowTambahKat(false); setNamaKatBaru('') }}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500"
                    >Batal</button>
                  </div>
                )}
                <select
                  value={form.id_kategori} onChange={e => onChange('id_kategori', e.target.value)}
                  disabled={!form.id_toko}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 disabled:opacity-40"
                >
                  <option value="">Pilih kategori...</option>
                  {katFiltered.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              </div>

              {form.nama && form.id_toko && (
                <button
                  onClick={() => setTab('varian')}
                  className="w-full py-2.5 rounded-xl border border-dashed border-green-400 text-green-600 text-sm font-semibold hover:bg-green-50 transition-all mt-1"
                >Lanjut ke Varian →</button>
              )}
            </div>
          )}

          {/* ── TAB VARIAN ── */}
          {tab === 'varian' && (
            <div className="p-5 space-y-3">
              <div className="space-y-2">
                {form.variants.map((v, i) => (
                  <VarianPanel
                    key={i} varian={v} index={i} total={form.variants.length}
                    namaProduk={form.nama} produkId={editId ?? 'new'}
                    onChange={onVarianChange} onRemove={onVarianRemove} onAutoSKU={onVarianAutoSKU}
                  />
                ))}
              </div>
              <button
                onClick={onVarianAdd}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all"
              >+ Tambah Varian</button>

              {form.variants.length > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Varian aktif</span>
                    <span className="font-semibold text-gray-700">{form.variants.filter(v => v.aktif).length} / {form.variants.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total stok</span>
                    <span className="font-semibold text-gray-700">{form.variants.reduce((s, v) => s + (v.stok || 0), 0)} pcs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Harga terendah</span>
                    <span className="font-semibold text-gray-700">
                      {formatRupiah(Math.min(...form.variants.filter(v => v.harga > 0).map(v => v.harga).concat([0])))}
                    </span>
                  </div>
                  {varianErrors > 0 && (
                    <p className="text-red-500 font-semibold border-t border-red-100 pt-1.5 mt-1"> {varianErrors} varian belum memiliki harga jual</p>
                  )}
                  {varianWarning && varianErrors === 0 && (
                    <p className="text-yellow-600 font-semibold border-t border-yellow-100 pt-1.5 mt-1">Ada varian dengan batas diskon di bawah harga modal</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
          <button
            onClick={onSave}
            disabled={saving || uploading || !form.nama || !form.id_toko || form.variants.length === 0 || varianErrors > 0}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-all"
          >
            {saving ? 'Menyimpan...' : uploading ? 'Upload foto...' : editId ? 'Simpan Perubahan' : 'Tambah Produk'}
          </button>
        </div>
      </div>
    </div>
  )
})
ModalForm.displayName = 'ModalForm'

// ─── Halaman Utama ────────────────────────────────────────────────────────────
export default function ProdukPage() {
  const [produkList, setProdukList]     = useState<Produk[]>([])
  const [tokoList, setTokoList]         = useState<Toko[]>([])
  const [kategoriList, setKategoriList] = useState<Kategori[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [showModal, setShowModal]       = useState(false)
  const [editId, setEditId]             = useState<string | null>(null)
  const [form, setForm]                 = useState<FormData>(EMPTY_FORM)

  const [filterToko, setFilterToko]         = useState('semua')
  const [filterKategori, setFilterKategori] = useState('semua')
  const [filterStok, setFilterStok]         = useState<FilterStok>('semua')
  const [searchInput, setSearchInput]       = useState('')
  const [openBox, setOpenBox]               = useState<'toko' | 'kat' | 'stok' | null>(null)

  // debounce search 300ms
  const search = useDebounce(searchInput, 300)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [produkRes, tokoRes, katRes] = await Promise.all([
      supabase
        .from('produk')
        .select(`
          id, nama, deskripsi, foto_url, id_toko, id_kategori,
          kategori(id, nama),
          produk_varian(id, kode_sku, ukuran, jenis, harga, harga_modal, stok, batas_diskon_persen, aktif)
        `)
        .order('nama'),
      supabase.from('toko').select('id_toko, nama_toko'),
      supabase.from('kategori').select('id, nama, id_toko'),
    ])
    if (produkRes.data) setProdukList(produkRes.data as unknown as Produk[])
    if (tokoRes.data)   setTokoList(tokoRes.data)
    if (katRes.data)    setKategoriList(katRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.filter-box')) setOpenBox(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Filter + precompute sekali ────────────────────────────────────────────
  const produkFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return produkList
      .filter(p => {
        const totalStok = getRingkasanStok(p)
        if (filterToko     !== 'semua' && p.id_toko  !== filterToko)           return false
        if (filterKategori !== 'semua' && getKatNama(p) !== filterKategori)    return false
        if (filterStok === 'habis'     && totalStok !== 0)                     return false
        if (filterStok === 'menipis'   && !(totalStok > 0 && totalStok <= 5))  return false
        if (filterStok === 'aman'      && totalStok <= 5)                      return false
        if (q && !p.nama.toLowerCase().includes(q))                            return false
        return true
      })
      .map(p => ({
        ...p,
        _totalStok:  getRingkasanStok(p),   // hitung sekali, pakai di render
        _hargaMulai: getHargaMulai(p),
      }))
  }, [produkList, filterToko, filterKategori, filterStok, search])

  // ── katFiltered dihitung di parent, dikirim ke modal ─────────────────────
  const katFiltered = useMemo((): Kategori[] => {
    const source = form.id_toko
      ? kategoriList.filter(k => k.id_toko === form.id_toko)
      : []
    const seen = new Set<string>()
    return source.filter(k => {
      if (seen.has(k.nama)) return false
      seen.add(k.nama)
      return true
    })
  }, [kategoriList, form.id_toko])

  const kategoriChips = useMemo((): Kategori[] => {
    const source = filterToko === 'semua' ? kategoriList : kategoriList.filter(k => k.id_toko === filterToko)
    const seen = new Set<string>()
    return source.filter(k => {
      if (seen.has(k.nama)) return false
      seen.add(k.nama)
      return true
    })
  }, [kategoriList, filterToko])

  const handleFilterToko = useCallback((toko: string) => {
    setFilterToko(toko)
    setFilterKategori('semua')
    setOpenBox(null)
  }, [])

  const getTokoDisplay = (namaToko: string) => {
    if (namaToko === 'Alfin Jaya 1') return 'AJ1'
    if (namaToko === 'Alfin Jaya 2') return 'AJ2'
    return namaToko
  }
  const getTokoLabel  = () => filterToko     === 'semua' ? 'Semua' : tokoList.find(t => t.id_toko === filterToko)?.nama_toko ?? 'Semua'
  const getKatLabel   = () => filterKategori === 'semua' ? 'Semua' : filterKategori
  const getStokLabel  = () => ({ habis: 'Habis', menipis: 'Menipis', aman: 'Aman', semua: 'Semua' })[filterStok]

  const toggleBox   = useCallback((key: 'toko' | 'kat' | 'stok') => setOpenBox(prev => prev === key ? null : key), [])
  const clearFilter = useCallback((key: 'toko' | 'kat' | 'stok') => {
    if (key === 'toko')      handleFilterToko('semua')
    else if (key === 'kat')  setFilterKategori('semua')
    else if (key === 'stok') setFilterStok('semua')
    setOpenBox(null)
  }, [handleFilterToko])

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleChange       = useCallback((k: keyof Omit<FormData, 'variants'>, v: string) => setForm(prev => ({ ...prev, [k]: v })), [])
  const handleVarianChange = useCallback((index: number, field: keyof ProdukVarian, value: string | number | boolean) => {
    setForm(prev => {
      const variants = [...prev.variants]
      variants[index] = { ...variants[index], [field]: value }
      return { ...prev, variants }
    })
  }, [])
  const handleVarianAdd    = useCallback(() => setForm(prev => ({ ...prev, variants: [...prev.variants, { ...EMPTY_VARIAN }] })), [])
  const handleVarianRemove = useCallback((index: number) => setForm(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) })), [])
  const handleVarianAutoSKU = useCallback((index: number) => {
    setForm(prev => {
      const variants = [...prev.variants]
      const v = variants[index]
      variants[index] = { ...v, kode_sku: generateSKU(prev.nama, v.ukuran, v.jenis, editId ?? Date.now().toString()) }
      return { ...prev, variants }
    })
  }, [editId])

  // ── Modal ─────────────────────────────────────────────────────────────────
  const bukaModal = useCallback((p?: Produk) => {
    if (p) {
      setEditId(p.id)
      setForm({
        nama:        p.nama,
        deskripsi:   p.deskripsi ?? '',
        id_toko:     p.id_toko,
        id_kategori: p.id_kategori ?? '',
        foto_url:    p.foto_url ?? '',
        variants:    p.produk_varian?.length ? p.produk_varian : [{ ...EMPTY_VARIAN }],
      })
    } else {
      setEditId(null)
      setForm(EMPTY_FORM)
    }
    setShowModal(true)
  }, [])

  const tutupModal = useCallback(() => {
    setShowModal(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }, [])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!form.nama || !form.id_toko)           return
    if (form.variants.length === 0)            return alert('Tambahkan minimal 1 varian')
    if (form.variants.some(v => v.harga <= 0)) return alert('Semua varian harus memiliki harga jual')

    setSaving(true)
    const produkPayload = {
      nama:        form.nama.trim(),
      deskripsi:   form.deskripsi.trim(),
      id_toko:     form.id_toko,
      id_kategori: form.id_kategori || null,
      foto_url:    form.foto_url || null,
    }

    if (editId) {
      const varianPayload = form.variants.map(v => ({
        ...v,
        id_produk: editId,
        kode_sku: v.kode_sku || generateSKU(form.nama, v.ukuran, v.jenis, editId),
      }))
      const idVarianTersisa = form.variants.filter(v => v.id).map(v => v.id as string)

      // update produk & upsert varian paralel
      await Promise.all([
        supabase.from('produk').update(produkPayload).eq('id', editId),
        supabase.from('produk_varian').upsert(varianPayload, { onConflict: 'id' }),
      ])

      // hapus varian yang dihilangkan
      if (idVarianTersisa.length > 0) {
        await supabase
          .from('produk_varian')
          .delete()
          .eq('id_produk', editId)
          .not('id', 'in', `(${idVarianTersisa.join(',')})`)
      }
    } else {
      const { data: produkBaru, error } = await supabase
        .from('produk').insert(produkPayload).select('id').single()
      if (error || !produkBaru) {
        alert('Gagal menyimpan produk')
        setSaving(false)
        return
      }
      const varianPayload = form.variants.map(v => ({
        ...v,
        id_produk: produkBaru.id,
        kode_sku: v.kode_sku || generateSKU(form.nama, v.ukuran, v.jenis, produkBaru.id),
      }))
      await supabase.from('produk_varian').insert(varianPayload)
    }

    setSaving(false)
    tutupModal()
    fetchAll()
  }, [form, editId, tutupModal, fetchAll])

  const handleHapus = useCallback(async (id: string, nama: string, fotoUrl: string | null) => {
    if (!confirm(`Hapus produk "${nama}"? Semua variannya juga akan terhapus.`)) return
    await Promise.all([
      supabase.from('produk').delete().eq('id', id),
      fotoUrl ? hapusFotoProduk(fotoUrl) : Promise.resolve(),
    ])
    fetchAll()
  }, [fetchAll])

  const handleKategoriAdded = useCallback((k: Kategori) => {
    setKategoriList(prev => {
      const sudahAda = prev.some(x => x.nama === k.nama && x.id_toko === k.id_toko)
      return sudahAda ? prev : [...prev, k]
    })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Kelola Produk</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={() => bukaModal()}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-all active:scale-[0.97]"
          >
            <span className="text-base">+</span><span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* KONTEN */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* Search — pakai searchInput (raw), search (debounced) dipakai di filter */}
        <input
          type="text"
          placeholder="Cari produk..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 bg-white"
        />

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-3">
          <FilterChip label="Toko" value={getTokoLabel()} isActive={filterToko !== 'semua'}
            isOpen={openBox === 'toko'} onToggle={() => toggleBox('toko')} onClear={() => clearFilter('toko')}>
            <FilterItem selected={filterToko === 'semua'} onClick={() => handleFilterToko('semua')}>Semua</FilterItem>
            {tokoList.map(t => (
              <FilterItem key={t.id_toko} selected={filterToko === t.id_toko} onClick={() => handleFilterToko(t.id_toko)}>
                {getTokoDisplay(t.nama_toko)}
              </FilterItem>
            ))}
          </FilterChip>

          <FilterChip label="Kategori" value={getKatLabel()} isActive={filterKategori !== 'semua'}
            isOpen={openBox === 'kat'} onToggle={() => toggleBox('kat')} onClear={() => clearFilter('kat')}>
            <FilterItem selected={filterKategori === 'semua'} onClick={() => { setFilterKategori('semua'); setOpenBox(null) }}>Semua</FilterItem>
            {kategoriChips.map(k => (
              <FilterItem key={k.id} selected={filterKategori === k.nama} onClick={() => { setFilterKategori(k.nama); setOpenBox(null) }}>
                {k.nama}
              </FilterItem>
            ))}
          </FilterChip>

          <FilterChip label="Stok" value={getStokLabel()} isActive={filterStok !== 'semua'}
            isOpen={openBox === 'stok'} onToggle={() => toggleBox('stok')} onClear={() => clearFilter('stok')}>
            <FilterItem selected={filterStok === 'semua'}   onClick={() => { setFilterStok('semua');   setOpenBox(null) }}>Semua</FilterItem>
            <FilterItem selected={filterStok === 'habis'}   onClick={() => { setFilterStok('habis');   setOpenBox(null) }} indicator={<span className="w-2 h-2 rounded-full bg-red-500" />}>Habis</FilterItem>
            <FilterItem selected={filterStok === 'menipis'} onClick={() => { setFilterStok('menipis'); setOpenBox(null) }} indicator={<span className="w-2 h-2 rounded-full bg-yellow-500" />}>Menipis (≤5)</FilterItem>
            <FilterItem selected={filterStok === 'aman'}    onClick={() => { setFilterStok('aman');    setOpenBox(null) }} indicator={<span className="w-2 h-2 rounded-full bg-green-500" />}>Aman (&gt;5)</FilterItem>
          </FilterChip>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400"><p className="text-sm">Memuat produk...</p></div>
          ) : produkFiltered.length === 0 ? (
            <div className="py-16 text-center text-gray-400"><p className="text-3xl mb-2">📦</p><p className="text-sm">Tidak ada produk ditemukan</p></div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <div className="px-6 py-2 text-xs text-gray-400 border-b">{produkFiltered.length} produk</div>
                <div className="overflow-x-auto">
                  <div className="min-w-max md:min-w-0">
                    <div className="grid grid-cols-[minmax(200px,2fr)_minmax(150px,1fr)_minmax(100px,1fr)_minmax(80px,auto)_minmax(120px,auto)] gap-4 px-6 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-400">
                      <div>Produk</div><div>Harga Mulai</div><div>Total Stok</div><div>Varian</div><div className="text-center">Aksi</div>
                    </div>
                    <div className="max-h-[420px] overflow-auto">
                      {produkFiltered.map(p => {
                        const tokoNama = tokoList.find(t => t.id_toko === p.id_toko)?.nama_toko || p.id_toko
                        return (
                          <div key={p.id}
                            className="grid grid-cols-[minmax(200px,2fr)_minmax(150px,1fr)_minmax(100px,1fr)_minmax(80px,auto)_minmax(120px,auto)] gap-4 px-6 py-4 border-b last:border-b-0 items-center hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden text-xl">
                                {p.foto_url
                                  ? <img src={p.foto_url} alt={p.nama} loading="lazy" className="w-full h-full object-cover" />
                                  : <span>📦</span>}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-800 truncate">{p.nama}</div>
                                <div className="text-xs text-gray-400">{getKatNama(p)} · {tokoNama}</div>
                              </div>
                            </div>
                            {/* pakai _hargaMulai & _totalStok — tidak hitung ulang */}
                            <div className="text-sm font-medium text-gray-700">
                              {(p._hargaMulai ?? 0) > 0 ? `Mulai ${formatRupiah(p._hargaMulai!)}` : '-'}
                            </div>
                            <div><Badge stok={p._totalStok ?? 0} /></div>
                            <div className="text-xs text-gray-500 font-medium">{p.produk_varian?.length ?? 0} varian</div>
                            <div className="flex gap-2 justify-center">
                              <button onClick={() => bukaModal(p)} className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-all">Edit</button>
                              <button onClick={() => handleHapus(p.id, p.nama, p.foto_url)} className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 hover:border-red-400 hover:text-red-500 transition-all">Hapus</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {produkFiltered.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                      {p.foto_url
                        ? <img src={p.foto_url} alt={p.nama} loading="lazy" className="w-full h-full object-cover" />
                        : <span className="text-xl">📦</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{p.nama}</p>
                      <p className="text-xs text-gray-400">
                        {getKatNama(p)} · {tokoList.find(t => t.id_toko === p.id_toko)?.nama_toko || p.id_toko}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-gray-700">
                          {(p._hargaMulai ?? 0) > 0 ? `Mulai ${formatRupiah(p._hargaMulai!)}` : '-'}
                        </span>
                        <Badge stok={p._totalStok ?? 0} />
                        <span className="text-xs text-gray-400">{p.produk_varian?.length ?? 0} varian</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => bukaModal(p)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-all">Edit</button>
                      <button onClick={() => handleHapus(p.id, p.nama, p.foto_url)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-500 transition-all">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ModalForm
          form={form} tokoList={tokoList} katFiltered={katFiltered}
          editId={editId} saving={saving}
          onChange={handleChange}
          onVarianChange={handleVarianChange}
          onVarianAdd={handleVarianAdd}
          onVarianRemove={handleVarianRemove}
          onVarianAutoSKU={handleVarianAutoSKU}
          onSave={handleSave} onClose={tutupModal}
          onKategoriAdded={handleKategoriAdded}
        />
      )}
    </div>
  )
}