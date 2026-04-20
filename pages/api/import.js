import { supabase } from '../../lib/supabase'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, rows } = req.body

  if (!type || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Payload tidak valid. Butuh: { type, rows: [...] }' })
  }

  if (!['barang', 'pemasukan', 'pengeluaran'].includes(type)) {
    return res.status(400).json({ error: 'type tidak valid' })
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'Data kosong' })
  }

  if (rows.length > 1000) {
    return res.status(400).json({ error: 'Maksimal 1000 baris per import' })
  }

  try {
    let inserted = 0
    let errors = []

    if (type === 'barang') {
      const validJenis = ['Bungkus','Kodi','Picis','Golong','Meter']
      const cleaned = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (!r.nama?.trim()) { errors.push(`Baris ${i+1}: nama wajib`); continue }
        if (!validJenis.includes(r.jenis)) { errors.push(`Baris ${i+1}: jenis '${r.jenis}' tidak valid`); continue }
        cleaned.push({
          nama: r.nama.trim(),
          jenis: r.jenis,
          stok_awal: parseInt(r.stok_awal) || 0,
          keterangan: r.keterangan || null,
        })
      }
      if (cleaned.length) {
        const { error } = await supabase.from('barang').insert(cleaned)
        if (error) throw error
        inserted = cleaned.length
      }
    }

    else if (type === 'pemasukan') {
      // Must lookup barang by nama
      const { data: barangList } = await supabase.from('barang').select('id, nama')
      const barangMap = {}
      for (const b of (barangList || [])) barangMap[b.nama.toLowerCase()] = b.id

      const cleaned = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (!r.tanggal) { errors.push(`Baris ${i+1}: tanggal wajib`); continue }
        if (!r.pengirim?.trim()) { errors.push(`Baris ${i+1}: pengirim wajib`); continue }
        if (!r.nama_barang?.trim()) { errors.push(`Baris ${i+1}: nama_barang wajib`); continue }
        const barang_id = barangMap[r.nama_barang.toLowerCase().trim()]
        if (!barang_id) { errors.push(`Baris ${i+1}: barang '${r.nama_barang}' tidak ditemukan`); continue }
        const jumlah = parseInt(r.jumlah)
        if (!jumlah || jumlah <= 0) { errors.push(`Baris ${i+1}: jumlah harus > 0`); continue }
        cleaned.push({
          tanggal: r.tanggal,
          pengirim: r.pengirim.trim(),
          barang_id,
          jumlah,
          keterangan: r.keterangan || null,
        })
      }
      if (cleaned.length) {
        const { error } = await supabase.from('pemasukan').insert(cleaned)
        if (error) throw error
        inserted = cleaned.length
      }
    }

    else if (type === 'pengeluaran') {
      const { data: barangList } = await supabase.from('barang').select('id, nama')
      const barangMap = {}
      for (const b of (barangList || [])) barangMap[b.nama.toLowerCase()] = b.id

      const cleaned = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (!r.tanggal) { errors.push(`Baris ${i+1}: tanggal wajib`); continue }
        if (!r.penerima?.trim()) { errors.push(`Baris ${i+1}: penerima wajib`); continue }
        if (!r.nama_barang?.trim()) { errors.push(`Baris ${i+1}: nama_barang wajib`); continue }
        const barang_id = barangMap[r.nama_barang.toLowerCase().trim()]
        if (!barang_id) { errors.push(`Baris ${i+1}: barang '${r.nama_barang}' tidak ditemukan`); continue }
        const jumlah = parseInt(r.jumlah)
        if (!jumlah || jumlah <= 0) { errors.push(`Baris ${i+1}: jumlah harus > 0`); continue }
        cleaned.push({
          tanggal: r.tanggal,
          penerima: r.penerima.trim(),
          barang_id,
          jumlah,
          keterangan: r.keterangan || null,
        })
      }
      if (cleaned.length) {
        const { error } = await supabase.from('pengeluaran').insert(cleaned)
        if (error) throw error
        inserted = cleaned.length
      }
    }

    return res.status(200).json({
      ok: true,
      inserted,
      skipped: rows.length - inserted,
      errors: errors.slice(0, 20), // max 20 error messages
    })

  } catch (err) {
    console.error('[import]', err)
    return res.status(500).json({ error: err.message || 'Import gagal' })
  }
}
