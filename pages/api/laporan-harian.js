import { supabase } from '../../lib/supabase'
import { sendTelegram, fmtNum, fmtDate } from '../../lib/telegram'

// Vercel Cron: setiap hari jam 13:00 UTC = 20:00 WIB
export const config = {
  maxDuration: 30,
}

export default async function handler(req, res) {
  // Keamanan: hanya bisa dipanggil Vercel Cron atau dengan secret key
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)

    // Ambil pemasukan hari ini
    const { data: masukHariIni } = await supabase
      .from('pemasukan')
      .select('*, barang(nama, jenis)')
      .eq('tanggal', today)
      .order('created_at', { ascending: true })

    // Ambil pengeluaran hari ini
    const { data: keluarHariIni } = await supabase
      .from('pengeluaran')
      .select('*, barang(nama, jenis)')
      .eq('tanggal', today)
      .order('created_at', { ascending: true })

    // Ambil semua stok
    const { data: stokData } = await supabase
      .from('v_stok')
      .select('*')
      .order('nama')

    const masuk  = masukHariIni  || []
    const keluar = keluarHariIni || []
    const stok   = stokData      || []

    const totalMasukUnit  = masuk.reduce((s, x) => s + x.jumlah, 0)
    const totalKeluarUnit = keluar.reduce((s, x) => s + x.jumlah, 0)

    // Build pesan
    let msg = ''
    msg += `📋 <b>LAPORAN HARIAN — DAN'S INVENTORY</b>\n`
    msg += `📅 ${fmtDate(today)}\n`
    msg += `${'─'.repeat(32)}\n\n`

    // PEMASUKAN
    msg += `📥 <b>PEMASUKAN HARI INI</b>\n`
    if (masuk.length === 0) {
      msg += `   Tidak ada pemasukan\n`
    } else {
      for (const p of masuk) {
        msg += `   • <b>${p.barang?.nama}</b> (${p.barang?.jenis})\n`
        msg += `     +${fmtNum(p.jumlah)} | Dari: ${p.pengirim}\n`
        if (p.keterangan) msg += `     📝 ${p.keterangan}\n`
      }
      msg += `   <b>Total: +${fmtNum(totalMasukUnit)} unit</b>\n`
    }

    msg += `\n`

    // PENGELUARAN
    msg += `📤 <b>PENGELUARAN HARI INI</b>\n`
    if (keluar.length === 0) {
      msg += `   Tidak ada pengeluaran\n`
    } else {
      for (const k of keluar) {
        msg += `   • <b>${k.barang?.nama}</b> (${k.barang?.jenis})\n`
        msg += `     -${fmtNum(k.jumlah)} | Ke: ${k.penerima}\n`
        if (k.keterangan) msg += `     📝 ${k.keterangan}\n`
      }
      msg += `   <b>Total: -${fmtNum(totalKeluarUnit)} unit</b>\n`
    }

    msg += `\n`

    // STOK AKHIR
    msg += `📦 <b>STOK GUDANG SAAT INI</b>\n`
    if (stok.length === 0) {
      msg += `   Belum ada barang terdaftar\n`
    } else {
      for (const b of stok) {
        const emoji = b.stok_akhir <= 10 ? '⚠️' : '✅'
        msg += `   ${emoji} <b>${b.nama}</b> [${b.jenis}]\n`
        msg += `      Stok: <b>${fmtNum(b.stok_akhir)}</b> (Awal: ${fmtNum(b.stok_awal)} +${fmtNum(b.total_masuk)} -${fmtNum(b.total_keluar)})\n`
      }
    }

    msg += `\n${'─'.repeat(32)}\n`
    msg += `🤖 <i>DAN'S Inventory System — Laporan Otomatis</i>`

    const sent = await sendTelegram(msg)

    return res.status(200).json({
      ok: true,
      sent,
      date: today,
      masuk: masuk.length,
      keluar: keluar.length,
    })

  } catch (err) {
    console.error('[laporan-harian]', err)
    return res.status(500).json({ error: err.message })
  }
}
