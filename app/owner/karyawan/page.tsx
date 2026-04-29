'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabaseOwner as supabase } from '@/lib/supabase'

// ─── PAGE HEADER (TEMPLATE REUSABLE - SAMA DENGAN DASHBOARD, TOKO, TRANSAKSI) ─
const PageHeader = memo(({ 
  title, 
  onRefresh,
  rightContent 
}: { 
  title: string
  onRefresh?: () => void
  rightContent?: React.ReactNode
}) => (
  <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
    <div className="max-w-7xl mx-auto flex items-center justify-between">
      <div>
        <h1 className="text-[1.2rem] font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
          </button>
        )}
        {rightContent}
      </div>
    </div>
  </div>
))
PageHeader.displayName = 'PageHeader'
// ───────────────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

interface Karyawan {
  id: string
  nama: string
  id_toko: string
  aktif: boolean
}

interface Toko {
  id_toko: string
  nama_toko: string
}

type FormData = {
  nama: string
  pin: string
  pin_konfirm: string
  id_toko: string
}

const EMPTY_FORM: FormData = { nama: '', pin: '', pin_konfirm: '', id_toko: '' }

// ─── Kartu Karyawan ───────────────────────────────────────────────────────────

const KartuKaryawan = memo(({
  k, onEdit, onToggle, onResetPin,
}: {
  k: Karyawan
  onEdit: (k: Karyawan) => void
  onToggle: (k: Karyawan) => void
  onResetPin: (k: Karyawan) => void
}) => (
  <div className={`bg-white rounded-2xl border p-4 transition-all
    ${k.aktif ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>

    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center font-semibold text-sm text-gray-600 flex-shrink-0 bg-gray-50">
          {k.nama.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{k.nama}</p>
          <p className="text-xs text-gray-400">{k.id_toko}</p>
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border
        ${k.aktif
          ? 'text-gray-600 border-gray-200 bg-white'
          : 'text-gray-400 border-gray-100 bg-gray-50'}`}>
        {k.aktif ? 'Aktif' : 'Nonaktif'}
      </span>
    </div>

    <div className="flex gap-1.5 flex-wrap">
      <button
        onClick={() => onEdit(k)}
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
      >Edit</button>
      <button
        onClick={() => onResetPin(k)}
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
      >Reset PIN</button>
      <button
        onClick={() => onToggle(k)}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-all
          ${k.aktif
            ? 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
            : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}
      >{k.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
    </div>
  </div>
))
KartuKaryawan.displayName = 'KartuKaryawan'

// ─── Input field helper ───────────────────────────────────────────────────────

const Field = ({
  label, children,
}: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
      {label}
    </label>
    {children}
  </div>
)

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors"

// ─── Modal Tambah/Edit Karyawan ───────────────────────────────────────────────

const ModalKaryawan = memo(({
  form, tokoList, editId, saving, errorMsg,
  onChange, onSave, onClose,
}: {
  form: FormData
  tokoList: Toko[]
  editId: string | null
  saving: boolean
  errorMsg: string
  onChange: (k: keyof FormData, v: string) => void
  onSave: () => void
  onClose: () => void
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.45)' }}>
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">

      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">
          {editId ? 'Edit Karyawan' : 'Tambah Karyawan'}
        </h3>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition-all">
          ✕
        </button>
      </div>

      <div className="p-5 space-y-4">
        <Field label="Nama Karyawan">
          <input
            value={form.nama}
            onChange={e => onChange('nama', e.target.value)}
            placeholder="cth: Andi"
            className={inputCls}
          />
        </Field>

        <Field label="Toko">
          <select
            value={form.id_toko}
            onChange={e => onChange('id_toko', e.target.value)}
            className={inputCls + ' bg-white'}
          >
            <option value="">Pilih toko...</option>
            {tokoList.map(t => (
              <option key={t.id_toko} value={t.id_toko}>{t.nama_toko}</option>
            ))}
          </select>
        </Field>

        {!editId && (
          <>
            <Field label="PIN (min 4 digit)">
              <input
                type="password"
                maxLength={6}
                value={form.pin}
                onChange={e => onChange('pin', e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className={inputCls}
              />
            </Field>
            <Field label="Konfirmasi PIN">
              <input
                type="password"
                maxLength={6}
                value={form.pin_konfirm}
                onChange={e => onChange('pin_konfirm', e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className={inputCls}
              />
            </Field>
          </>
        )}

        {errorMsg && (
          <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>
        )}

        <p className="text-xs text-gray-400 border border-gray-100 rounded-xl px-3 py-2 bg-gray-50">
          {editId
            ? 'Mengubah nama atau toko tidak mempengaruhi PIN karyawan.'
            : 'PIN digunakan karyawan untuk login ke kasir. Minimal 4 digit.'}
        </p>
      </div>

      <div className="flex gap-3 px-5 pb-5">
        <button onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
          Batal
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.nama || !form.id_toko || (!editId && form.pin.length < 4)}
          className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all"
        >
          {saving ? 'Menyimpan...' : editId ? 'Simpan' : 'Tambah'}
        </button>
      </div>
    </div>
  </div>
))
ModalKaryawan.displayName = 'ModalKaryawan'

// ─── Modal Reset PIN ──────────────────────────────────────────────────────────

const ModalResetPin = memo(({
  karyawan, saving, onSave, onClose,
}: {
  karyawan: Karyawan
  saving: boolean
  onSave: (pin: string) => void
  onClose: () => void
}) => {
  const [pin, setPin]         = useState('')
  const [konfirm, setKonfirm] = useState('')
  const [err, setErr]         = useState('')

  const handleSave = () => {
    if (pin.length < 4) { setErr('PIN minimal 4 digit'); return }
    if (pin !== konfirm) { setErr('PIN tidak cocok'); return }
    onSave(pin)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Reset PIN</h3>
            <p className="text-xs text-gray-400 mt-0.5">{karyawan.nama}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition-all">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="PIN Baru (min 4 digit)">
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className={inputCls}
            />
          </Field>
          <Field label="Konfirmasi PIN Baru">
            <input
              type="password"
              maxLength={6}
              value={konfirm}
              onChange={e => setKonfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className={inputCls}
            />
          </Field>
          {err && <p className="text-red-500 text-xs">{err}</p>}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-all">
            {saving ? 'Menyimpan...' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  )
})
ModalResetPin.displayName = 'ModalResetPin'

// ─── Modal Konfirmasi Toggle ──────────────────────────────────────────────────

const ModalToggle = memo(({
  karyawan, saving, onConfirm, onClose,
}: {
  karyawan: Karyawan
  saving: boolean
  onConfirm: () => void
  onClose: () => void
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.45)' }}>
    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
      <div className="p-6 text-center">
        <p className="font-bold text-gray-900 mb-1">
          {karyawan.aktif ? 'Nonaktifkan Karyawan?' : 'Aktifkan Karyawan?'}
        </p>
        <p className="text-sm text-gray-500">{karyawan.nama}</p>
      </div>
      <div className="flex border-t border-gray-100">
        <button onClick={onClose} disabled={saving}
          className="flex-1 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-all border-r border-gray-100">
          Batal
        </button>
        <button onClick={onConfirm} disabled={saving}
          className={`flex-1 py-4 text-sm font-bold transition-all disabled:opacity-40
            ${karyawan.aktif ? 'text-red-500 hover:bg-red-50' : 'text-gray-900 hover:bg-gray-50'}`}>
          {saving ? 'Memproses...' : 'Lanjutkan'}
        </button>
      </div>
    </div>
  </div>
))
ModalToggle.displayName = 'ModalToggle'

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function KaryawanPage() {
  const [karyawanList, setKaryawanList]       = useState<Karyawan[]>([])
  const [tokoList, setTokoList]               = useState<Toko[]>([])
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [showModal, setShowModal]             = useState(false)
  const [showResetPin, setShowResetPin]       = useState(false)
  const [showToggleModal, setShowToggleModal] = useState(false)
  const [editId, setEditId]                   = useState<string | null>(null)
  const [resetTarget, setResetTarget]         = useState<Karyawan | null>(null)
  const [toggleTarget, setToggleTarget]       = useState<Karyawan | null>(null)
  const [form, setForm]                       = useState<FormData>(EMPTY_FORM)
  const [errorMsg, setErrorMsg]               = useState('')
  const [filterToko, setFilterToko]           = useState('semua')
  const [filterAktif, setFilterAktif]         = useState<'semua' | 'aktif' | 'nonaktif'>('semua')
  const [openFilter, setOpenFilter]           = useState<string | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [karRes, tokoRes] = await Promise.all([
      supabase.from('karyawan').select('id, nama, id_toko, aktif').order('nama'),
      supabase.from('toko').select('id_toko, nama_toko'),
    ])
    if (karRes.data)  setKaryawanList(karRes.data)
    if (tokoRes.data) setTokoList(tokoRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Filter ────────────────────────────────────────────────────────────────

  const karyawanFiltered = useMemo(() =>
    karyawanList.filter(k => {
      const cocokToko  = filterToko  === 'semua' || k.id_toko === filterToko
      const cocokAktif = filterAktif === 'semua'
        || (filterAktif === 'aktif' ? k.aktif : !k.aktif)
      return cocokToko && cocokAktif
    }),
    [karyawanList, filterToko, filterAktif]
  )

  const stats = useMemo(() => ({
    total:    karyawanList.length,
    aktif:    karyawanList.filter(k => k.aktif).length,
    nonaktif: karyawanList.filter(k => !k.aktif).length,
  }), [karyawanList])

  const labelToko   = filterToko   === 'semua' ? 'Semua Toko'   : tokoList.find(t => t.id_toko === filterToko)?.nama_toko || filterToko
  const labelStatus = filterAktif  === 'semua' ? 'Status'       : filterAktif === 'aktif' ? 'Aktif' : 'Nonaktif'

  const toggleFilter = (key: string) => setOpenFilter(prev => prev === key ? null : key)

  // ── Form handlers ─────────────────────────────────────────────────────────

  const handleChange = useCallback((k: keyof FormData, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrorMsg('')
  }, [])

  const bukaModal = useCallback((k?: Karyawan) => {
    setErrorMsg('')
    if (k) {
      setEditId(k.id)
      setForm({ nama: k.nama, pin: '', pin_konfirm: '', id_toko: k.id_toko })
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
    setErrorMsg('')
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.nama.trim() || !form.id_toko) return
    if (!editId) {
      if (form.pin.length < 4) { setErrorMsg('PIN minimal 4 digit'); return }
      if (form.pin !== form.pin_konfirm) { setErrorMsg('PIN tidak cocok'); return }
    }
    setSaving(true)
    if (editId) {
      await supabase.from('karyawan')
        .update({ nama: form.nama.trim(), id_toko: form.id_toko })
        .eq('id', editId)
    } else {
      const { error } = await supabase.rpc('tambah_karyawan', {
        p_nama: form.nama.trim(), p_pin: form.pin, p_id_toko: form.id_toko,
      })
      if (error) { setErrorMsg('Gagal menambah karyawan: ' + error.message); setSaving(false); return }
    }
    setSaving(false)
    tutupModal()
    fetchAll()
  }, [form, editId, tutupModal, fetchAll])

  const handleToggle = useCallback((k: Karyawan) => {
    setToggleTarget(k)
    setShowToggleModal(true)
  }, [])

  const confirmToggle = useCallback(async () => {
    if (!toggleTarget) return
    setSaving(true)
    await supabase.rpc('toggle_aktif_karyawan', {
      p_id: toggleTarget.id, p_aktif: !toggleTarget.aktif,
    })
    setSaving(false)
    setShowToggleModal(false)
    setToggleTarget(null)
    fetchAll()
  }, [toggleTarget, fetchAll])

  const handleResetPin = useCallback(async (pin: string) => {
    if (!resetTarget) return
    setSaving(true)
    await supabase.rpc('reset_pin_karyawan', { p_id: resetTarget.id, p_pin: pin })
    setSaving(false)
    setShowResetPin(false)
    setResetTarget(null)
    fetchAll()
  }, [resetTarget, fetchAll])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => setOpenFilter(null)}>

      {/* HEADER PAKAI TEMPLATE REUSABLE (SEKARANG TAMPILAN TANGGAL SEPERTI HALAMAN LAIN) */}
      <PageHeader 
        title="Kelola Karyawan"
        onRefresh={fetchAll}
        rightContent={
          <button
            onClick={() => bukaModal()}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-all"
          >
            + Karyawan
          </button>
        }
      />

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── FILTER ── */}
        <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>

          {/* Filter Toko */}
          <div className="relative">
            <button
              onClick={() => toggleFilter('toko')}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5
                ${filterToko !== 'semua'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}`}
            >
              {labelToko}
              <span className="text-xs opacity-60">▾</span>
            </button>
            {openFilter === 'toko' && (
              <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-56 z-30">
                {[{ id_toko: 'semua', nama_toko: 'Semua Toko' }, ...tokoList].map(t => (
                  <button
                    key={t.id_toko}
                    onClick={() => { setFilterToko(t.id_toko); setOpenFilter(null) }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors
                      ${filterToko === t.id_toko ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                  >
                    {t.nama_toko}
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
                ${filterAktif !== 'semua'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}`}
            >
              {labelStatus}
              <span className="text-xs opacity-60">▾</span>
            </button>
            {openFilter === 'status' && (
              <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40 z-30">
                {[
                  { value: 'semua',    label: 'Status' },
                  { value: 'aktif',    label: 'Aktif' },
                  { value: 'nonaktif', label: 'Nonaktif' },
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => { setFilterAktif(s.value as 'semua' | 'aktif' | 'nonaktif'); setOpenFilter(null) }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors
                      ${filterAktif === s.value ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── STAT MINI ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Karyawan', value: `${stats.total}`,    warna: 'text-gray-900' },
            { label: 'Aktif',          value: `${stats.aktif}`,    warna: 'text-gray-900' },
            { label: 'Nonaktif',       value: `${stats.nonaktif}`, warna: stats.nonaktif > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
              <p className={`text-sm font-bold ${s.warna}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── GRID KARYAWAN ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Memuat karyawan...</p>
            </div>
          ) : karyawanFiltered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-gray-500">Belum ada karyawan</p>
              <button onClick={() => bukaModal()}
                className="mt-3 text-xs font-semibold text-gray-900 underline">
                + Tambah sekarang
              </button>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {karyawanFiltered.map(k => (
                <KartuKaryawan
                  key={k.id}
                  k={k}
                  onEdit={bukaModal}
                  onToggle={handleToggle}
                  onResetPin={k2 => { setResetTarget(k2); setShowResetPin(true) }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {showModal && (
        <ModalKaryawan
          form={form} tokoList={tokoList} editId={editId}
          saving={saving} errorMsg={errorMsg}
          onChange={handleChange} onSave={handleSave} onClose={tutupModal}
        />
      )}

      {showResetPin && resetTarget && (
        <ModalResetPin
          karyawan={resetTarget} saving={saving}
          onSave={handleResetPin}
          onClose={() => { setShowResetPin(false); setResetTarget(null) }}
        />
      )}

      {showToggleModal && toggleTarget && (
        <ModalToggle
          karyawan={toggleTarget} saving={saving}
          onConfirm={confirmToggle}
          onClose={() => { setShowToggleModal(false); setToggleTarget(null) }}
        />
      )}
    </div>
  )
}