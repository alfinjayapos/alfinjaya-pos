'use client'

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import NotaModal, { DataNota } from './NotaModal'

// ─── Types ────────────────────────────────────────────────────
interface ProdukVarian {
  id: string
  kode_sku: string
  ukuran: string
  jenis: string
  harga: number
  stok: number
  aktif: boolean
  batas_diskon_persen: number
}

interface Produk {
  id: string
  nama: string
  foto_url: string | null
  kategori: any
  produk_varian: ProdukVarian[]
}

interface CartItem {
  produk: Produk
  varian: ProdukVarian
  jumlah: number
  diskon_persen: number
  diskon_nominal: number
  alasan_diskon: string
  harga_jual: number
}

interface Session {
  id: string
  nama: string
  id_toko: string
}

interface Kategori {
  id: string
  nama: string
}

interface PengaturanToko {
  maks_diskon_global: number
  boleh_diskon_nominal: boolean
}

// ─── Konstanta ────────────────────────────────────────────────
const PRODUK_SELECT = `id, nama, foto_url, kategori(id, nama),
  produk_varian(id, kode_sku, ukuran, jenis, harga, stok, aktif, batas_diskon_persen)`

// ─── Helpers ──────────────────────────────────────────────────
const formatRupiah = (angka: number) =>
  'Rp ' + angka.toLocaleString('id-ID')

const getKatNama = (p: Produk): string | undefined => {
  const k = p.kategori
  if (!k) return undefined
  return Array.isArray(k) ? k[0]?.nama : k?.nama
}

const getKatId = (p: Produk): string | undefined => {
  const k = p.kategori
  if (!k) return undefined
  return Array.isArray(k) ? k[0]?.id : k?.id
}

const getVarianAktif = (p: Produk) =>
  p.produk_varian?.filter(v => v.aktif) ?? []

const getVarianTersedia = (p: Produk) =>
  p.produk_varian?.filter(v => v.aktif && v.stok > 0) ?? []

const getTotalStok = (p: Produk) =>
  getVarianAktif(p).reduce((s, v) => s + v.stok, 0)

const getHargaMin = (p: Produk) => {
  const list = getVarianTersedia(p).map(v => v.harga)
  return list.length ? Math.min(...list) : 0
}

const hitungHargaJual = (harga: number, persen: number, nominal: number): number => {
  const diskon = nominal > 0 ? nominal : Math.round(harga * persen / 100)
  return Math.max(0, harga - diskon)
}

// ─── Modal Diskon ─────────────────────────────────────────────
const ModalDiskon = memo(({
  item, pengaturan, onSimpan, onClose,
}: {
  item: CartItem
  pengaturan: PengaturanToko
  onSimpan: (varianId: string, persen: number, nominal: number, alasan: string) => void
  onClose: () => void
}) => {
  const [tipe, setTipe] = useState<'persen' | 'nominal'>(
    item.diskon_nominal > 0 ? 'nominal' : 'persen'
  )
  const [nilaiPersen, setNilaiPersen]   = useState(item.diskon_persen > 0 ? item.diskon_persen.toString() : '')
  const [nilaiNominal, setNilaiNominal] = useState(item.diskon_nominal > 0 ? item.diskon_nominal.toString() : '')
  const [alasan, setAlasan]             = useState(item.alasan_diskon)
  const [err, setErr]                   = useState('')

  const harga = item.varian.harga

  // batas = min(batas varian, maks global toko), jika varian = 0 pakai global
  const batasPersen = Math.min(
    item.varian.batas_diskon_persen > 0
      ? item.varian.batas_diskon_persen
      : pengaturan.maks_diskon_global,
    pengaturan.maks_diskon_global
  )
  const batasNominal = Math.round(harga * batasPersen / 100)

  const persen  = parseFloat(nilaiPersen  || '0')
  const nominal = parseInt(nilaiNominal   || '0')

  const hargaPreview = tipe === 'persen'
    ? hitungHargaJual(harga, persen, 0)
    : hitungHargaJual(harga, 0, nominal)
  const selisih = harga - hargaPreview
  const persenAktif = tipe === 'persen' ? persen : (nominal / harga * 100)
  const melebihi = persenAktif > batasPersen

  const handleSimpan = () => {
    setErr('')
    if (batasPersen === 0) { setErr('Varian ini tidak boleh didiskon'); return }
    if (tipe === 'persen') {
      if (persen <= 0) { onSimpan(item.varian.id, 0, 0, ''); return }
      if (persen > batasPersen) { setErr(`Diskon maks ${batasPersen}%`); return }
      onSimpan(item.varian.id, persen, 0, alasan)
    } else {
      if (nominal <= 0) { onSimpan(item.varian.id, 0, 0, ''); return }
      if (nominal > batasNominal) { setErr(`Diskon maks ${formatRupiah(batasNominal)} (${batasPersen}%)`); return }
      onSimpan(item.varian.id, 0, nominal, alasan)
    }
  }

  const handleHapus = () => onSimpan(item.varian.id, 0, 0, '')
  const label = [item.varian.ukuran, item.varian.jenis].filter(Boolean).join(' – ')

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Atur Diskon</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">
              {item.produk.nama}{label ? ` · ${label}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-3.5">
          {/* Harga normal */}
          <div className="flex justify-between text-xs bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-gray-400">Harga normal</span>
            <span className="font-semibold text-gray-700">{formatRupiah(harga)}</span>
          </div>

          {/* Jika tidak boleh diskon */}
          {batasPersen === 0 ? (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 text-center font-medium">
              ⛔ Varian ini tidak dapat diberi diskon
            </div>
          ) : (
            <>
              {/* Toggle tipe */}
              <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => { setTipe('persen'); setNilaiNominal('') }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${tipe === 'persen' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                >% Persen</button>
                {pengaturan.boleh_diskon_nominal && (
                  <button
                    onClick={() => { setTipe('nominal'); setNilaiPersen('') }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${tipe === 'nominal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
                  >Rp Nominal</button>
                )}
              </div>

              {/* Input diskon */}
              {tipe === 'persen' ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 10, 15, batasPersen]
                      .filter((v, i, a) => a.indexOf(v) === i && v <= batasPersen)
                      .map(n => (
                        <button
                          key={n}
                          onClick={() => setNilaiPersen(n.toString())}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all
                            ${nilaiPersen === n.toString()
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-400'}`}
                        >{n}%</button>
                      ))}
                  </div>
                  <div className="relative">
                    <input
                      type="number" value={nilaiPersen}
                      onChange={e => setNilaiPersen(e.target.value)}
                      placeholder={`0 – ${batasPersen}%`}
                      min={0} max={batasPersen}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm pr-10 focus:outline-none focus:border-orange-400"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-xs text-gray-400">Maks: <span className="font-semibold text-orange-500">{batasPersen}%</span></p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">Rp</span>
                    <input
                      type="number" value={nilaiNominal}
                      onChange={e => setNilaiNominal(e.target.value)}
                      placeholder="0" min={0} max={batasNominal}
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Maks: <span className="font-semibold text-orange-500">{formatRupiah(batasNominal)}</span></p>
                </div>
              )}

              {/* Preview */}
              {(persen > 0 || nominal > 0) && (
                <div className={`rounded-xl px-4 py-3 flex justify-between items-center text-xs
                  ${melebihi ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  <div>
                    <p className="text-gray-500">Harga setelah diskon</p>
                    {selisih > 0 && (
                      <p className={`font-medium mt-0.5 ${melebihi ? 'text-red-500' : 'text-green-600'}`}>
                        hemat {formatRupiah(selisih)}
                      </p>
                    )}
                  </div>
                  <p className={`font-bold text-base ${melebihi ? 'text-red-600' : 'text-green-700'}`}>
                    {formatRupiah(hargaPreview)}
                  </p>
                </div>
              )}

              {/* Alasan */}
              <input
                type="text" value={alasan}
                onChange={e => setAlasan(e.target.value)}
                placeholder="Alasan diskon (opsional)..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />

              {err && <p className="text-xs text-red-500 font-medium"> {err}</p>}
            </>
          )}

          {/* Tombol */}
          <div className="flex gap-2 pt-1">
            {(item.diskon_persen > 0 || item.diskon_nominal > 0) && (
              <button onClick={handleHapus}
                className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-500 text-xs font-semibold">
                Hapus
              </button>
            )}
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Batal
            </button>
            {batasPersen > 0 && (
              <button onClick={handleSimpan}
                className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all">
                Terapkan
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center pb-4 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
})
ModalDiskon.displayName = 'ModalDiskon'

// ─── Chips Kategori ───────────────────────────────────────────
const ChipsKategori = memo(({
  kategoriList, selectedKategori, onSelect,
}: {
  kategoriList: Kategori[]
  selectedKategori: string
  onSelect: (nama: string) => void
}) => (
  <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
    <button
      onClick={() => onSelect('semua')}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
        ${selectedKategori === 'semua'
          ? 'bg-green-600 text-white border-green-600'
          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-400'}`}
    >Semua</button>
    {kategoriList.map(k => (
      <button
        key={k.id}
        onClick={() => onSelect(k.nama)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
          ${selectedKategori === k.nama
            ? 'bg-green-600 text-white border-green-600'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-400'}`}
      >{k.nama}</button>
    ))}
  </div>
))
ChipsKategori.displayName = 'ChipsKategori'

// ─── Kartu Produk ─────────────────────────────────────────────
const KartuProduk = memo(({
  produk, jumlahDiCart, onPilih,
}: {
  produk: Produk
  jumlahDiCart: number
  onPilih: (p: Produk) => void
}) => {
  const varianTersedia = getVarianTersedia(produk)
  const totalStok      = getTotalStok(produk)
  const hargaMin       = getHargaMin(produk)
  const habis          = totalStok === 0

  return (
    <button
      onClick={() => !habis && onPilih(produk)}
      disabled={habis}
      className={`bg-white rounded-xl border-2 p-3 text-left transition-all w-full
        ${jumlahDiCart > 0
          ? 'border-green-500 bg-green-50'
          : habis
            ? 'border-gray-100 opacity-50 cursor-not-allowed'
            : 'border-gray-200 hover:border-green-400 hover:shadow-sm active:scale-[0.98]'}`}
    >
      <div className="w-full h-24 sm:h-28 bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden relative">
        {produk.foto_url ? (
          <img src={produk.foto_url} alt={produk.nama} loading="lazy" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="text-5xl text-gray-200 font-light">
            {getKatNama(produk)?.[0]?.toUpperCase() || 'P'}
          </div>
        )}
        {habis && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
            <span className="text-xs font-bold text-red-400 bg-red-50 px-2 py-1 rounded-full border border-red-200">Habis</span>
          </div>
        )}
        {jumlahDiCart > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow">
            {jumlahDiCart}
          </div>
        )}
      </div>
      <p className="font-semibold text-gray-800 text-xs leading-tight mb-1 line-clamp-2">{produk.nama}</p>
      <p className="text-xs text-gray-400 mb-1">{varianTersedia.length} varian tersedia</p>
      <div className="flex items-center justify-between">
        <p className="text-green-600 font-bold text-xs sm:text-sm">
          {hargaMin > 0 ? formatRupiah(hargaMin) : '-'}
        </p>
        <p className={`text-xs ${totalStok <= 5 && totalStok > 0 ? 'text-orange-400 font-semibold' : 'text-gray-400'}`}>
          {totalStok <= 5 && totalStok > 0 ? `Sisa ${totalStok}` : `Stok: ${totalStok}`}
        </p>
      </div>
    </button>
  )
}, (prev, next) =>
  prev.produk.id === next.produk.id &&
  prev.jumlahDiCart === next.jumlahDiCart &&
  prev.onPilih === next.onPilih
)
KartuProduk.displayName = 'KartuProduk'

// ─── Modal Pilih Varian ───────────────────────────────────────
const ModalVarian = memo(({
  produk, cartItems, onPilih, onClose,
}: {
  produk: Produk
  cartItems: CartItem[]
  onPilih: (p: Produk, v: ProdukVarian) => void
  onClose: () => void
}) => {
  const varianAktif = getVarianAktif(produk)
  const getJumlahDiCart = (varianId: string) =>
    cartItems.find(c => c.varian.id === varianId)?.jumlah ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            {produk.foto_url && (
              <img src={produk.foto_url} alt={produk.nama} className="w-10 h-10 rounded-lg object-cover" />
            )}
            <div>
              <h3 className="font-bold text-gray-800 text-sm">{produk.nama}</h3>
              <p className="text-xs text-gray-400">{varianAktif.length} varian · pilih ukuran/jenis</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {varianAktif.map(v => {
            const label = [v.ukuran, v.jenis].filter(Boolean).join(' – ')
            const habis = v.stok === 0
            const diCart = getJumlahDiCart(v.id)
            return (
              <button
                key={v.id}
                onClick={() => !habis && onPilih(produk, v)}
                disabled={habis}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left
                  ${habis
                    ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                    : diCart > 0
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-500 hover:bg-green-50 active:scale-[0.98]'}`}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">{label || 'Default'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">SKU: {v.kode_sku || '-'}</p>
                  {v.batas_diskon_persen > 0 && (
                    <p className="text-xs text-orange-400 mt-0.5">Diskon s/d {v.batas_diskon_persen}%</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{formatRupiah(v.harga)}</p>
                  <p className={`text-xs mt-0.5 ${habis ? 'text-red-400' : v.stok <= 5 ? 'text-orange-400 font-semibold' : 'text-gray-400'}`}>
                    {habis ? 'Habis' : `Stok: ${v.stok}`}
                  </p>
                  {diCart > 0 && (
                    <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full font-bold">{diCart} di keranjang</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex justify-center pb-4 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
})
ModalVarian.displayName = 'ModalVarian'

// ─── Komponen Utama ───────────────────────────────────────────
export default function KasirPage() {
  const router = useRouter()

  const [session, setSession]               = useState<Session | null>(null)
  const [produkList, setProdukList]         = useState<Produk[]>([])
  const [kategoriList, setKategoriList]     = useState<Kategori[]>([])
  const [selectedKategori, setSelectedKategori] = useState('semua')
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [searchRaw, setSearchRaw]           = useState('')
  const [search, setSearch]                 = useState('')
  const [metodeBayar, setMetodeBayar]       = useState<'tunai' | 'qris' | 'transfer'>('tunai')
  const [nominalBayar, setNominalBayar]     = useState('')
  const [loading, setLoading]               = useState(false)
  const [showBayar, setShowBayar]           = useState(false)
  const [errorMsg, setErrorMsg]             = useState('')
  const [mobileTab, setMobileTab]           = useState<'produk' | 'keranjang'>('produk')
  const [dataNota, setDataNota]             = useState<DataNota | null>(null)
  const [showNota, setShowNota]             = useState(false)
  const [produkDipilih, setProdukDipilih]   = useState<Produk | null>(null)
  const [itemDiskon, setItemDiskon]         = useState<CartItem | null>(null)
  const [pengaturan, setPengaturan]         = useState<PengaturanToko>({
    maks_diskon_global: 20,
    boleh_diskon_nominal: true,
  })

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Session ───────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('pos_session')
    if (!raw) { router.push('/login'); return }
    setSession(JSON.parse(raw))
  }, [router])

  // ── Fetch pengaturan toko ─────────────────────────────────
  useEffect(() => {
    if (!session) return
    supabase
      .from('pengaturan_toko')
      .select('maks_diskon_global, boleh_diskon_nominal')
      .eq('id_toko', session.id_toko)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPengaturan({
          maks_diskon_global:  data.maks_diskon_global  ?? 20,
          boleh_diskon_nominal: data.boleh_diskon_nominal ?? true,
        })
      })
  }, [session])

  // ── Fetch produk ──────────────────────────────────────────
  const buildKategoriList = useCallback((data: Produk[]) => {
    const seen = new Set<string>()
    const unik: Kategori[] = []
    for (const p of data) {
      const nama = getKatNama(p)
      const id   = getKatId(p) ?? nama ?? ''
      if (nama && !seen.has(nama)) { seen.add(nama); unik.push({ id, nama }) }
    }
    unik.sort((a, b) => a.nama.localeCompare(b.nama))
    setKategoriList(unik)
  }, [])

  const fetchProduk = useCallback(async (idToko: string) => {
    const { data, error } = await supabase
      .from('produk')
      .select(PRODUK_SELECT)
      .eq('id_toko', idToko)
      .order('nama')
    if (error) { console.error('Error fetch produk:', error); return }
    if (data) {
      const list = data as Produk[]
      setProdukList(list)
      buildKategoriList(list)
    }
  }, [buildKategoriList])

  useEffect(() => {
    if (!session) return
    fetchProduk(session.id_toko)
  }, [session, fetchProduk])

  // ── Computed ──────────────────────────────────────────────
  const cartMap = useMemo(() => {
    const m = new Map<string, number>()
    cart.forEach(c => m.set(c.produk.id, (m.get(c.produk.id) ?? 0) + c.jumlah))
    return m
  }, [cart])

  const produkFiltered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return produkList.filter(p => {
      const cocokKategori = selectedKategori === 'semua' || getKatNama(p) === selectedKategori
      if (!q) return cocokKategori
      const cocokNama = p.nama.toLowerCase().includes(q)
      const cocokSKU  = p.produk_varian.some(v => v.kode_sku?.toLowerCase().includes(q))
      return (cocokNama || cocokSKU) && cocokKategori
    })
  }, [produkList, search, selectedKategori])

  const { total, totalItemCart, totalDiskon } = useMemo(() => ({
    total:         cart.reduce((sum, c) => sum + c.harga_jual * c.jumlah, 0),
    totalItemCart: cart.reduce((s, c) => s + c.jumlah, 0),
    totalDiskon:   cart.reduce((s, c) => s + (c.varian.harga - c.harga_jual) * c.jumlah, 0),
  }), [cart])

  const kembalian = parseInt(nominalBayar || '0') - total

  // ── Cart handlers ─────────────────────────────────────────
  const tambahCart = useCallback((produk: Produk, varian: ProdukVarian) => {
    setCart(prev => {
      const ada = prev.find(c => c.varian.id === varian.id)
      if (ada) {
        if (ada.jumlah >= varian.stok) return prev
        return prev.map(c => c.varian.id === varian.id ? { ...c, jumlah: c.jumlah + 1 } : c)
      }
      return [...prev, {
        produk, varian, jumlah: 1,
        diskon_persen: 0, diskon_nominal: 0,
        alasan_diskon: '', harga_jual: varian.harga,
      }]
    })
    setProdukDipilih(null)
  }, [])

  const kurangCart = useCallback((varianId: string) => {
    setCart(prev =>
      prev.map(c => c.varian.id === varianId ? { ...c, jumlah: c.jumlah - 1 } : c)
          .filter(c => c.jumlah > 0)
    )
  }, [])

  const hapusCart = useCallback((varianId: string) => {
    setCart(prev => prev.filter(c => c.varian.id !== varianId))
  }, [])

  // ── Diskon handler ────────────────────────────────────────
  const terapkanDiskon = useCallback((
    varianId: string, persen: number, nominal: number, alasan: string
  ) => {
    setCart(prev => prev.map(c => {
      if (c.varian.id !== varianId) return c
      const hargaJual = hitungHargaJual(c.varian.harga, persen, nominal)
      return { ...c, diskon_persen: persen, diskon_nominal: nominal, alasan_diskon: alasan, harga_jual: hargaJual }
    }))
    setItemDiskon(null)
  }, [])

  const handlePilihKategori = useCallback((nama: string) => setSelectedKategori(nama), [])

  const handleSearchChange = useCallback((val: string) => {
    setSearchRaw(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setSearch(val), 150)
  }, [])

  // ── Bayar ─────────────────────────────────────────────────
  const handleBayar = useCallback(async () => {
    if (cart.length === 0 || loading) return
    if (metodeBayar === 'tunai' && kembalian < 0) return

    setLoading(true)
    const cartSnapshot  = [...cart]
    const totalSnapshot = total

    try {
      const { data: trx, error: trxError } = await supabase
        .from('transaksi')
        .insert({
          id_karyawan:  session?.id,
          id_toko:      session?.id_toko,
          total:        totalSnapshot,
          metode_bayar: metodeBayar,
        })
        .select()
        .single()

      if (trxError || !trx) throw new Error('Gagal menyimpan transaksi')

      const itemsPayload = cartSnapshot.map(c => {
        const diskonNom = c.diskon_nominal > 0
          ? c.diskon_nominal
          : Math.round(c.varian.harga * c.diskon_persen / 100)
        const diskonPct = c.diskon_persen > 0
          ? c.diskon_persen
          : parseFloat((c.diskon_nominal / c.varian.harga * 100).toFixed(2))
        return {
          id_transaksi:   trx.id,
          id_produk:      c.produk.id,
          id_varian:      c.varian.id,
          nama_produk:    `${c.produk.nama}${[c.varian.ukuran, c.varian.jenis].filter(Boolean).length
            ? ` (${[c.varian.ukuran, c.varian.jenis].filter(Boolean).join(' – ')})` : ''}`,
          harga_satuan:   c.harga_jual,
          harga_normal:   c.varian.harga,
          harga_jual:     c.harga_jual,
          diskon_nominal: diskonNom,
          diskon_persen:  diskonPct,
          alasan_diskon:  c.alasan_diskon || null,
          jumlah:         c.jumlah,
        }
      })

      const { data: insertedItems } = await supabase
        .from('transaksi_item')
        .insert(itemsPayload)
        .select('id, id_varian')

      // log_diskon hanya untuk item yang ada diskon
      const logRows = (insertedItems ?? [])
        .map((row: any) => {
          const c = cartSnapshot.find(x => x.varian.id === row.id_varian)
          if (!c || (c.diskon_persen === 0 && c.diskon_nominal === 0)) return null
          const diskonNom = c.diskon_nominal > 0
            ? c.diskon_nominal
            : Math.round(c.varian.harga * c.diskon_persen / 100)
          const diskonPct = c.diskon_persen > 0
            ? c.diskon_persen
            : parseFloat((c.diskon_nominal / c.varian.harga * 100).toFixed(2))
          return {
            id_transaksi:      trx.id,
            id_transaksi_item: row.id,
            id_karyawan:       session?.id,
            id_varian:         c.varian.id,
            harga_normal:      c.varian.harga,
            harga_jual:        c.harga_jual,
            diskon_nominal:    diskonNom,
            diskon_persen:     diskonPct,
            alasan:            c.alasan_diskon || null,
          }
        })
        .filter(Boolean)

      await Promise.all([
        logRows.length > 0
          ? supabase.from('log_diskon').insert(logRows)
          : Promise.resolve(),
        ...cartSnapshot.map(c =>
          supabase
            .from('produk_varian')
            .update({ stok: Math.max(0, c.varian.stok - c.jumlah) })
            .eq('id', c.varian.id)
        ),
      ])

      setCart([])
      setNominalBayar('')
      setShowBayar(false)
      setMobileTab('produk')

      setDataNota({
        id:           trx.id,
        waktu:        new Date(),
        items:        cartSnapshot,
        total:        totalSnapshot,
        totalDiskon:  cartSnapshot.reduce((s, c) => s + (c.varian.harga - c.harga_jual) * c.jumlah, 0),
        metodeBayar,
        nominalBayar: parseInt(nominalBayar || '0'),
        kembalian:    parseInt(nominalBayar || '0') - totalSnapshot,
        kasir:        session?.nama ?? '',
      })
      setShowNota(true)
      fetchProduk(session?.id_toko ?? '')
    } catch (err) {
      console.error(err)
      setErrorMsg('❌ Gagal menyimpan transaksi, coba lagi')
      setTimeout(() => setErrorMsg(''), 4000)
    } finally {
      setLoading(false)
    }
  }, [cart, loading, metodeBayar, kembalian, total, nominalBayar, session, fetchProduk])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('pos_session')
    router.push('/login')
  }, [router])

  // ── Sub-render ────────────────────────────────────────────
  const filterBar = (
    <div className="flex-shrink-0 bg-white border-b px-4 pt-3 pb-0">
      <ChipsKategori
        kategoriList={kategoriList}
        selectedKategori={selectedKategori}
        onSelect={handlePilihKategori}
      />
      <div className="pb-3">
        <input
          type="text"
          placeholder="Cari nama / kode SKU..."
          value={searchRaw}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500"
        />
      </div>
    </div>
  )

  const gridProduk = (cols: string) => (
    <div className={`grid ${cols} gap-3`}>
      {produkFiltered.length === 0 ? (
        <div className="col-span-full text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📦</p>
          <p className="text-sm">Tidak ada produk ditemukan</p>
        </div>
      ) : (
        produkFiltered.map(p => (
          <KartuProduk
            key={p.id}
            produk={p}
            jumlahDiCart={cartMap.get(p.id) ?? 0}
            onPilih={setProdukDipilih}
          />
        ))
      )}
    </div>
  )

  // ── Keranjang Panel ───────────────────────────────────────
  const keranjangPanel = (
    <>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {cart.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-xs">Pilih produk untuk ditambahkan</p>
          </div>
        ) : (
          cart.map(c => {
            const label    = [c.varian.ukuran, c.varian.jenis].filter(Boolean).join(' – ')
            const adaDiskon = c.diskon_persen > 0 || c.diskon_nominal > 0
            const batasDiskon = Math.min(
              c.varian.batas_diskon_persen > 0
                ? c.varian.batas_diskon_persen
                : pengaturan.maks_diskon_global,
              pengaturan.maks_diskon_global
            )

            return (
              <div key={c.varian.id} className="flex items-start gap-2 mb-3 pb-3 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{c.produk.nama}</p>
                  {label && <p className="text-xs text-gray-500">{label}</p>}

                  {/* Harga — coret jika ada diskon */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {adaDiskon ? (
                      <>
                        <p className="text-xs text-gray-400 line-through">{formatRupiah(c.varian.harga)}</p>
                        <p className="text-xs font-bold text-orange-500">{formatRupiah(c.harga_jual)}</p>
                        <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">
                          {c.diskon_persen > 0
                            ? `-${c.diskon_persen}%`
                            : `-${formatRupiah(c.diskon_nominal)}`}
                        </span>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">{formatRupiah(c.varian.harga)}</p>
                    )}
                  </div>

                  {/* Tombol diskon — hanya tampil jika ada batas */}
                  {batasDiskon > 0 && (
                    <button
                      onClick={() => setItemDiskon(c)}
                      className={`mt-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-all
                        ${adaDiskon
                          ? 'border-orange-300 text-orange-500 bg-orange-50 hover:bg-orange-100'
                          : 'border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50'}`}
                    >
                      {adaDiskon ? '✏️ Edit diskon' : '% Beri diskon'}
                    </button>
                  )}
                </div>

                {/* Qty control */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => kurangCart(c.varian.id)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 text-xs font-bold flex items-center justify-center"
                    >−</button>
                    <span className="w-6 text-center text-xs font-bold">{c.jumlah}</span>
                    <button
                      onClick={() => tambahCart(c.produk, c.varian)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-600 text-xs font-bold flex items-center justify-center"
                    >+</button>
                  </div>
                  <p className="text-xs font-semibold text-gray-700">
                    {formatRupiah(c.harga_jual * c.jumlah)}
                  </p>
                </div>

                <button
                  onClick={() => hapusCart(c.varian.id)}
                  className="text-gray-300 hover:text-red-400 text-xs ml-1 mt-0.5"
                >✕</button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer keranjang */}
      <div className="flex-shrink-0 p-3 border-t bg-white flex flex-col gap-2.5">
        {/* Ringkasan diskon */}
        {totalDiskon > 0 && (
          <div className="flex justify-between items-center text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <span className="text-orange-600">Total diskon</span>
            <span className="font-bold text-orange-600">-{formatRupiah(totalDiskon)}</span>
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Total ({totalItemCart} item)</span>
          <span className="text-lg font-bold text-gray-800">{formatRupiah(total)}</span>
        </div>

        {/* Tombol bayar */}
        {cart.length > 0 && !showBayar && (
          <button
            onClick={() => setShowBayar(true)}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 active:scale-[0.98] transition-all"
          >Bayar Sekarang</button>
        )}

        {/* Form pembayaran */}
        {showBayar && (
          <div className="space-y-2.5" style={{ maxHeight: '38vh', overflowY: 'auto' }}>
            <div className="grid grid-cols-3 gap-1.5">
              {(['tunai', 'qris', 'transfer'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMetodeBayar(m); if (m !== 'tunai') setNominalBayar('') }}
                  className={`py-1.5 text-[11px] font-semibold rounded-lg border transition-all
                    ${metodeBayar === m
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}
                >
                  {m === 'tunai' ? '💵 Tunai' : m === 'qris' ? '📱 QRIS' : '🏦 Transfer'}
                </button>
              ))}
            </div>

            {metodeBayar === 'tunai' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {[50000, 100000, 'pas'].map(n => (
                    <button
                      key={n}
                      onClick={() => {
                        if (n === 'pas') setNominalBayar(total.toString())
                        else setNominalBayar(prev => String(parseInt(prev || '0') + (n as number)))
                      }}
                      className="py-1 text-[10px] rounded-lg border bg-gray-50 hover:bg-green-50 hover:border-green-400 transition-all font-medium"
                    >
                      {n === 'pas' ? 'Uang Pas' : n === 50000 ? '+50rb' : '+100rb'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="Nominal bayar..."
                    value={nominalBayar}
                    onChange={e => setNominalBayar(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                  <button
                    onClick={() => setNominalBayar('')}
                    className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-500 text-xs font-medium"
                  >Reset</button>
                </div>
                {nominalBayar && kembalian >= 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex justify-between text-xs">
                    <span className="text-gray-500">Kembalian</span>
                    <span className="font-bold text-green-600">{formatRupiah(kembalian)}</span>
                  </div>
                )}
                {nominalBayar && kembalian < 0 && (
                  <p className="text-xs text-red-500 font-medium">
                     Uang kurang {formatRupiah(Math.abs(kembalian))}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowBayar(false); setNominalBayar('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >Batal</button>
              <button
                onClick={handleBayar}
                disabled={loading || (metodeBayar === 'tunai' && (!nominalBayar || kembalian < 0))}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-all"
              >
                {loading ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <button
            onClick={() => setCart([])}
            className="w-full text-xs text-gray-400 hover:text-red-400 transition-colors py-1"
          >Kosongkan keranjang</button>
        )}
      </div>
    </>
  )

  // ── Return ────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-800 text-sm sm:text-base">Alfin Jaya POS</h1>
          <p className="text-xs text-gray-400">{session?.nama} · {session?.id_toko}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >Keluar</button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="flex-shrink-0 border-b px-4 py-3 text-sm font-medium text-center bg-red-50 border-red-200 text-red-700">
          {errorMsg}
        </div>
      )}

      {/* ── DESKTOP ── */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {filterBar}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {gridProduk('grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}
          </div>
        </div>
        <div className="w-80 flex-shrink-0 bg-white border-l flex flex-col overflow-hidden">
          <div className="flex-shrink-0 p-4 border-b">
            <h2 className="font-bold text-gray-800">
              Keranjang
              {totalItemCart > 0 && (
                <span className="ml-2 bg-green-600 text-white text-xs rounded-full px-2 py-0.5">{totalItemCart}</span>
              )}
            </h2>
          </div>
          {keranjangPanel}
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="flex md:hidden flex-1 min-h-0 flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b flex">
          <button
            onClick={() => setMobileTab('produk')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${mobileTab === 'produk' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400'}`}
          >Produk</button>
          <button
            onClick={() => setMobileTab('keranjang')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors
              ${mobileTab === 'keranjang' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400'}`}
          >
            Keranjang
            {totalItemCart > 0 && (
              <span className="ml-1 bg-green-600 text-white text-xs rounded-full px-1.5 py-0.5">{totalItemCart}</span>
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {mobileTab === 'produk' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {filterBar}
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {gridProduk('grid-cols-2')}
              </div>
              {totalItemCart > 0 && (
                <div className="flex-shrink-0 p-3 bg-white border-t">
                  <button
                    onClick={() => setMobileTab('keranjang')}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold flex items-center justify-between px-4 active:scale-[0.98] transition-all"
                  >
                    <span className="bg-white text-green-700 text-xs font-bold rounded-lg px-2 py-0.5">{totalItemCart} item</span>
                    <span>Lihat Keranjang</span>
                    <span className="font-bold text-sm">{formatRupiah(total)}</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {mobileTab === 'keranjang' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {keranjangPanel}
            </div>
          )}
        </div>
      </div>

      {/* Modal Pilih Varian */}
      {produkDipilih && (
        <ModalVarian
          produk={produkDipilih}
          cartItems={cart}
          onPilih={tambahCart}
          onClose={() => setProdukDipilih(null)}
        />
      )}

      {/* Modal Diskon */}
      {itemDiskon && (
        <ModalDiskon
          item={itemDiskon}
          pengaturan={pengaturan}
          onSimpan={terapkanDiskon}
          onClose={() => setItemDiskon(null)}
        />
      )}

      {/* Nota */}
      {showNota && dataNota && (
        <NotaModal
          data={dataNota}
          onClose={() => { setShowNota(false); setDataNota(null) }}
        />
      )}
    </div>
  )
}