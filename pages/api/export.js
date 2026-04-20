import { supabase } from '../../lib/supabase'

export const config = {
  api: { responseLimit: '10mb' }
}

async function getData(type) {
  if (type === 'barang') {
    const { data, error } = await supabase
      .from('v_stok').select('*').order('nama')
    if (error) throw error
    return (data || []).map(x => ({
      nama: x.nama, jenis: x.jenis, stok_awal: x.stok_awal,
      total_masuk: x.total_masuk, total_keluar: x.total_keluar, stok_akhir: x.stok_akhir,
    }))
  }
  if (type === 'pemasukan') {
    const { data, error } = await supabase
      .from('pemasukan').select('*, barang(nama, jenis)').order('tanggal', { ascending: false })
    if (error) throw error
    return (data || []).map(x => ({
      tanggal: x.tanggal, pengirim: x.pengirim,
      nama_barang: x.barang?.nama ?? '', jenis: x.barang?.jenis ?? '',
      jumlah: x.jumlah, keterangan: x.keterangan ?? '',
    }))
  }
  if (type === 'pengeluaran') {
    const { data, error } = await supabase
      .from('pengeluaran').select('*, barang(nama, jenis)').order('tanggal', { ascending: false })
    if (error) throw error
    return (data || []).map(x => ({
      tanggal: x.tanggal, penerima: x.penerima,
      nama_barang: x.barang?.nama ?? '', jenis: x.barang?.jenis ?? '',
      jumlah: x.jumlah, keterangan: x.keterangan ?? '',
    }))
  }
  return []
}

function toCSV(rows) {
  if (!rows.length) return 'Tidak ada data'
  const keys = Object.keys(rows[0])
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [
    keys.join(','),
    ...rows.map(row => keys.map(k => escape(row[k])).join(','))
  ].join('\r\n')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { type, format } = req.query
  if (!['barang','pemasukan','pengeluaran'].includes(type))
    return res.status(400).json({ error: 'type tidak valid' })
  if (!['csv','json'].includes(format))
    return res.status(400).json({ error: 'format tidak valid' })

  try {
    const data = await getData(type)
    const ts = new Date().toISOString().slice(0,10)
    const filename = `dans_${type}_${ts}`

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).send(JSON.stringify(data, null, 2))
    }

    // CSV with BOM for Excel compatibility
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send('\uFEFF' + toCSV(data))
  } catch (err) {
    console.error('[export]', err)
    return res.status(500).json({ error: err.message || 'Export gagal' })
  }
}
