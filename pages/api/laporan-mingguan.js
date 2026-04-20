import { supabase } from '../../lib/supabase'
import { sendTelegram, fmtNum, fmtDateShort } from '../../lib/telegram'

export const config = {
  maxDuration: 30,
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Rentang: 7 hari ke belakang
    const endDate   = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 6)

    const start = startDate.toISOString().slice(0, 10)
    const end   = endDate.toISOString().slice(0, 10)

    // Pemasukan minggu ini
    const { data: masukData } = await supabase
      .from('pemasukan')
      .select('*, barang(nama, jenis)')
      .gte('tanggal', start)
      .lte('tanggal', end)
      .order('tanggal')

    // Pengeluaran minggu ini
    const { data: keluarData } = await supabase
      .from('pengeluaran')
      .select('*, barang(nama, jenis)')
      .gte('tanggal', start)
      .lte('tanggal', end)
      .order('tanggal')

    // Stok akhir semua barang
    const { data: stokData } = await supabase
      .from('v_stok')
      .select('*')
      .order('nama')

    const masuk  = masukData  || []
    const keluar = keluarData || []
    const stok   = stokData   || []

    // Rekap per barang (masuk)
    const rekap = {}
    for (const b of stok) {
      rekap[b.id] = {
        nama: b.nama, jenis: b.jenis,
        stok_akhir: b.stok_akhir,
        masuk_minggu: 0, keluar_minggu: 0,
        pengirim: new Set(), penerima: new Set(),
      }
    }
    for (const m of masuk) {
      if (rekap[m.barang_id]) {
        rekap[m.barang_id].masuk_minggu += m.jumlah
        if (m.pengirim) rekap[m.barang_id].pengirim.add(m.pengirim)
      }
    }
    for (const k of keluar) {
      if (rekap[k.barang_id]) {
        rekap[k.barang_id].keluar_minggu += k.jumlah
        if (k.penerima) rekap[k.barang_id].penerima.add(k.penerima)
      }
    }

    const totalMasukUnit  = masuk.reduce((s, x) => s + x.jumlah, 0)
    const totalKeluarUnit = keluar.reduce((s, x) => s + x.jumlah, 0)

    let msg = ''
    msg += `📊 <b>LAPORAN MINGGUAN — DAN'S INVENTORY</b>\n`
    msg += `📅 ${fmtDateShort(start)} s/d ${fmtDateShort(end)}\n`
    msg += `${'─'.repeat(32)}\n\n`

    // RINGKASAN
    msg += `📈 <b>RINGKASAN MINGGU INI</b>\n`
    msg += `   Transaksi Masuk  : ${masuk.length} transaksi (+${fmtNum(totalMasukUnit)} unit)\n`
    msg += `   Transaksi Keluar : ${keluar.length} transaksi (-${fmtNum(totalKeluarUnit)} unit)\n`
    msg += `   Pengirim unik    : ${new Set(masuk.map(m => m.pengirim)).size}\n`
    msg += `   Penerima unik    : ${new Set(keluar.map(k => k.penerima)).size}\n\n`

    // DETAIL PER BARANG
    msg += `📦 <b>PERGERAKAN PER BARANG</b>\n`
    const aktifList = Object.values(rekap).filter(r => r.masuk_minggu > 0 || r.keluar_minggu > 0)
    if (aktifList.length === 0) {
      msg += `   Tidak ada pergerakan barang minggu ini\n`
    } else {
      for (const r of aktifList) {
        msg += `\n   <b>${r.nama}</b> [${r.jenis}]\n`
        if (r.masuk_minggu > 0) {
          msg += `   ┣ Masuk    : +${fmtNum(r.masuk_minggu)}\n`
          if (r.pengirim.size) msg += `   ┃  Dari  : ${[...r.pengirim].join(', ')}\n`
        }
        if (r.keluar_minggu > 0) {
          msg += `   ┣ Keluar   : -${fmtNum(r.keluar_minggu)}\n`
          if (r.penerima.size) msg += `   ┃  Ke    : ${[...r.penerima].join(', ')}\n`
        }
        msg += `   ┗ Stok Akhir: <b>${fmtNum(r.stok_akhir)}</b>\n`
      }
    }

    msg += `\n`

    // STOK RENDAH (warning)
    const stokRendah = stok.filter(b => b.stok_akhir <= 10)
    if (stokRendah.length > 0) {
      msg += `⚠️ <b>STOK RENDAH (≤10)</b>\n`
      for (const b of stokRendah) {
        msg += `   • ${b.nama} [${b.jenis}] — Sisa: <b>${fmtNum(b.stok_akhir)}</b>\n`
      }
      msg += `\n`
    }

    // STOK PENUH
    msg += `📋 <b>REKAP STOK AKHIR SEMUA BARANG</b>\n`
    for (const b of stok) {
      const bar = b.stok_akhir <= 10 ? '⚠️' : '✅'
      msg += `   ${bar} ${b.nama}: <b>${fmtNum(b.stok_akhir)}</b> ${b.jenis}\n`
    }

    msg += `\n${'─'.repeat(32)}\n`
    msg += `🤖 <i>DAN'S Inventory System — Laporan Mingguan Otomatis</i>`

    const sent = await sendTelegram(msg)

    return res.status(200).json({
      ok: true, sent,
      periode: `${start} s/d ${end}`,
      masuk: masuk.length,
      keluar: keluar.length,
    })

  } catch (err) {
    console.error('[laporan-mingguan]', err)
    return res.status(500).json({ error: err.message })
  }
}
