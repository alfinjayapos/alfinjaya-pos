'use client'

import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'

// ─── Types (sesuai KasirPage) ─────────────────────────────────
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

export interface DataNota {
  id: string
  waktu: Date
  items: CartItem[]
  total: number
  totalDiskon: number
  metodeBayar: 'tunai' | 'qris' | 'transfer'
  nominalBayar: number
  kembalian: number
  kasir: string
}

// ─── Helpers ──────────────────────────────────────────────────
const formatRupiah = (angka: number) =>
  'Rp ' + angka.toLocaleString('id-ID')

const getLabel = (c: CartItem) =>
  [c.varian.ukuran, c.varian.jenis].filter(Boolean).join(' – ')

// ─── Komponen ─────────────────────────────────────────────────
export default function NotaModal({
  data,
  onClose,
}: {
  data: DataNota
  onClose: () => void
}) {
  const notaRef  = useRef<HTMLDivElement>(null)
  const [shareMode, setShareMode] = useState<'teks' | 'gambar'>('teks')
  const [generating, setGenerating] = useState(false)

  const tglWaktu = data.waktu.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const idPendek = data.id.slice(0, 8).toUpperCase()

  // ── Teks nota untuk share / WhatsApp ─────────────────────
  const pesanTeks = [
    `╔═══════════════════════╗`,
    `         TOKO ALFIN JAYA`,
    `╚═══════════════════════╝`,
    ``,
    `No    : #${idPendek}`,
    `Waktu : ${tglWaktu}`,
    `Kasir : ${data.kasir}`,
    `Metode: ${data.metodeBayar.toUpperCase()}`,
    ``,
    `─────────────────────────`,
    `         ITEM BELANJA`,
    `─────────────────────────`,
    ...data.items.map((c, i) => {
      const label       = getLabel(c)
      const namaLengkap = label ? `${c.produk.nama} (${label})` : c.produk.nama
      const adaDiskon   = c.diskon_persen > 0 || c.diskon_nominal > 0
      const diskonInfo  = adaDiskon
        ? c.diskon_persen > 0
          ? ` [diskon ${c.diskon_persen}%]`
          : ` [diskon ${formatRupiah(c.diskon_nominal)}]`
        : ''
      return [
        `${String(i + 1).padStart(2, '0')}. ${namaLengkap}${diskonInfo}`,
        adaDiskon
          ? `    ${c.jumlah}x ${formatRupiah(c.varian.harga)} → ${formatRupiah(c.harga_jual)} = ${formatRupiah(c.jumlah * c.harga_jual)}`
          : `    ${c.jumlah}x ${formatRupiah(c.varian.harga)} = ${formatRupiah(c.jumlah * c.harga_jual)}`,
      ].join('\n')
    }),
    `─────────────────────────`,
    ...(data.totalDiskon > 0 ? [`Diskon  : -${formatRupiah(data.totalDiskon)}`] : []),
    ...(data.metodeBayar === 'tunai'
      ? [
          `Dibayar  : ${formatRupiah(data.nominalBayar)}`,
          `Kembalian: ${formatRupiah(data.kembalian)}`,
        ]
      : []),
    `TOTAL    : ${formatRupiah(data.total)}`,
    `─────────────────────────`,
    ``,
    `     Terima kasih telah berbelanja`,
    `         di Toko Alfin Jaya 🙏`,
  ].join('\n')

  // ── Gambar nota (html2canvas) ─────────────────────────────
  const buatGambar = async (): Promise<File | null> => {
    if (!notaRef.current) return null
    const canvas = await html2canvas(notaRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
    })
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (!blob) { resolve(null); return }
        resolve(new File([blob], `nota-${idPendek}.png`, { type: 'image/png' }))
      }, 'image/png')
    })
  }

  const handleShare = async () => {
    setGenerating(true)
    try {
      if (shareMode === 'teks') {
        if (navigator.share) {
          await navigator.share({ title: `Nota #${idPendek}`, text: pesanTeks })
        } else {
          await navigator.clipboard.writeText(pesanTeks)
          alert('Nota berhasil disalin ke clipboard!')
        }
      } else {
        const file = await buatGambar()
        if (!file) { alert('Gagal membuat gambar nota.'); return }
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: `Nota #${idPendek}`, files: [file] })
        } else {
          const url = URL.createObjectURL(file)
          const a   = document.createElement('a')
          a.href = url; a.download = `nota-${idPendek}.png`; a.click()
          URL.revokeObjectURL(url)
        }
      }
    } catch (_) {
      // user batalkan
    } finally {
      setGenerating(false)
    }
  }

  const handleCetak = () => {
    const isiCetak = `
      <html>
      <head>
        <title>Nota #${idPendek}</title>
        <style>
          body { font-family: monospace; font-size: 12px; padding: 16px; max-width: 300px; margin: 0 auto; }
          h2   { text-align: center; font-size: 14px; margin: 0 0 4px; }
          p    { text-align: center; margin: 0 0 2px; font-size: 11px; color: #555; }
          hr   { border: none; border-top: 1px dashed #ccc; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .bold      { font-weight: bold; }
          .sub       { font-size: 11px; color: #888; margin-bottom: 4px; }
          .diskon-tag{ font-size: 10px; color: #ea580c; }
          .strike    { text-decoration: line-through; color: #aaa; }
          .footer    { text-align: center; margin-top: 12px; font-size: 11px; color: #555; }
          .diskon-row{ display: flex; justify-content: space-between; color: #ea580c; font-size: 11px; }
        </style>
      </head>
      <body>
        <h2>Alfin Jaya</h2>
        <p>Nota Transaksi</p>
        <hr/>
        <div class="row"><span>No</span><span>#${idPendek}</span></div>
        <div class="row"><span>Waktu</span><span>${tglWaktu}</span></div>
        <div class="row"><span>Kasir</span><span>${data.kasir}</span></div>
        <hr/>
        ${data.items.map(c => {
          const label       = getLabel(c)
          const namaLengkap = label ? `${c.produk.nama} (${label})` : c.produk.nama
          const adaDiskon   = c.diskon_persen > 0 || c.diskon_nominal > 0
          const diskonLabel = adaDiskon
            ? c.diskon_persen > 0 ? `Diskon ${c.diskon_persen}%` : `Diskon ${formatRupiah(c.diskon_nominal)}`
            : ''
          return `
            <div class="row">
              <span>${namaLengkap}</span>
              <span>${formatRupiah(c.jumlah * c.harga_jual)}</span>
            </div>
            <div class="sub">
              ${adaDiskon
                ? `<span class="strike">${c.jumlah}x ${formatRupiah(c.varian.harga)}</span>
                   &nbsp;<span class="diskon-tag">${diskonLabel}</span>
                   &nbsp;→ ${c.jumlah}x ${formatRupiah(c.harga_jual)}`
                : `${c.jumlah}x ${formatRupiah(c.harga_jual)}`
              }
            </div>
          `
        }).join('')}
        <hr/>
        <div class="row"><span>Metode</span><span>${data.metodeBayar.toUpperCase()}</span></div>
        ${data.totalDiskon > 0 ? `<div class="diskon-row"><span>Total Diskon</span><span>-${formatRupiah(data.totalDiskon)}</span></div>` : ''}
        ${data.metodeBayar === 'tunai' ? `
          <div class="row"><span>Dibayar</span><span>${formatRupiah(data.nominalBayar)}</span></div>
          <div class="row"><span>Kembalian</span><span>${formatRupiah(data.kembalian)}</span></div>
        ` : ''}
        <hr/>
        <div class="row bold"><span>TOTAL</span><span>${formatRupiah(data.total)}</span></div>
        <div class="footer">Terima kasih telah berbelanja<br/>di Alfin Jaya 🙏</div>
      </body>
      </html>
    `
    const popup = window.open('', '_blank', 'width=400,height=600')
    if (popup) {
      popup.document.write(isiCetak)
      popup.document.close()
      popup.focus()
      popup.print()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header sukses ── */}
        <div className="bg-green-600 px-5 py-5 text-center">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 20 20">
              <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-white font-semibold text-base">Transaksi berhasil</p>
          <p className="text-white/70 text-xs mt-1">#{idPendek}</p>
        </div>

        {/* ── Isi nota ── */}
        <div className="px-5 py-4">
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>{tglWaktu}</span>
            <span>Kasir: {data.kasir}</span>
          </div>

          {/* Item list */}
          <div className={`border-t border-gray-100 pt-3 mb-3 space-y-2.5 ${shareMode === 'gambar' ? '' : 'max-h-44 overflow-y-auto'}`}>
            {data.items.map(c => {
              const label     = getLabel(c)
              const adaDiskon = c.diskon_persen > 0 || c.diskon_nominal > 0
              return (
                <div key={c.varian.id} className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-xs leading-tight truncate">{c.produk.nama}</p>
                    {label && <p className="text-xs text-gray-400">{label}</p>}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {adaDiskon ? (
                        <>
                          <p className="text-xs text-gray-400 line-through">{c.jumlah}x {formatRupiah(c.varian.harga)}</p>
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded font-semibold">
                            {c.diskon_persen > 0 ? `-${c.diskon_persen}%` : `-${formatRupiah(c.diskon_nominal)}`}
                          </span>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">{c.jumlah}x {formatRupiah(c.varian.harga)}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-medium text-gray-700 text-xs shrink-0">
                    {formatRupiah(c.jumlah * c.harga_jual)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div className="border-t border-gray-100 pt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Metode bayar</span>
              <span className="capitalize">{data.metodeBayar}</span>
            </div>
            {data.totalDiskon > 0 && (
              <div className="flex justify-between text-xs text-orange-500 font-medium">
                <span>Total diskon</span>
                <span>-{formatRupiah(data.totalDiskon)}</span>
              </div>
            )}
            {data.metodeBayar === 'tunai' && (
              <>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Dibayar</span>
                  <span>{formatRupiah(data.nominalBayar)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Kembalian</span>
                  <span className="text-green-600 font-semibold">{formatRupiah(data.kembalian)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold text-gray-800 text-sm pt-1">
              <span>Total</span>
              <span>{formatRupiah(data.total)}</span>
            </div>
          </div>
        </div>

        {/* ── Toggle teks / gambar ── */}
        <div className="px-5 pb-2">
          <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setShareMode('teks')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${shareMode === 'teks' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
            >Teks</button>
            <button
              onClick={() => setShareMode('gambar')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${shareMode === 'gambar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}
            >Gambar</button>
          </div>
        </div>

        {/* ── Tombol aksi ── */}
        <div className="px-5 pb-5">
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Tutup
            </button>
            <button onClick={handleCetak}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/>
              </svg>
              Cetak
            </button>
            <button onClick={handleShare} disabled={generating}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5 disabled:opacity-40">
              {generating ? (
                <span className="text-xs">Memproses...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                  </svg>
                  Share
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── NOTA KHUSUS SCREENSHOT (off-screen) ── */}
        <div
          ref={notaRef}
          className="fixed -left-[9999px] top-0 bg-white p-4 w-[280px] text-black font-mono"
        >
          <h2 className="text-center font-bold text-sm">Alfin Jaya</h2>
          <p className="text-center text-xs mb-2">Nota Transaksi</p>
          <hr className="my-1 border-dashed" />
          <div className="text-xs space-y-0.5">
            <div className="flex justify-between"><span>No</span><span>#{idPendek}</span></div>
            <div className="flex justify-between"><span>Waktu</span><span>{tglWaktu}</span></div>
            <div className="flex justify-between"><span>Kasir</span><span>{data.kasir}</span></div>
          </div>
          <hr className="my-1 border-dashed" />
          <div className="text-xs space-y-1.5">
            {data.items.map(c => {
              const label     = getLabel(c)
              const adaDiskon = c.diskon_persen > 0 || c.diskon_nominal > 0
              const diskonTag = adaDiskon
                ? c.diskon_persen > 0 ? `Diskon ${c.diskon_persen}%` : `Diskon ${formatRupiah(c.diskon_nominal)}`
                : ''
              return (
                <div key={c.varian.id}>
                  <div className="flex justify-between">
                    <span>{c.produk.nama}{label ? ` (${label})` : ''}</span>
                    <span>{formatRupiah(c.jumlah * c.harga_jual)}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {adaDiskon
                      ? <><s>{c.jumlah}x {formatRupiah(c.varian.harga)}</s> {diskonTag} → {c.jumlah}x {formatRupiah(c.harga_jual)}</>
                      : <>{c.jumlah}x {formatRupiah(c.harga_jual)}</>
                    }
                  </div>
                </div>
              )
            })}
          </div>
          <hr className="my-1 border-dashed" />
          <div className="text-xs space-y-0.5">
            <div className="flex justify-between"><span>Metode</span><span>{data.metodeBayar.toUpperCase()}</span></div>
            {data.totalDiskon > 0 && (
              <div className="flex justify-between text-orange-600 font-semibold">
                <span>Total Diskon</span><span>-{formatRupiah(data.totalDiskon)}</span>
              </div>
            )}
            {data.metodeBayar === 'tunai' && (
              <>
                <div className="flex justify-between"><span>Dibayar</span><span>{formatRupiah(data.nominalBayar)}</span></div>
                <div className="flex justify-between"><span>Kembalian</span><span>{formatRupiah(data.kembalian)}</span></div>
              </>
            )}
          </div>
          <hr className="my-1 border-dashed" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span><span>{formatRupiah(data.total)}</span>
          </div>
          <p className="text-center text-xs mt-2">Terima kasih 🙏</p>
        </div>
      </div>
    </div>
  )
}