import { supabaseOwner as supabase } from '@/lib/supabase'
const BUCKET      = 'produk'  
const FOLDER      = 'produk'       
const MAX_MB      = 2               
const MAX_BYTES   = MAX_MB * 1024 * 1024

export type UploadResult =
  | { ok: true;  url: string }
  | { ok: false; error: string }


export async function uploadFotoProduk(file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'File harus berupa gambar (JPG/PNG/WebP)' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `Ukuran foto maksimal ${MAX_MB} MB` }
  }

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${FOLDER}/${Date.now()}.${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    return { ok: false, error: error.message }
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path)

  return { ok: true, url: urlData.publicUrl }
}

export async function hapusFotoProduk(url: string): Promise<void> {
  // Ekstrak path dari URL publik
  const marker = `/object/public/${BUCKET}/`
  const idx    = url.indexOf(marker)
  if (idx === -1) return   

  const path = url.slice(idx + marker.length)
  await supabase.storage.from(BUCKET).remove([path])
}

export function buatPreviewLokal(file: File): string {
  return URL.createObjectURL(file)
}

export function bebaskanPreview(previewUrl: string): void {
  if (previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl)
  }
}