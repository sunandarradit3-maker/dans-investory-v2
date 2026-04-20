import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const JENIS_OPTIONS = ['Bungkus', 'Kodi', 'Picis', 'Golong', 'Meter']
const todayStr = () => new Date().toISOString().split('T')[0]
const fmt = n => Number(n ?? 0).toLocaleString('id-ID')

// ─── API helper ──────────────────────────────────────────────
async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Server error')
  return data
}

// ─── Export via blob (Vercel-safe, no window.open) ───────────
async function doExport(type, format, onErr) {
  try {
    const res = await fetch(`/api/export?type=${type}&format=${format}`)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || `HTTP ${res.status}`)
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `dans_${type}_${new Date().toISOString().slice(0,10)}.${format}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) { onErr(e.message) }
}

// ─── Toast ───────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const add = (msg, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, { id, msg, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
  }
  return { toasts, ok: m => add(m,'success'), err: m => add(m,'error'), info: m => add(m,'info') }
}

// ─── Confirm ─────────────────────────────────────────────────
function Confirm({ data, onCancel }) {
  if (!data) return null
  return (
    <div className="confirm-overlay open">
      <div className="confirm-box">
        <div className="confirm-header">{data.title}</div>
        <div className="confirm-body">{data.body}</div>
        <div className="confirm-footer">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Batal</button>
          <button className="btn btn-danger btn-sm" onClick={data.onOk}>Ya, Hapus</button>
        </div>
      </div>
    </div>
  )
}

// ─── Import Modal ─────────────────────────────────────────────
function ImportModal({ open, onClose, onDone, toastOk, toastErr }) {
  const [type, setType]     = useState('barang')
  const [loading, setLoad]  = useState(false)
  const [result, setResult] = useState(null)
  const [raw, setRaw]       = useState('')

  const reset = () => { setRaw(''); setResult(null) }

  const handleFile = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setRaw(ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  const run = async () => {
    if (!raw.trim()) { toastErr('Upload file JSON dulu'); return }
    let rows
    try { rows = JSON.parse(raw) }
    catch { toastErr('File JSON tidak valid'); return }
    if (!Array.isArray(rows)) { toastErr('JSON harus berupa array [...]'); return }

    setLoad(true); setResult(null)
    try {
      const r = await api('/api/import', 'POST', { type, rows })
      setResult(r)
      toastOk(`Import selesai: ${r.inserted} data berhasil dimasukkan`)
      onDone()
    } catch (e) { toastErr(e.message) }
    setLoad(false)
  }

  if (!open) return null
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 520 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Import Data dari JSON</div>
            <div className="modal-subtitle">Upload file JSON yang sebelumnya di-export</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="info-box">
            <strong>Format:</strong> Upload file <code>.json</code> hasil export dari sistem ini. Data akan ditambahkan, bukan menimpa data yang ada.
          </div>

          <div className="form-group">
            <label>Tipe Data yang Diimport</label>
            <select className="input select" value={type} onChange={e=>{setType(e.target.value);reset()}}>
              <option value="barang">Data Barang</option>
              <option value="pemasukan">Pemasukan</option>
              <option value="pengeluaran">Pengeluaran</option>
            </select>
          </div>

          <div className="form-group">
            <label>Upload File JSON</label>
            <input type="file" accept=".json" onChange={handleFile}
              style={{display:'block',padding:'8px 0',fontSize:13,color:'var(--text2)'}} />
            <div className="form-hint">
              {type==='barang' && 'Field: nama, jenis, stok_awal, keterangan'}
              {type==='pemasukan' && 'Field: tanggal, pengirim, nama_barang, jumlah, keterangan'}
              {type==='pengeluaran' && 'Field: tanggal, penerima, nama_barang, jumlah, keterangan'}
            </div>
          </div>

          {raw && (
            <div style={{background:'#f4f4f4',border:'1px solid #e0e0e0',padding:'10px 12px',fontSize:11,fontFamily:'IBM Plex Mono',color:'#525252',maxHeight:120,overflow:'auto',marginBottom:12}}>
              {raw.slice(0,400)}{raw.length>400?'\n...(terpotong)':''}
            </div>
          )}

          {result && (
            <div style={{background: result.errors?.length ? '#fff8e1':'#defbe6', border:`1px solid ${result.errors?.length?'#ffe082':'#a7f0ba'}`, padding:'12px 14px', fontSize:13}}>
              <div style={{fontWeight:600,marginBottom:6}}>Hasil Import</div>
              <div>✅ Berhasil: <strong>{result.inserted}</strong> baris</div>
              {result.skipped > 0 && <div>⏭ Dilewati: <strong>{result.skipped}</strong> baris</div>}
              {result.errors?.length > 0 && (
                <div style={{marginTop:8}}>
                  <div style={{fontWeight:600,color:'#b71c1c',marginBottom:4}}>Error:</div>
                  {result.errors.map((e,i) => <div key={i} style={{color:'#c62828',fontSize:12}}>• {e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Tutup</button>
          <button className="btn btn-primary btn-sm" onClick={run} disabled={loading || !raw}>
            {loading ? 'Memproses...' : 'Import Sekarang'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Telegram Setup Modal ─────────────────────────────────────
function TelegramModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Setup Telegram Bot</div>
            <div className="modal-subtitle">Laporan harian & mingguan otomatis ke Telegram</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-section-title">Langkah 1 — Buat Bot Telegram</div>
          <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
            1. Buka Telegram, cari <strong>@BotFather</strong><br/>
            2. Kirim perintah <code style={{background:'#f4f4f4',padding:'1px 6px'}}>/newbot</code><br/>
            3. Isi nama bot: <strong>DAN'S Inventory Bot</strong><br/>
            4. Isi username bot: misalnya <strong>dans_inventory_bot</strong><br/>
            5. BotFather akan kasih <strong>Token</strong> — copy dan simpan
          </div>

          <div className="modal-section-title">Langkah 2 — Dapatkan Chat ID</div>
          <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
            1. Start bot lo di Telegram (klik Start)<br/>
            2. Kirim pesan apa saja ke bot lo<br/>
            3. Buka browser, akses URL ini (ganti TOKEN):<br/>
            <code style={{background:'#f4f4f4',padding:'4px 8px',display:'block',margin:'8px 0',fontSize:12,wordBreak:'break-all'}}>
              https://api.telegram.org/botTOKEN/getUpdates
            </code>
            4. Cari angka di <code>"chat":&#123;"id":</code> — itu Chat ID lo
          </div>

          <div className="modal-section-title">Langkah 3 — Set di Vercel</div>
          <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
            Di Vercel Dashboard → Project → Settings → Environment Variables, tambahkan:<br/>
            <div style={{background:'#161616',color:'#f4f4f4',padding:'12px 16px',fontFamily:'IBM Plex Mono',fontSize:12,marginTop:8,lineHeight:2}}>
              <span style={{color:'#78a9ff'}}>TELEGRAM_BOT_TOKEN</span> = <span style={{color:'#42be65'}}>1234567890:ABCDEFxxxxx</span><br/>
              <span style={{color:'#78a9ff'}}>TELEGRAM_CHAT_ID</span>   = <span style={{color:'#42be65'}}>-1001234567890</span><br/>
              <span style={{color:'#78a9ff'}}>CRON_SECRET</span>        = <span style={{color:'#42be65'}}>bikin_password_sendiri</span>
            </div>
          </div>

          <div className="modal-section-title">Jadwal Laporan</div>
          <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.7}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{background:'#f4f4f4',border:'1px solid #e0e0e0',padding:'10px 14px'}}>
                <div style={{fontWeight:600,marginBottom:4}}>📋 Laporan Harian</div>
                <div style={{fontSize:12,color:'#525252'}}>Setiap hari jam <strong>20:00 WIB</strong></div>
                <div style={{fontSize:12,color:'#525252',marginTop:4}}>Isi: pemasukan & pengeluaran hari ini + rekap stok semua barang</div>
              </div>
              <div style={{background:'#f4f4f4',border:'1px solid #e0e0e0',padding:'10px 14px'}}>
                <div style={{fontWeight:600,marginBottom:4}}>📊 Laporan Mingguan</div>
                <div style={{fontSize:12,color:'#525252'}}>Setiap <strong>Senin jam 20:00 WIB</strong></div>
                <div style={{fontSize:12,color:'#525252',marginTop:4}}>Isi: ringkasan 7 hari, pergerakan per barang, peringatan stok rendah</div>
              </div>
            </div>
          </div>

          <div className="info-box" style={{marginTop:16}}>
            <strong>⚠️ Catatan:</strong> Vercel Cron hanya tersedia di plan <strong>Hobby (gratis)</strong> dengan batas 2 cron jobs — sudah cukup untuk harian + mingguan.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Mengerti</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Home() {
  const [page, setPage]         = useState('dashboard')
  const [barang, setBarang]     = useState([])
  const [pemasukan, setPemasukan] = useState([])
  const [pengeluaran, setPengeluaran] = useState([])
  const [loading, setLoading]   = useState({ b:false, p:false, k:false })
  const [clock, setClock]       = useState('')
  const toast                   = useToast()
  const [confirm, setConfirm]   = useState(null)

  // Modal open states
  const [mBarang, setMBarang]   = useState(false)
  const [mMasuk, setMMasuk]     = useState(false)
  const [mKeluar, setMKeluar]   = useState(false)
  const [mImport, setMImport]   = useState(false)
  const [mTelegram, setMTelegram] = useState(false)
  const [editBarang, setEditBarang] = useState(null)

  // Form states
  const blankBarang = { nama:'', jenis:'', stok_awal:'', keterangan:'' }
  const blankMasuk  = { tanggal:todayStr(), pengirim:'', barang_id:'', jumlah:'', keterangan:'' }
  const blankKeluar = { tanggal:todayStr(), penerima:'', barang_id:'', jumlah:'', keterangan:'' }
  const [fB, setFB] = useState(blankBarang)
  const [fM, setFM] = useState(blankMasuk)
  const [fK, setFK] = useState(blankKeluar)
  const [search, setSearch] = useState({ b:'', p:'', k:'' })

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
    tick(); const i = setInterval(tick,1000); return () => clearInterval(i)
  }, [])

  // Fetch
  const loadBarang = useCallback(async () => {
    setLoading(l=>({...l,b:true}))
    try { setBarang(await api('/api/barang')) } catch(e){ toast.err(e.message) }
    setLoading(l=>({...l,b:false}))
  }, [])
  const loadMasuk = useCallback(async () => {
    setLoading(l=>({...l,p:true}))
    try { setPemasukan(await api('/api/pemasukan')) } catch(e){ toast.err(e.message) }
    setLoading(l=>({...l,p:false}))
  }, [])
  const loadKeluar = useCallback(async () => {
    setLoading(l=>({...l,k:true}))
    try { setPengeluaran(await api('/api/pengeluaran')) } catch(e){ toast.err(e.message) }
    setLoading(l=>({...l,k:false}))
  }, [])

  useEffect(() => { loadBarang(); loadMasuk(); loadKeluar() }, [])

  const getStokAkhir = id => (barang.find(x=>x.id===id)?.stok_akhir ?? 0)

  // ─── Barang CRUD
  const submitBarang = async () => {
    if (!fB.nama.trim())  { toast.err('Nama barang wajib'); return }
    if (!fB.jenis)        { toast.err('Pilih jenis satuan'); return }
    try {
      const payload = { ...fB, stok_awal: parseInt(fB.stok_awal)||0 }
      if (editBarang) {
        await api('/api/barang','PUT',{ ...payload, id: editBarang.id })
        toast.ok('Barang diupdate')
      } else {
        await api('/api/barang','POST', payload)
        toast.ok('Barang ditambahkan')
      }
      setMBarang(false); setEditBarang(null); setFB(blankBarang)
      loadBarang()
    } catch(e){ toast.err(e.message) }
  }
  const openEdit = b => {
    setEditBarang(b)
    setFB({ nama:b.nama, jenis:b.jenis, stok_awal:b.stok_awal, keterangan:b.keterangan||'' })
    setMBarang(true)
  }
  const hapusBarang = id => setConfirm({
    title:'Hapus Barang',
    body:'Semua transaksi terkait barang ini juga terhapus. Lanjutkan?',
    onOk: async () => {
      setConfirm(null)
      try { await api('/api/barang','DELETE',{id}); toast.ok('Barang dihapus'); loadBarang(); loadMasuk(); loadKeluar() }
      catch(e){ toast.err(e.message) }
    }
  })

  // ─── Pemasukan
  const stokSebelumM = fM.barang_id ? getStokAkhir(fM.barang_id) : 0
  const stokSesudahM = stokSebelumM + (parseInt(fM.jumlah)||0)
  const submitMasuk = async () => {
    if (!fM.pengirim.trim()) { toast.err('Nama pengirim wajib'); return }
    if (!fM.barang_id)       { toast.err('Pilih barang'); return }
    if (!(parseInt(fM.jumlah)>0)) { toast.err('Jumlah harus > 0'); return }
    try {
      await api('/api/pemasukan','POST',{ ...fM, jumlah: parseInt(fM.jumlah) })
      toast.ok('Pemasukan dicatat')
      setMMasuk(false); setFM(blankMasuk)
      loadMasuk(); loadBarang()
    } catch(e){ toast.err(e.message) }
  }
  const hapusMasuk = id => setConfirm({
    title:'Hapus Transaksi', body:'Stok barang akan otomatis disesuaikan.',
    onOk: async () => {
      setConfirm(null)
      try { await api('/api/pemasukan','DELETE',{id}); toast.ok('Dihapus'); loadMasuk(); loadBarang() }
      catch(e){ toast.err(e.message) }
    }
  })

  // ─── Pengeluaran
  const stokSebelumK = fK.barang_id ? getStokAkhir(fK.barang_id) : 0
  const stokSesudahK = stokSebelumK - (parseInt(fK.jumlah)||0)
  const submitKeluar = async () => {
    if (!fK.penerima.trim()) { toast.err('Nama penerima wajib'); return }
    if (!fK.barang_id)       { toast.err('Pilih barang'); return }
    if (!(parseInt(fK.jumlah)>0)) { toast.err('Jumlah harus > 0'); return }
    try {
      await api('/api/pengeluaran','POST',{ ...fK, jumlah: parseInt(fK.jumlah) })
      toast.ok('Pengeluaran dicatat')
      setMKeluar(false); setFK(blankKeluar)
      loadKeluar(); loadBarang()
    } catch(e){ toast.err(e.message) }
  }
  const hapusKeluar = id => setConfirm({
    title:'Hapus Transaksi', body:'Stok barang akan otomatis disesuaikan.',
    onOk: async () => {
      setConfirm(null)
      try { await api('/api/pengeluaran','DELETE',{id}); toast.ok('Dihapus'); loadKeluar(); loadBarang() }
      catch(e){ toast.err(e.message) }
    }
  })

  // ─── Filter
  const fltB = barang.filter(b =>
    b.nama.toLowerCase().includes(search.b.toLowerCase()) ||
    b.jenis.toLowerCase().includes(search.b.toLowerCase()))
  const fltM = pemasukan.filter(p =>
    (p.barang?.nama||'').toLowerCase().includes(search.p.toLowerCase()) ||
    (p.pengirim||'').toLowerCase().includes(search.p.toLowerCase()) ||
    (p.tanggal||'').includes(search.p))
  const fltK = pengeluaran.filter(k =>
    (k.barang?.nama||'').toLowerCase().includes(search.k.toLowerCase()) ||
    (k.penerima||'').toLowerCase().includes(search.k.toLowerCase()) ||
    (k.tanggal||'').includes(search.k))

  // ─── Stats
  const totalStok       = barang.reduce((s,b)=>s+(b.stok_akhir??0),0)
  const totalMasukUnit  = pemasukan.reduce((s,p)=>s+p.jumlah,0)
  const totalKeluarUnit = pengeluaran.reduce((s,k)=>s+k.jumlah,0)
  const stokRendah      = barang.filter(b=>b.stok_akhir<=10)

  const pages = { dashboard:'Dashboard', barang:'Data Barang', pemasukan:'Pemasukan', pengeluaran:'Pengeluaran' }

  // ─── Shared export row
  const ExportRow = ({ type }) => (
    <div className="export-row">
      <button className="btn btn-ghost btn-sm" onClick={()=>doExport(type,'csv',toast.err)}>↓ Export CSV</button>
      <button className="btn btn-ghost btn-sm" onClick={()=>doExport(type,'json',toast.err)}>↓ Export JSON</button>
      <button className="btn btn-ghost btn-sm" onClick={()=>setMImport(true)}>↑ Import JSON</button>
    </div>
  )

  // ─── Stock preview box
  const StockPreview = ({ sebelum, delta, sesudah, isKeluar }) => (
    <div style={{background:'#f4f4f4',border:'1px solid #e0e0e0',padding:'14px 16px',marginTop:8}}>
      <div style={{fontSize:11,fontFamily:'IBM Plex Mono',color:'#525252',marginBottom:10,fontWeight:700,letterSpacing:1}}>PREVIEW STOK</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr auto 1fr',alignItems:'center',gap:8}}>
        <div>
          <div style={{fontSize:10,color:'#8d8d8d',fontFamily:'IBM Plex Mono'}}>STOK SEBELUM</div>
          <div style={{fontSize:22,fontFamily:'IBM Plex Mono',fontWeight:700}}>{fmt(sebelum)}</div>
        </div>
        <div style={{fontSize:20,color:'#8d8d8d',fontWeight:300}}>{isKeluar ? '−' : '+'}</div>
        <div>
          <div style={{fontSize:10,color:'#8d8d8d',fontFamily:'IBM Plex Mono'}}>{isKeluar?'KELUAR':'MASUK'}</div>
          <div style={{fontSize:22,fontFamily:'IBM Plex Mono',fontWeight:700,color:isKeluar?'#da1e28':'#198038'}}>{fmt(delta)}</div>
        </div>
        <div style={{fontSize:20,color:'#8d8d8d',fontWeight:300}}>=</div>
        <div>
          <div style={{fontSize:10,color:'#8d8d8d',fontFamily:'IBM Plex Mono'}}>STOK SESUDAH</div>
          <div style={{fontSize:22,fontFamily:'IBM Plex Mono',fontWeight:700,color:sesudah<0?'#da1e28':'#0f62fe'}}>
            {fmt(sesudah)}
            {sesudah<0 && <span style={{fontSize:11,marginLeft:6,color:'#da1e28',verticalAlign:'middle'}}>⚠ TIDAK CUKUP</span>}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Head>
        <title>DAN&apos;S Inventory System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="name">DAN&apos;S INVENTORY</div>
            <div className="sub">GUDANG TOPI · v2.1</div>
          </div>
          <nav>
            <div className="nav-group">
              <div className="nav-group-label">Overview</div>
              <div className={`nav-item${page==='dashboard'?' active':''}`} onClick={()=>setPage('dashboard')}>
                <span className="nav-icon">◈</span> Dashboard
              </div>
            </div>
            <div className="nav-group">
              <div className="nav-group-label">Master Data</div>
              <div className={`nav-item${page==='barang'?' active':''}`} onClick={()=>setPage('barang')}>
                <span className="nav-icon">◻</span> Data Barang
              </div>
            </div>
            <div className="nav-group">
              <div className="nav-group-label">Transaksi</div>
              <div className={`nav-item${page==='pemasukan'?' active':''}`} onClick={()=>setPage('pemasukan')}>
                <span className="nav-icon">↓</span> Pemasukan
              </div>
              <div className={`nav-item${page==='pengeluaran'?' active':''}`} onClick={()=>setPage('pengeluaran')}>
                <span className="nav-icon">↑</span> Pengeluaran
              </div>
            </div>
            <div className="nav-group">
              <div className="nav-group-label">Integrasi</div>
              <div className="nav-item" onClick={()=>setMTelegram(true)}>
                <span className="nav-icon">✈</span> Setup Telegram
              </div>
            </div>
          </nav>
          <div className="sidebar-footer">Supabase + Vercel</div>
        </aside>

        {/* MAIN */}
        <div className="main">
          <header className="topbar">
            <div className="topbar-left">
              <div className="topbar-breadcrumb">
                <span>DAN&apos;S Inventory</span>
                <span className="sep">/</span>
                <span className="current">{pages[page]}</span>
              </div>
            </div>
            <div className="topbar-right">
              {stokRendah.length > 0 && (
                <span style={{background:'#fff8e1',border:'1px solid #ffe082',color:'#b28600',padding:'3px 10px',fontSize:11,fontFamily:'IBM Plex Mono'}}>
                  ⚠ {stokRendah.length} stok rendah
                </span>
              )}
              <span className="topbar-clock">{clock}</span>
            </div>
          </header>

          <div className="content">

            {/* ══════════ DASHBOARD ══════════ */}
            {page==='dashboard' && <>
              <div className="page-header">
                <div className="page-title">Dashboard</div>
                <div className="page-desc">Ringkasan inventaris gudang topi DAN&apos;S</div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Produk</div>
                  <div className="stat-value">{barang.length}</div>
                  <div className="stat-sub">jenis barang terdaftar</div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-label">Stok Akhir</div>
                  <div className="stat-value">{fmt(totalStok)}</div>
                  <div className="stat-sub">unit tersisa di gudang</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-label">Total Pemasukan</div>
                  <div className="stat-value">{fmt(totalMasukUnit)}</div>
                  <div className="stat-sub">{pemasukan.length} transaksi</div>
                </div>
                <div className="stat-card red">
                  <div className="stat-label">Total Pengeluaran</div>
                  <div className="stat-value">{fmt(totalKeluarUnit)}</div>
                  <div className="stat-sub">{pengeluaran.length} transaksi</div>
                </div>
              </div>

              <div className="export-row" style={{marginBottom:20}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>doExport('barang','csv',toast.err)}>↓ Export Stok CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>doExport('pemasukan','csv',toast.err)}>↓ Export Pemasukan CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>doExport('pengeluaran','csv',toast.err)}>↓ Export Pengeluaran CSV</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>doExport('barang','json',toast.err)}>↓ Backup JSON</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setMImport(true)}>↑ Import JSON</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>setMTelegram(true)}>✈ Setup Telegram</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{width:40}}>#</th>
                    <th>Nama Barang</th>
                    <th>Jenis</th>
                    <th style={{textAlign:'right'}}>Stok Awal</th>
                    <th style={{textAlign:'right'}}>Total Masuk</th>
                    <th style={{textAlign:'right'}}>Total Keluar</th>
                    <th style={{textAlign:'right'}}>Stok Akhir</th>
                    <th style={{textAlign:'right',width:180}}>Formula</th>
                  </tr></thead>
                  <tbody>
                    {loading.b
                      ? <tr><td colSpan={8}><div className="loading">Memuat data</div></td></tr>
                      : barang.length===0
                        ? <tr><td colSpan={8}><div className="empty"><div className="empty-icon">◻</div>Belum ada barang. Tambah di menu Data Barang.</div></td></tr>
                        : barang.map((b,i)=>(
                          <tr key={b.id}>
                            <td className="td-mono td-center">{i+1}</td>
                            <td><strong>{b.nama}</strong></td>
                            <td><span className="badge badge-blue">{b.jenis}</span></td>
                            <td className="td-num">{fmt(b.stok_awal)}</td>
                            <td className="td-num green">+{fmt(b.total_masuk)}</td>
                            <td className="td-num red">−{fmt(b.total_keluar)}</td>
                            <td className="td-num blue" style={{fontWeight:700}}>{fmt(b.stok_akhir)}</td>
                            <td className="td-mono" style={{fontSize:10,color:'#8d8d8d',textAlign:'right'}}>
                              {b.stok_awal}+{b.total_masuk}−{b.total_keluar}={b.stok_akhir}
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </>}

            {/* ══════════ DATA BARANG ══════════ */}
            {page==='barang' && <>
              <div className="page-header">
                <div className="page-title">Data Barang</div>
                <div className="page-desc">Daftarkan semua jenis barang di gudang beserta stok awal</div>
              </div>
              <ExportRow type="barang" />
              <div className="toolbar">
                <div className="toolbar-left">
                  <div className="search-wrap">
                    <span className="search-icon">⌕</span>
                    <input className="search-input" placeholder="Cari nama / jenis..." value={search.b} onChange={e=>setSearch(s=>({...s,b:e.target.value}))} />
                  </div>
                </div>
                <div className="toolbar-right">
                  <button className="btn btn-primary btn-sm" onClick={()=>{setEditBarang(null);setFB(blankBarang);setMBarang(true)}}>
                    + Tambah Barang
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{width:40}}>#</th>
                    <th>Nama Barang</th>
                    <th>Jenis Satuan</th>
                    <th style={{textAlign:'right'}}>Stok Awal</th>
                    <th style={{textAlign:'right'}}>Total Masuk</th>
                    <th style={{textAlign:'right'}}>Total Keluar</th>
                    <th style={{textAlign:'right'}}>Stok Akhir</th>
                    <th style={{textAlign:'right',width:180}}>Formula</th>
                    <th>Keterangan</th>
                    <th style={{width:110}}>Aksi</th>
                  </tr></thead>
                  <tbody>
                    {loading.b
                      ? <tr><td colSpan={10}><div className="loading">Memuat</div></td></tr>
                      : fltB.length===0
                        ? <tr><td colSpan={10}><div className="empty"><div className="empty-icon">◻</div>{barang.length?'Tidak ditemukan':'Belum ada barang'}</div></td></tr>
                        : fltB.map((b,i)=>(
                          <tr key={b.id}>
                            <td className="td-mono td-center">{i+1}</td>
                            <td><strong>{b.nama}</strong></td>
                            <td><span className="badge badge-blue">{b.jenis}</span></td>
                            <td className="td-num">{fmt(b.stok_awal)}</td>
                            <td className="td-num green">+{fmt(b.total_masuk)}</td>
                            <td className="td-num red">−{fmt(b.total_keluar)}</td>
                            <td className="td-num blue" style={{fontWeight:700}}>{fmt(b.stok_akhir)}</td>
                            <td className="td-mono" style={{fontSize:10,color:'#8d8d8d',textAlign:'right'}}>{b.stok_awal}+{b.total_masuk}−{b.total_keluar}</td>
                            <td style={{color:'#8d8d8d',fontSize:12}}>{b.keterangan||'—'}</td>
                            <td>
                              <div style={{display:'flex',gap:4}}>
                                <button className="btn btn-ghost btn-xs" onClick={()=>openEdit(b)}>Edit</button>
                                <button className="btn btn-danger btn-xs" onClick={()=>hapusBarang(b.id)}>Hapus</button>
                              </div>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </>}

            {/* ══════════ PEMASUKAN ══════════ */}
            {page==='pemasukan' && <>
              <div className="page-header">
                <div className="page-title">Pemasukan Barang</div>
                <div className="page-desc">Catat setiap barang masuk — stok otomatis bertambah</div>
              </div>

              <div className="summary-row">
                <div className="summary-chip">
                  <div className="sc-label">Total Transaksi</div>
                  <div className="sc-val">{pemasukan.length}</div>
                </div>
                <div className="summary-chip green">
                  <div className="sc-label">Total Unit Masuk</div>
                  <div className="sc-val">+{fmt(totalMasukUnit)}</div>
                </div>
                <div className="summary-chip blue">
                  <div className="sc-label">Pengirim Unik</div>
                  <div className="sc-val">{new Set(pemasukan.map(p=>p.pengirim)).size}</div>
                </div>
              </div>

              <ExportRow type="pemasukan" />
              <div className="toolbar">
                <div className="toolbar-left">
                  <div className="search-wrap">
                    <span className="search-icon">⌕</span>
                    <input className="search-input" placeholder="Cari pengirim / barang / tgl..." value={search.p} onChange={e=>setSearch(s=>({...s,p:e.target.value}))} />
                  </div>
                </div>
                <div className="toolbar-right">
                  <button className="btn btn-primary btn-sm" onClick={()=>{setFM(blankMasuk);setMMasuk(true)}}>
                    + Tambah Pemasukan
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{width:40}}>#</th>
                    <th>Tanggal</th>
                    <th>Pengirim</th>
                    <th>Nama Barang</th>
                    <th>Jenis</th>
                    <th style={{textAlign:'right'}}>Jumlah Masuk</th>
                    <th>Keterangan</th>
                    <th style={{width:70}}>Aksi</th>
                  </tr></thead>
                  <tbody>
                    {loading.p
                      ? <tr><td colSpan={8}><div className="loading">Memuat</div></td></tr>
                      : fltM.length===0
                        ? <tr><td colSpan={8}><div className="empty"><div className="empty-icon">↓</div>{pemasukan.length?'Tidak ditemukan':'Belum ada transaksi pemasukan'}</div></td></tr>
                        : fltM.map((p,i)=>(
                          <tr key={p.id}>
                            <td className="td-mono td-center">{i+1}</td>
                            <td className="td-mono">{p.tanggal}</td>
                            <td><strong>{p.pengirim}</strong></td>
                            <td>{p.barang?.nama||'—'}</td>
                            <td><span className="badge badge-blue">{p.barang?.jenis||'—'}</span></td>
                            <td className="td-num green" style={{fontWeight:700}}>+{fmt(p.jumlah)}</td>
                            <td style={{color:'#8d8d8d',fontSize:12}}>{p.keterangan||'—'}</td>
                            <td><button className="btn btn-danger btn-xs" onClick={()=>hapusMasuk(p.id)}>Hapus</button></td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </>}

            {/* ══════════ PENGELUARAN ══════════ */}
            {page==='pengeluaran' && <>
              <div className="page-header">
                <div className="page-title">Pengeluaran Barang</div>
                <div className="page-desc">Catat setiap barang keluar — stok otomatis berkurang</div>
              </div>

              <div className="summary-row">
                <div className="summary-chip">
                  <div className="sc-label">Total Transaksi</div>
                  <div className="sc-val">{pengeluaran.length}</div>
                </div>
                <div className="summary-chip red">
                  <div className="sc-label">Total Unit Keluar</div>
                  <div className="sc-val">−{fmt(totalKeluarUnit)}</div>
                </div>
                <div className="summary-chip blue">
                  <div className="sc-label">Penerima Unik</div>
                  <div className="sc-val">{new Set(pengeluaran.map(k=>k.penerima)).size}</div>
                </div>
              </div>

              <ExportRow type="pengeluaran" />
              <div className="toolbar">
                <div className="toolbar-left">
                  <div className="search-wrap">
                    <span className="search-icon">⌕</span>
                    <input className="search-input" placeholder="Cari penerima / barang / tgl..." value={search.k} onChange={e=>setSearch(s=>({...s,k:e.target.value}))} />
                  </div>
                </div>
                <div className="toolbar-right">
                  <button className="btn btn-primary btn-sm" onClick={()=>{setFK(blankKeluar);setMKeluar(true)}}>
                    + Tambah Pengeluaran
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{width:40}}>#</th>
                    <th>Tanggal</th>
                    <th>Penerima</th>
                    <th>Nama Barang</th>
                    <th>Jenis</th>
                    <th style={{textAlign:'right'}}>Jumlah Keluar</th>
                    <th>Keterangan</th>
                    <th style={{width:70}}>Aksi</th>
                  </tr></thead>
                  <tbody>
                    {loading.k
                      ? <tr><td colSpan={8}><div className="loading">Memuat</div></td></tr>
                      : fltK.length===0
                        ? <tr><td colSpan={8}><div className="empty"><div className="empty-icon">↑</div>{pengeluaran.length?'Tidak ditemukan':'Belum ada transaksi pengeluaran'}</div></td></tr>
                        : fltK.map((k,i)=>(
                          <tr key={k.id}>
                            <td className="td-mono td-center">{i+1}</td>
                            <td className="td-mono">{k.tanggal}</td>
                            <td><strong>{k.penerima}</strong></td>
                            <td>{k.barang?.nama||'—'}</td>
                            <td><span className="badge badge-blue">{k.barang?.jenis||'—'}</span></td>
                            <td className="td-num red" style={{fontWeight:700}}>−{fmt(k.jumlah)}</td>
                            <td style={{color:'#8d8d8d',fontSize:12}}>{k.keterangan||'—'}</td>
                            <td><button className="btn btn-danger btn-xs" onClick={()=>hapusKeluar(k.id)}>Hapus</button></td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </>}

          </div>
        </div>
      </div>

      {/* ══ MODAL BARANG ══ */}
      <div className={`modal-overlay${mBarang?' open':''}`} onClick={e=>e.target===e.currentTarget&&setMBarang(false)}>
        <div className="modal">
          <div className="modal-header">
            <div>
              <div className="modal-title">{editBarang?'Edit Barang':'Tambah Barang Baru'}</div>
              <div className="modal-subtitle">Master Data → Barang</div>
            </div>
            <button className="modal-close" onClick={()=>setMBarang(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="info-box">
              Formula stok: <strong>Stok Awal + Total Pemasukan − Total Pengeluaran</strong>
            </div>
            <div className="modal-section-title">Informasi Barang</div>
            <div className="form-row">
              <div className="form-group">
                <label>Nama Barang <span style={{color:'red'}}>*</span></label>
                <input className="input" value={fB.nama} onChange={e=>setFB(f=>({...f,nama:e.target.value}))} placeholder="Contoh: Topi Polos Hitam" />
              </div>
              <div className="form-group">
                <label>Jenis Satuan <span style={{color:'red'}}>*</span></label>
                <select className="input select" value={fB.jenis} onChange={e=>setFB(f=>({...f,jenis:e.target.value}))}>
                  <option value="">— Pilih Jenis —</option>
                  {JENIS_OPTIONS.map(j=><option key={j}>{j}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Stok Awal</label>
              <input className="input" type="number" min="0" value={fB.stok_awal} onChange={e=>setFB(f=>({...f,stok_awal:e.target.value}))} placeholder="0" />
              <div className="form-hint">Jumlah barang yang sudah ada di gudang sebelum sistem ini digunakan.</div>
            </div>
            <div className="form-group">
              <label>Keterangan</label>
              <input className="input" value={fB.keterangan} onChange={e=>setFB(f=>({...f,keterangan:e.target.value}))} placeholder="Opsional..." />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost btn-sm" onClick={()=>setMBarang(false)}>Batal</button>
            <button className="btn btn-primary btn-sm" onClick={submitBarang}>{editBarang?'Simpan Perubahan':'Tambah Barang'}</button>
          </div>
        </div>
      </div>

      {/* ══ MODAL PEMASUKAN ══ */}
      <div className={`modal-overlay${mMasuk?' open':''}`} onClick={e=>e.target===e.currentTarget&&setMMasuk(false)}>
        <div className="modal">
          <div className="modal-header">
            <div>
              <div className="modal-title">Tambah Pemasukan</div>
              <div className="modal-subtitle">Transaksi → Pemasukan Barang</div>
            </div>
            <button className="modal-close" onClick={()=>setMMasuk(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="info-box">Formula: <strong>Stok Sesudah = Stok Sebelum + Jumlah Masuk</strong></div>
            <div className="modal-section-title">Detail Transaksi</div>
            <div className="form-row">
              <div className="form-group">
                <label>Tanggal <span style={{color:'red'}}>*</span></label>
                <input className="input" type="date" value={fM.tanggal} onChange={e=>setFM(f=>({...f,tanggal:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Nama Pengirim <span style={{color:'red'}}>*</span></label>
                <input className="input" value={fM.pengirim} onChange={e=>setFM(f=>({...f,pengirim:e.target.value}))} placeholder="Nama supplier / pengirim" />
              </div>
            </div>
            <div className="form-group">
              <label>Nama Barang <span style={{color:'red'}}>*</span></label>
              <select className="input select" value={fM.barang_id} onChange={e=>setFM(f=>({...f,barang_id:e.target.value}))}>
                <option value="">— Pilih Barang —</option>
                {barang.map(b=><option key={b.id} value={b.id}>{b.nama} ({b.jenis}) — Stok: {fmt(b.stok_akhir)}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Jumlah Masuk <span style={{color:'red'}}>*</span></label>
                <input className="input" type="number" min="1" value={fM.jumlah} onChange={e=>setFM(f=>({...f,jumlah:e.target.value}))} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Keterangan</label>
                <input className="input" value={fM.keterangan} onChange={e=>setFM(f=>({...f,keterangan:e.target.value}))} placeholder="Opsional..." />
              </div>
            </div>
            {fM.barang_id && (
              <StockPreview sebelum={stokSebelumM} delta={parseInt(fM.jumlah)||0} sesudah={stokSesudahM} isKeluar={false} />
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost btn-sm" onClick={()=>setMMasuk(false)}>Batal</button>
            <button className="btn btn-primary btn-sm" onClick={submitMasuk}>Simpan Pemasukan</button>
          </div>
        </div>
      </div>

      {/* ══ MODAL PENGELUARAN ══ */}
      <div className={`modal-overlay${mKeluar?' open':''}`} onClick={e=>e.target===e.currentTarget&&setMKeluar(false)}>
        <div className="modal">
          <div className="modal-header">
            <div>
              <div className="modal-title">Tambah Pengeluaran</div>
              <div className="modal-subtitle">Transaksi → Pengeluaran Barang</div>
            </div>
            <button className="modal-close" onClick={()=>setMKeluar(false)}>✕</button>
          </div>
          <div className="modal-body">
            <div className="info-box">Formula: <strong>Stok Sesudah = Stok Sebelum − Jumlah Keluar</strong></div>
            <div className="modal-section-title">Detail Transaksi</div>
            <div className="form-row">
              <div className="form-group">
                <label>Tanggal <span style={{color:'red'}}>*</span></label>
                <input className="input" type="date" value={fK.tanggal} onChange={e=>setFK(f=>({...f,tanggal:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Nama Penerima <span style={{color:'red'}}>*</span></label>
                <input className="input" value={fK.penerima} onChange={e=>setFK(f=>({...f,penerima:e.target.value}))} placeholder="Nama toko / pembeli" />
              </div>
            </div>
            <div className="form-group">
              <label>Nama Barang <span style={{color:'red'}}>*</span></label>
              <select className="input select" value={fK.barang_id} onChange={e=>setFK(f=>({...f,barang_id:e.target.value}))}>
                <option value="">— Pilih Barang —</option>
                {barang.map(b=><option key={b.id} value={b.id}>{b.nama} ({b.jenis}) — Stok: {fmt(b.stok_akhir)}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Jumlah Keluar <span style={{color:'red'}}>*</span></label>
                <input className="input" type="number" min="1" value={fK.jumlah} onChange={e=>setFK(f=>({...f,jumlah:e.target.value}))} placeholder="0" />
              </div>
              <div className="form-group">
                <label>Keterangan</label>
                <input className="input" value={fK.keterangan} onChange={e=>setFK(f=>({...f,keterangan:e.target.value}))} placeholder="Opsional..." />
              </div>
            </div>
            {fK.barang_id && (
              <StockPreview sebelum={stokSebelumK} delta={parseInt(fK.jumlah)||0} sesudah={stokSesudahK} isKeluar={true} />
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost btn-sm" onClick={()=>setMKeluar(false)}>Batal</button>
            <button className="btn btn-primary btn-sm" onClick={submitKeluar} disabled={stokSesudahK<0&&!!fK.barang_id}>
              Simpan Pengeluaran
            </button>
          </div>
        </div>
      </div>

      {/* ══ MODAL IMPORT ══ */}
      <ImportModal
        open={mImport}
        onClose={()=>setMImport(false)}
        onDone={()=>{ loadBarang(); loadMasuk(); loadKeluar() }}
        toastOk={toast.ok}
        toastErr={toast.err}
      />

      {/* ══ MODAL TELEGRAM ══ */}
      <TelegramModal open={mTelegram} onClose={()=>setMTelegram(false)} />

      {/* CONFIRM */}
      <Confirm data={confirm} onCancel={()=>setConfirm(null)} />

      {/* TOASTS */}
      <div className="toast-container">
        {toast.toasts.map(t=>(
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  )
}
