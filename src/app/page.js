'use client';
import { useState, useEffect } from 'react';
import { ScanQrCode, History, Users2Icon, QrCodeIcon, CameraIcon, File } from 'lucide-react';
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
    background: '#1e293b', // bg-slate-800
    color: '#f8fafc',      // text-slate-50
    confirmButtonColor: '#0284c7', // bg-sky-600
    cancelButtonColor: '#334155',  // bg-slate-700
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

  // Fetch data kunjungan dari Supabase
  const fetchKunjungan = async () => {
    const { data, error } = await supabase
      .from('kunjungan_tamu')
      .select(`
                *,
                profil_tamu (
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

        if (typeof fetchKunjunganData === 'function') fetchKunjunganData();

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
      console.error("Terjadi kesalahan client-side scan:", error);
      Swal.fire({
        icon: 'error',
        title: 'Kesalahan Sistem',
        text: 'Gagal terhubung ke server API.',
        background: '#1e293b',
        color: '#f8fafc'
      });
    }
  };

  // Scan via Kamera
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

  // Scan via File Gambar Luar
  const handleFileScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const html5QrCode = new Html5Qrcode("file-scan-tracker");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      await handleScanSuccess(decodedText);
    } catch (err) {
      setErrorMsg('QR Code tidak terdeteksi pada file tersebut. Pastikan kualitas gambar jelas.');
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
        ToastAdmin.fire({
          title: 'Berhasil!',
          text: 'Perubahan data berhasil disimpan.',
          icon: 'success',
          iconColor: '#10b981'
        });
        setIsEditModalOpen(false);
        refreshAllData();
      } else {
        ToastAdmin.fire({
          title: 'Gagal Update',
          text: res.message,
          icon: 'error'
        });
      }
    } catch (err) {
      ToastAdmin.fire({
        title: 'Error',
        text: 'Terjadi kesalahan jaringan.',
        icon: 'error'
      });
    }
  };

  const handleDelete = async (id, table) => {
    ToastAdmin.fire({
      title: 'Hapus Data?',
      text: "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.",
      icon: 'warning',
      iconColor: '#f43f5e',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      reverseButtons: true
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`/api/admin?table=${table}&id=${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer 24651458'
            }
          });

          const res = await response.json();
          if (res.success) {
            ToastAdmin.fire({
              title: 'Terhapus!',
              text: 'Data berhasil dihapus dari database.',
              icon: 'success',
              iconColor: '#10b981'
            });
            refreshAllData();
          } else {
            ToastAdmin.fire({
              title: 'Gagal Menghapus',
              text: res.message,
              icon: 'error'
            });
          }
        } catch (err) {
          ToastAdmin.fire({
            title: 'Kesalahan Jaringan',
            text: 'Terjadi masalah saat menghubungi server.',
            icon: 'error'
          });
        }
      }
    });
  };

  const dapatkanDataChartKunjungan = () => {
    const hitungPerInstansi = {};
    const tamuSudahScan = historyKunjungan.filter(item => item.status === 'Hadir' || item.status === 'Selesai');

    tamuSudahScan.forEach(item => {
      const instansi = item.profil_tamu?.instansi || 'Umum';
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

  if (!mounted) {
    return <div className="min-h-screen bg-slate-950"></div>;
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" suppressHydrationWarning>
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
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all text-sm"
            />
            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl transition-all text-sm"
            >
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
              <p className="text-xs text-sky-400 font-medium tracking-wide">Panel Manajemen Kehadiran Tamu</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={refreshAllData} className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-all border border-slate-700">
              Refresh Database
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Tab Navigation Menu */}
        <div className="flex overflow-x-auto pb-2 mb-6 gap-1.5 scrollbar-none snap-x -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
          {[
            { id: 'scan', label: 'Scan QR', icon: <ScanQrCode className="w-4 h-4" /> },
            { id: 'history', label: 'Riwayat', icon: <History className="w-4 h-4" /> },
            { id: 'profil', label: 'Profil User', icon: <Users2Icon className="w-4 h-4" /> },
            { id: 'statistik', label: 'Statistik', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition duration-200 shrink-0 snap-contained ${activeTab === tab.id ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'scan' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Metode 1: Scan Lewat Kamera</h3>
                <p className="text-xs text-slate-400 mb-2">Gunakan kamera perangkat secara realtime untuk memvalidasi tiket masuk qr.</p>
                
                {/* WAKTU DAN TANGGAL REALTIME */}
                <div className="flex items-center gap-2 text-[11px] font-medium text-sky-400/90 bg-sky-500/5 border border-sky-500/10 px-3 py-1.5 rounded-xl w-fit mb-4">
                  <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse"></span>
                  <span>{formatHariTanggal(currentTime)}</span>
                  <span className="text-slate-600">|</span>
                  <span className="font-mono font-bold tracking-wider">{currentTime.toLocaleTimeString('id-ID')} WIB</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 rounded-xl p-4 border border-slate-850 relative overflow-hidden">
                {isScanning ? (
                  <div id="reader" className="w-full max-w-[300px] overflow-hidden rounded-lg"></div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto text-slate-500 text-xl mb-3"><CameraIcon className='w-5 h-5'></CameraIcon></div>
                    <p className="text-xs text-slate-500 font-medium">Kamera dalam keadaan nonaktif</p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                {isScanning ? (
                  <button onClick={stopScanner} className="w-full py-2.5 bg-slate-950 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl hover:bg-rose-950/30 transition-all">
                    Matikan Kamera
                  </button>
                ) : (
                  <button onClick={startScanner} className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-all">
                    Aktifkan Scanner Kamera
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[380px]">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Metode 2: Upload File QR Code</h3>
                <p className="text-xs text-slate-400 mb-2">Gunakan metode ini jika pengunjung mengirimkan foto/screenshot QR melalui WhatsApp.</p>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/50 p-6 text-center hover:border-sky-500/40 transition-all relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileScan}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center text-slate-400 text-xl mb-3"><File className='w-5 h-5'></File></div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">Pilih atau Drag File Gambar Disini</span>
                <span className="text-[11px] text-slate-500">Mendukung format PNG, JPG, JPEG, atau WebP</span>
              </div>

              <div className="mt-4">
                <div className="text-center text-[11px] text-sky-400 font-medium bg-sky-500/5 py-2.5 rounded-xl border border-sky-500/10">
                  Sistem akan langsung otomatis membaca tiket setelah file dipilih
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-850/30 border-b border-slate-800 text-xs font-semibold tracking-wider text-slate-400 uppercase">
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
                    <tr><td colSpan="9" className="px-6 py-12 text-center text-xs text-slate-500 font-medium">Belum ada riwayat data kunjungan.</td></tr>
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
                  <tr className="bg-slate-850/30 border-b border-slate-800 text-xs font-semibold tracking-wider text-slate-400 uppercase">
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
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-xs text-slate-500 font-medium">Belum ada profil terdaftar.</td></tr>
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

      {showAnimation && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl bg-slate-900 border text-center max-w-xs w-full mx-4 shadow-xl transform scale-100 transition-all duration-300 ${animationType === 'success' ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 text-3xl font-bold ${animationType === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {animationType === 'success' ? '✓' : '✕'}
            </div>
            <h3 className={`text-lg font-bold tracking-wide ${animationType === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {animationType === 'success' ? 'SCAN BERHASIL!' : 'SCAN GAGAL!'}
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
              {animationType === 'success' ? 'Status log absensi tamu telah berhasil dimutasi otomatis oleh sistem.' : errorMsg || 'Terjadi kesalahan, kode QR tidak dikenali.'}
            </p>
            {animationType === 'success' && scanResult && (
              <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-1">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Detail Log:</p>
                <p className="text-xs text-white font-semibold"><span className="text-slate-400 font-normal">Nama:</span> {scanResult.nama}</p>
                <p className="text-xs text-slate-300"><span className="text-slate-400 font-normal">Keterangan:</span> {scanResult.menemui}</p>
                <p className="text-[10px] text-sky-400 font-mono text-right mt-1">{scanResult.waktu_hadir}</p>
              </div>
            )}
            <button onClick={() => setShowAnimation(false)} className={`mt-5 w-full py-2 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all ${animationType === 'success' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
              Selesai & Tutup
            </button>
          </div>
        </div>
      )}

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