'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseOwner as supabase } from '@/lib/supabase'

export default function OwnerLoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email dan password wajib diisi')
      return
    }

    setLoading(true)
    setError('')

    try {
      // =========================
      // 0. SIGN OUT SESSION AKTIF
      // =========================
      await supabase.auth.signOut()

      // =========================
      // 1. LOGIN SUPABASE
      // =========================
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (authError || !data.user) {
        setError('Email atau password salah')
        setLoading(false)
        return
      }
// 2. CEK APAKAH OWNER
// =========================
const { data: ownerCheck } = await supabase
.from('owner_toko')
.select('id')
.eq('owner_id', data.user.id)
.limit(1)
.maybeSingle()

if (!ownerCheck) {
  setError('Akses ditolak — akun ini bukan owner')
  await supabase.auth.signOut()
  setLoading(false)
  return
}
      // =========================
      // 3. SIMPAN SESSION
      // =========================
      localStorage.setItem(
        'owner_session',
        JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          role: 'owner',
        })
      )

      // =========================
      // 4. REDIRECT
      // =========================
      router.push('/owner')

    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-gray-900 text-2xl font-bold">AJ</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Owner Panel</h1>
          <p className="text-gray-400 text-sm mt-1">Alfin Jaya Management</p>
        </div>

        <button
  onClick={() => router.push('/')}
  className="text-sm text-gray-500 hover:text-yellow-400 mb-6"
>
  ← Kembali ke Kasir
</button>

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="owner@alfinjaya.com"
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3
              text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3
              text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs mb-4">{error}</p>
          )}

          {/* Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-yellow-500 text-gray-900 py-3 rounded-xl font-bold
            hover:bg-yellow-400 disabled:opacity-40 transition-all"
          >
            {loading ? 'Memverifikasi...' : 'Masuk sebagai Owner'}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Halaman ini hanya untuk pemilik toko
        </p>
      </div>
    </div>
  )
}