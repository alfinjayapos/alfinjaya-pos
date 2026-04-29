'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

interface Karyawan {
  id: string
  nama: string
  id_toko: string
}

export default function LoginPage() {
  const router = useRouter()

  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([])
  const [selected, setSelected] = useState<Karyawan | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loadingFetch, setLoadingFetch] = useState(true)
  const [loadingLogin, setLoadingLogin] = useState(false)
  const [showList, setShowList] = useState(false)

  // Fetch karyawan
  useEffect(() => {
    const fetchKaryawan = async () => {
      setLoadingFetch(true)

      const { data } = await supabase
        .from('karyawan')
        .select('id, nama, id_toko')
        .eq('aktif', true)
        .order('nama')

      if (data) setKaryawanList(data as Karyawan[])
      setLoadingFetch(false)
    }

    fetchKaryawan()
  }, [])

  const handlePilihKaryawan = useCallback((k: Karyawan) => {
    setSelected(k)
    setPin('')
    setError('')
    setShowList(false)
  }, [])

  const handleAngka = useCallback((angka: string) => {
    setPin(prev => {
      if (prev.length >= 6) return prev
      return prev + angka
    })
  }, [])

  const handleHapus = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
  }, [])

  const handleClearPin = useCallback(() => {
    setPin('')
  }, [])

  const handleLogin = async () => {
    if (!selected || pin.length < 4) {
      setError('PIN minimal 4 angka')
      return
    }
    setLoadingLogin(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('verify_pin', {
      p_nama: selected.nama,
      p_pin:  pin,
    })

    setLoadingLogin(false)

    if (rpcError || !data?.valid) {
      setError('PIN salah')
      setPin('')
      return
    }

    localStorage.setItem(
      'pos_session',
      JSON.stringify({
        id:      data.id,
        nama:    data.nama,
        id_toko: data.id_toko,
      })
    )

    router.push('/kasir')
  }
 
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">

      {/* HEADER */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <span className="text-gray-900 text-2xl font-bold">AJ</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Alfin Jaya POS</h1>
      </div>

      {!selected ? (
        <div className="w-full max-w-md">

          {/* Tombol Dropdown */}
          <button
            onClick={() => setShowList(!showList)}
            className="w-full bg-gray-800 border border-gray-700 hover:border-yellow-500 rounded-3xl px-5 py-5 flex items-center justify-between transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-xl flex items-center justify-center text-lg">
                👤
              </div>
              <p className="font-semibold text-white text-base">
                Pilih Username
              </p>
            </div>

            <span className="text-2xl text-yellow-400">
              {showList ? '▲' : '▼'}
            </span>
          </button>

          {/* LIST */}
          {showList && (
            <div className="mt-3 bg-gray-800 border border-gray-700 rounded-3xl p-3 shadow-2xl">

              {loadingFetch ? (
                <div className="py-6 text-center text-gray-500 text-sm">
                  Memuat...
                </div>
              ) : karyawanList.length === 0 ? (
                <div className="py-6 text-center text-gray-500 text-sm">
                  Tidak ditemukan
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto space-y-2">

                  {karyawanList.map(k => (
                    <button
                      key={k.id}
                      onClick={() => handlePilihKaryawan(k)}
                      className="w-full flex items-center gap-3 bg-gray-900 hover:bg-gray-700 border border-transparent hover:border-yellow-500 rounded-xl p-3 transition-all active:scale-[0.97]"
                    >

                      <div className="w-8 h-8 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-yellow-400 font-bold">
                          {k.nama.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 text-left">
                        <p className="font-semibold text-white text-sm">
                          {k.nama}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {k.id_toko}
                        </p>
                      </div>

                    </button>
                  ))}

                </div>
              )}
            </div>
          )}
        </div>
      ) : (

        /* PIN SCREEN */
        <div className="w-full max-w-xs">

          <button
            onClick={() => {
              setSelected(null)
              setPin('')
              setError('')
              setShowList(false)
            }}
            className="text-sm text-gray-500 mb-6 hover:text-gray-300"
          >
            ← Ganti username
          </button>

          <div className="bg-gray-800 rounded-3xl border border-gray-700 p-6">

            <div className="text-center mb-6">

              <div className="w-12 h-12 bg-yellow-500/20 rounded-3xl flex items-center justify-center mx-auto mb-3">
                <span className="text-yellow-400 font-bold text-2xl">
                  {selected.nama.charAt(0).toUpperCase()}
                </span>
              </div>

              <p className="font-bold text-white text-xl">
                {selected.nama}
              </p>

              <p className="text-xs text-gray-500">
                {selected.id_toko}
              </p>

            </div>

            <div className="flex justify-center gap-3 mb-6">
              {[0,1,2,3,4,5].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < pin.length ? 'bg-yellow-500' : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center mb-4">
                {error}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">

              {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map(key => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === '⌫') handleHapus()
                    else if (key === 'C') handleClearPin()
                    else handleAngka(key)
                  }}
                  className={`h-12 rounded-xl font-semibold text-lg transition-all
                    ${
                      key === 'C' || key === '⌫'
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-700 text-white hover:bg-yellow-500 hover:text-gray-900'
                    }`}
                >
                  {key}
                </button>
              ))}

            </div>

            <button
              onClick={handleLogin}
              disabled={pin.length < 4 || loadingLogin}
              className="w-full mt-6 bg-yellow-500 text-gray-900 py-3 rounded-xl font-bold disabled:opacity-40"
            >
              {loadingLogin ? 'Memverifikasi...' : 'Masuk'}
            </button>

          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <a
          href="/owner/login"
          className="text-xs text-gray-600 hover:text-yellow-400"
        >
          Masuk sebagai Owner →
        </a>
      </div>

    </div>
  )
}