'use client';
import { useState, useEffect } from 'react';
import { ScanQrCode, History, Users2Icon, QrCodeIcon, CameraIcon, File, UserPlus } from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '@/lib/supabase';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('scan');

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const [mounted, setMounted] = useState(false);

  const [historyKunjungan, setHistoryKunjungan] = useState([]);
  const [historyProfil, setHistoryProfil] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [generatedDemoQr, setGeneratedDemoQr] = useState(null);
  const [inviteFormState, setInviteFormState] = useState({
    nama: '',
    instansi: '',
    whatsapp: '',
    email: '',
    menemui: '',
    keperluan: ''
  });

  // State baru untuk Waktu dan Tanggal Real-time
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Helper untuk format tanggal Indonesia
  const formatHariTanggal = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const ToastAdmin = Swal.mixin({
    background: '#1e293b',
    color: '#f8fafc',
    confirmButtonColor: '#0284c7',
    cancelButtonColor: '#334155',
    customClass: {
      popup: 'rounded-2xl border border-slate-700 shadow-xl',
      title: 'font-bold tracking-wide text-lg',
      htmlContainer: 'text-xs text-slate-400 font-medium',
      confirmButton: 'px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider',
      cancelButton: 'px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider'
    }
  });

  const [showAnimation, setShowAnimation] = useState(false);
  const [animationType, setAnimationType] = useState('success');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerInstance, setScannerInstance] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedData, setSelectedData] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Fetch data kunjungan dari Supabase (Fix Inner Join Berbasis NIK)
  const fetchKunjungan = async () => {
    const { data, error } = await supabase
      .from('kunjungan_tamu')
      .select(`
                *,
                profil_tamu!inner (
                    nama,
                    instansi,
                    whatsapp,
                    email
                )
            `)
      .order('id', { ascending: false });

    if (error) {
      console.error("Gagal mengambil data kunjungan:", error.message);
    } else if (data) {
      const formattedData = data.map(item => ({
        ...item,
        nama: item.profil_tamu?.nama || '-',
        instansi: item.profil_tamu?.instansi || '-',
        whatsapp: item.profil_tamu?.whatsapp || '-',
        email: item.profil_tamu?.email || '-'
      }));
      setHistoryKunjungan(formattedData);
    }
  };

  // Fetch data profil master dari Supabase
  const fetchProfil = async () => {
    const { data, error } = await supabase
      .from('profil_tamu')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error("Gagal mengambil data profil:", error.message);
    } else if (data) {
      setHistoryProfil(data);
    }
  };

  const refreshAllData = () => {
    fetchKunjungan();
    fetchProfil();
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      refreshAllData();
    }
  }, [isAdminAuthenticated]);

  // Handler Submit Kirim Undangan Admin (FIX BUG DUPLICATE EMAIL)
  const handleSendInvite = async (e) => {
    e.preventDefault();
    setIsSendingInvite(true);

    try {
      const randomString = Math.random().toString(36).substring(2, 6).toUpperCase();
      const kodeBooking = `SQ-${Date.now()}-${randomString}`;
      
      const guestNik = 'GUEST-' + Math.floor(100000 + Math.random() * 900000);
      
      // FIX: Jika email kosong/strip, jadikan null agar tidak memicu error UNIQUE di Supabase
      const cleanEmail = inviteFormState.email.trim();
      const dbEmail = (cleanEmail === '' || cleanEmail === '-') ? null : cleanEmail;

      let finalNik = guestNik;
      const { data: existingProfil } = await supabase
        .from('profil_tamu')
        .select('nik')
        .eq('whatsapp', inviteFormState.whatsapp.trim())
        .maybeSingle();

      if (existingProfil) {
        finalNik = existingProfil.nik;
      } else {
        const { error: profError } = await supabase
          .from('profil_tamu')
          .insert([{
            nik: guestNik,
            nama: inviteFormState.nama.trim(),
            instansi: inviteFormState.instansi.trim() || '-',
            whatsapp: inviteFormState.whatsapp.trim(),
            email: dbEmail, // Menggunakan null jika tidak ada email, agar tidak bentrok
            tanda_tangan: '-'
          }]);

        if (profError) throw profError;
      }

      const { error: kunjError } = await supabase
        .from('kunjungan_tamu')
        .insert([{
          nik: finalNik,
          kode: kodeBooking,
          menemui: inviteFormState.menemui.trim(),
          keperluan: inviteFormState.keperluan.trim(),
          status: 'Pending',
          waktu_hadir: '-'
        }]);

      if (kunjError) throw kunjError;

      const msgText = `Halo *${inviteFormState.nama}*,\n\nAnda diundang untuk berkunjung.\n\n*Detail Kunjungan:*\nMenemui: ${inviteFormState.menemui}\nKeperluan: ${inviteFormState.keperluan}\n\nBerikut link QR Code kehadiran Anda, silakan tunjukkan ke petugas saat tiba di gerbang.`;
      
      try {
        await fetch('/api/admin/send-message', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 24651458'
          },
          body: JSON.stringify({
            target: inviteFormState.whatsapp,
            message: msgText,
            email: dbEmail || '-',
            subject: 'Undangan Kunjungan SowanQR',
            kode: kodeBooking
          })
        });
      } catch (apiErr) {
        console.log("API Gateway dilewati, menggunakan fallback UI.");
      }

      setGeneratedDemoQr(kodeBooking);

      ToastAdmin.fire({
        title: 'Undangan Dibuat!',
        text: `Tamu ${inviteFormState.nama} berhasil didaftarkan dengan Kode: ${kodeBooking}.`,
        icon: 'success',
        iconColor: '#10b981'
      });

      setInviteFormState({ nama: '', instansi: '', whatsapp: '', email: '', menemui: '', keperluan: '' });
      refreshAllData();

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuat Undangan',
        text: err.message || 'Terjadi kesalahan database.',
        background: '#1e293b',
        color: '#f8fafc'
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleScanSuccess = async (decodedText) => {
    try {
      const response = await fetch('/api/admin/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 24651458'
        },
        body: JSON.stringify({ kode: decodedText })
      });

      const result = await response.json();

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: result.type === 'check-in' ? 'Check-in Berhasil' : 'Check-out Berhasil',
          text: result.message,
          background: '#1e293b',
          color: '#f8fafc'
        });
        refreshAllData();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Scan',
          text: result.message,
          background: '#1e293b',
          color: '#f8fafc'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      html5QrcodeScanner.render(
        (text) => {
          html5QrcodeScanner.clear();
          setIsScanning(false);
          handleScanSuccess(text);
        },
        (err) => { }
      );
      setScannerInstance(html5QrcodeScanner);
    }, 300);
  };

  const stopScanner = () => {
    if (scannerInstance) {
      scannerInstance.clear();
      setIsScanning(false);
    }
  };

  const handleFileScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const html5QrCode = new Html5Qrcode("file-scan-tracker");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      await handleScanSuccess(decodedText);
    } catch (err) {
      setErrorMsg('QR Code tidak terdeteksi pada file tersebut.');
      setAnimationType('error');
      setShowAnimation(true);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === '24651458') {
      setIsAdminAuthenticated(true);
      setErrorMsg('');
    } else {
      alert('Password Admin Salah!');
    }
  };

  const openEditModal = (item, table) => {
    setSelectedData({ ...item, table });
    setEditForm(item);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 24651458'
        },
        body: JSON.stringify({
          targetTable: selectedData.table,
          id: selectedData.id,
          updateData: editForm
        })
      });

      const res = await response.json();
      if (res.success) {
        ToastAdmin.fire({ title: 'Berhasil!', text: 'Perubahan disimpan.', icon: 'success' });
        setIsEditModalOpen(false);
        refreshAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id, table) => {
    ToastAdmin.fire({
      title: 'Hapus Data?',
      text: "Tindakan ini tidak dapat dibatalkan.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const response = await fetch(`/api/admin?table=${table}&id=${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer 24651458' }
        });
        const res = await response.json();
        if (res.success) {
          ToastAdmin.fire({ title: 'Terhapus!', icon: 'success' });
          refreshAllData();
        }
      }
    });
  };

  const dapatkanDataChartKunjungan = () => {
    const hitungPerInstansi = {};
    const tamuSudahScan = historyKunjungan.filter(item => item.status === 'Hadir' || item.status === 'Selesai');
    tamuSudahScan.forEach(item => {
      const instansi = item.instansi || 'Umum';
      hitungPerInstansi[instansi] = (hitungPerInstansi[instansi] || 0) + 1;
    });
    return Object.keys(hitungPerInstansi).map(key => ({
      name: key.length > 10 ? key.substring(0, 10) + '..' : key,
      Tamu: hitungPerInstansi[key]
    })).slice(0, 6);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-slate-950"></div>;

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-2 tracking-wide">Panel Petugas SowanQR</h2>
          <p className="text-slate-400 text-sm mb-6">Masukkan kata sandi khusus petugas untuk masuk ke panel kontrol.</p>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              required
              placeholder="Masukkan Password Admin"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
            />
            <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl text-sm">
              Buka Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      <div id="file-scan-tracker" className="hidden"></div>

      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-sky-400">
              <QrCodeIcon className='w-5 h-5' />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-wide">SowanQR Control Center</h1>
              <p className="text-xs text-sky-400 font-medium tracking-wide">Panel Control Dashboard</p>
            </div>
          </div>
          <button onClick={refreshAllData} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl border border-slate-700">
            Refresh Database
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* TAB NAVIGATION MENU (Kini Ditambah Tombol Kirim Undangan) */}
        <div className="flex overflow-x-auto pb-2 mb-6 gap-1.5 scrollbar-none snap-x">
          {[
            { id: 'scan', label: 'Scan QR', icon: <ScanQrCode className="w-4 h-4" /> },
            { id: 'invite', label: 'Kirim Undangan', icon: <UserPlus className="w-4 h-4" /> },
            { id: 'history', label: 'Riwayat', icon: <History className="w-4 h-4" /> },
            { id: 'profil', label: 'Profil User', icon: <Users2Icon className="w-4 h-4" /> },
            { id: 'statistik', label: 'Statistik', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition ${activeTab === tab.id ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'scan' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[380px]">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Metode 1: Scan Lewat Kamera</h3>
                <p className="text-xs text-slate-400 mb-2">Gunakan kamera perangkat secara realtime untuk memvalidasi tiket masuk.</p>
                <div className="flex items-center gap-2 text-[11px] font-medium text-sky-400 bg-sky-500/5 border border-sky-500/10 px-3 py-1.5 rounded-xl w-fit mb-4">
                  <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse"></span>
                  <span>{formatHariTanggal(currentTime)} - {currentTime.toLocaleTimeString('id-ID')} WIB</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 rounded-xl p-4 border border-slate-850 relative">
                {isScanning ? <div id="reader" className="w-full max-w-[300px] overflow-hidden rounded-lg"></div> : <p className="text-xs text-slate-500">Kamera dalam keadaan nonaktif</p>}
              </div>
              <div className="mt-4">
                {isScanning ? <button onClick={stopScanner} className="w-full py-2.5 bg-slate-950 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl">Matikan Kamera</button> : <button onClick={startScanner} className="w-full py-2.5 bg-sky-600 text-white text-xs font-semibold rounded-xl">Aktifkan Scanner Kamera</button>}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-[380px]">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Metode 2: Upload File QR Code</h3>
                <p className="text-xs text-slate-400 mb-2">Gunakan metode ini jika pengunjung mengirimkan foto/screenshot QR.</p>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950 p-6 text-center relative">
                <input type="file" accept="image/*" onChange={handleFileScan} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <span className="text-xs font-semibold text-slate-300 block mb-1">Pilih atau Drag File Gambar Disini</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTERFACES FORM KIRIM UNDANGAN ADMIN */}
        {activeTab === 'invite' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm md:col-span-2">
              <h3 className="text-sm font-bold text-white mb-1">Kirim Undangan Akses Cepat (Express Visitor)</h3>
              <p className="text-xs text-slate-400 mb-4">Masukkan data tamu. Sistem otomatis membuat kode booking khusus dan mengirimkan QR Code.</p>
              
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Nama Lengkap Tamu *</label>
                    <input type="text" required value={inviteFormState.nama} onChange={(e) => setInviteFormState({ ...inviteFormState, nama: e.target.value })} className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none" placeholder="Contoh: Pak Budi" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Instansi / Perusahaan</label>
                    <input type="text" value={inviteFormState.instansi} onChange={(e) => setInviteFormState({ ...inviteFormState, instansi: e.target.value })} className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none" placeholder="Contoh: PT. Maju Bersama" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">No. WhatsApp (Gunakan Awalan 08/62) *</label>
                    <input type="text" required value={inviteFormState.whatsapp} onChange={(e) => setInviteFormState({ ...inviteFormState, whatsapp: e.target.value })} className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none" placeholder="Contoh: 0812345678" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Alamat Email (Opsional)</label>
                    <input type="email" value={inviteFormState.email} onChange={(e) => setInviteFormState({ ...inviteFormState, email: e.target.value })} className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none" placeholder="Gunakan jika ingin kirim email" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Pegawai Yang Menemui *</label>
                    <input type="text" required value={inviteFormState.menemui} onChange={(e) => setInviteFormState({ ...inviteFormState, menemui: e.target.value })} className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none" placeholder="Contoh: Kepala Sekolah / Guru RPL" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Keperluan Kunjungan *</label>
                    <input type="text" required value={inviteFormState.keperluan} onChange={(e) => setInviteFormState({ ...inviteFormState, keperluan: e.target.value })} className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-sky-500 focus:outline-none" placeholder="Contoh: Monitoring Prakerin / Silaturahmi" />
                  </div>
                </div>

                <button type="submit" disabled={isSendingInvite} className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold text-xs rounded-xl transition">
                  {isSendingInvite ? 'Sedang Memproses & Mengirim Pesan...' : 'Buat Undangan & Kirim Akses Otomatis'}
                </button>
              </form>
            </div>

            {/* Preview Panel QR Cadangan di Samping */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
              <h4 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Pratinjau QR Undangan</h4>
              {generatedDemoQr ? (
                <div className="p-4 bg-white rounded-2xl border border-slate-700 inline-block mb-3">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${generatedDemoQr}`} alt="QR Code" className="w-[150px] h-[150px]" />
                  <p className="text-[11px] font-mono font-bold text-sky-600 mt-2">{generatedDemoQr}</p>
                </div>
              ) : (
                <div className="w-[180px] h-[180px] border border-dashed border-slate-800 bg-slate-950 rounded-2xl flex items-center justify-center text-slate-600 text-xs p-4 mb-3">
                  QR otomatis muncul setelah sukses kirim undangan
                </div>
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">Gunakan pratinjau ini untuk scan langsung di layar jika nomor WA penerima sedang tidak aktif.</p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-850/30 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="px-6 py-4">Kode Booking</th>
                    <th className="px-6 py-4">Nama Tamu</th>
                    <th className="px-6 py-4">Instansi</th>
                    <th className="px-6 py-4">Menemui</th>
                    <th className="px-6 py-4">Keperluan</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Jam Masuk</th>
                    <th className="px-6 py-4">Jam Keluar</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {historyKunjungan.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-xs text-slate-500">Belum ada riwayat data kunjungan.</td></tr>
                  ) : (
                    historyKunjungan.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-850/10 transition-all">
                        <td className="px-6 py-4 text-xs font-semibold text-sky-400 tracking-wide">{item.kode}</td>
                        <td className="px-6 py-4 text-xs font-medium text-white">{item.nama}</td>
                        <td className="px-6 py-4 text-xs text-slate-300">{item.instansi}</td>
                        <td className="px-6 py-4 text-xs text-slate-300 font-medium">{item.menemui}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">{item.keperluan}</td>
                        <td className="px-6 py-4 text-xs">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase ${item.status === 'Hadir' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : item.status === 'Selesai' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                          {item.jam_masuk ? new Date(item.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-'}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                          {item.jam_keluar ? new Date(item.jam_keluar).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '-'}
                        </td>
                        <td className="px-6 py-4 text-xs text-center space-x-1.5 whitespace-nowrap">
                          <button onClick={() => openEditModal(item, 'kunjungan_tamu')} className="bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-sky-400 font-medium transition-all">Edit</button>
                          <button onClick={() => handleDelete(item.id, 'kunjungan_tamu')} className="bg-slate-800 hover:bg-rose-950/20 px-2.5 py-1.5 rounded-lg text-rose-400 font-medium transition-all">Hapus</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sisa views (Statistik dan Profil) */}
        {activeTab === 'statistik' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Booking</p>
                <h4 className="text-xl font-bold text-slate-200 mt-1">
                  {historyKunjungan.length} <span className="text-xs font-normal text-slate-500">tamu</span>
                </h4>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl ring-1 ring-emerald-500/20">
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Tamu Check-In
                </p>
                <h4 className="text-xl font-bold text-emerald-400 mt-1">
                  {historyKunjungan.filter(item => item.status === 'Hadir' || item.status === 'Selesai').length} <span className="text-xs font-normal text-slate-500">tamu</span>
                </h4>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl sm:col-span-1 col-span-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Akun Terdaftar</p>
                <h4 className="text-xl font-bold text-sky-400 mt-1">
                  {historyProfil.length} <span className="text-xs font-normal text-slate-500">user</span>
                </h4>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="mb-4">
                <h4 className="text-xs font-semibold tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                  Statistik Instansi (Real-time)
                </h4>
              </div>

              <div className="w-full h-60 text-slate-300 text-[10px]">
                {!mounted ? (
                  <div className="h-full flex items-center justify-center text-slate-500">Memuat grafik...</div>
                ) : (() => {
                  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } = require('recharts');
                  const dataChart = dapatkanDataChartKunjungan();

                  if (dataChart.length === 0) {
                    return <div className="h-full flex items-center justify-center text-slate-500 font-medium">Belum ada data masuk.</div>
                  }

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataChart} margin={{ top: 10, right: 5, left: -30, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="#475569"
                          fontSize={9}
                          tickLine={false}
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis stroke="#475569" fontSize={9} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', fontSize: '10px' }}
                          itemStyle={{ color: '#38bdf8', fontWeight: 'bold' }}
                        />
                        <Bar
                          dataKey="Tamu"
                          fill="url(#colorSkyAdmin)"
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true}
                          animationDuration={600}
                        >
                          <defs>
                            <linearGradient id="colorSkyAdmin" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.1} />
                            </linearGradient>
                          </defs>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profil' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-850/30 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                    <th className="px-6 py-4">NIK</th>
                    <th className="px-6 py-4">Nama Lengkap</th>
                    <th className="px-6 py-4">Alamat Email</th>
                    <th className="px-6 py-4">Instansi</th>
                    <th className="px-6 py-4">WhatsApp</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {historyProfil.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-xs text-slate-500">Belum ada profil terdaftar.</td></tr>
                  ) : (
                    historyProfil.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-850/10 transition-all">
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono tracking-wide">{item.nik}</td>
                        <td className="px-6 py-4 text-xs font-medium text-white">{item.nama}</td>
                        <td className="px-6 py-4 text-xs text-slate-300">{item.email || '-'}</td>
                        <td className="px-6 py-4 text-xs text-slate-300">{item.instansi}</td>
                        <td className="px-6 py-4 text-xs text-slate-300 font-mono">{item.whatsapp}</td>
                        <td className="px-6 py-4 text-xs text-center space-x-1.5 whitespace-nowrap">
                          <button onClick={() => openEditModal(item, 'profil_tamu')} className="bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-sky-400 font-medium transition-all">Edit</button>
                          <button onClick={() => handleDelete(item.id, 'profil_tamu')} className="bg-slate-800 hover:bg-rose-950/20 px-2.5 py-1.5 rounded-lg text-rose-400 font-medium transition-all">Hapus</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modals Section (Edit Modal tetap di sini) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white tracking-wide">Edit Data ({selectedData?.table === 'kunjungan_tamu' ? 'Kunjungan' : 'Profil'})</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {selectedData?.table === 'kunjungan_tamu' ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Nama Orang Yang Ingin Menemui</label>
                    <input type="text" value={editForm.menemui || ''} onChange={(e) => setEditForm({ ...editForm, menemui: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Keperluan</label>
                    <textarea value={editForm.keperluan || ''} onChange={(e) => setEditForm({ ...editForm, keperluan: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white h-20 focus:outline-none focus:border-sky-500"></textarea>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Status Kehadiran</label>
                    <select value={editForm.status || 'Pending'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500">
                      <option value="Pending">Pending</option>
                      <option value="Hadir">Hadir</option>
                      <option value="Selesai">Selesai (Pulang)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Nama Lengkap Tamu</label>
                    <input type="text" value={editForm.nama || ''} onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Alamat Email</label>
                    <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500" placeholder="contoh@tamu.com" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Instansi / Perusahaan</label>
                    <input type="text" value={editForm.instansi || ''} onChange={(e) => setEditForm({ ...editForm, instansi: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">No WhatsApp</label>
                    <input type="text" value={editForm.whatsapp || ''} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-500" />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl">Batal</button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}