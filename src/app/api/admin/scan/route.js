import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Fungsi validasi token keamanan admin agar tidak bisa ditembak sembarangan
function passwordAdminValid(request) {
  const tokenUtama = request.headers.get('authorization');
  const tokenAlternatif = request.headers.get('Authorization');
  
  const tokenFinal = tokenUtama || tokenAlternatif;
  
  if (!tokenFinal) return false;
  return tokenFinal.trim() === 'Bearer 24651458';
}

export async function POST(req) {
  // 1. PROTEKSI KEAMANAN: Cek apakah request datang dari admin resmi
  if (!passwordAdminValid(req)) {
    return NextResponse.json({ success: false, message: 'Akses ditolak. Token admin tidak valid.' }, { status: 401 });
  }

  try {
    const { kode } = await req.json();

    if (!kode || kode.trim() === '') {
      return NextResponse.json({ success: false, message: 'Kode QR tidak valid atau kosong' }, { status: 400 });
    }

    const { data: kunjungan, error: fetchError } = await supabaseAdmin
      .from('kunjungan_tamu')
      .select(`
        *,
        profil_tamu ( nama )
      `)
      .eq('kode', kode.trim())
      .maybeSingle();

    if (fetchError) {
      console.error("Database Fetch Error:", fetchError.message);
      return NextResponse.json({ success: false, message: 'Gagal membaca data dari server database' }, { status: 500 });
    }

    // Jika kode QR tidak ada di database sama sekali
    if (!kunjungan) {
      return NextResponse.json({ success: false, message: 'QR Code tidak terdaftar atau tidak dikenali' }, { status: 404 });
    }

    const namaTamu = kunjungan.profil_tamu?.nama || 'Tamu';
    
    // Format waktu lokal Indonesia (WIB) untuk pencatatan real-time jam hadir
    const jamSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const waktuISO = new Date().toISOString();

    // KONDISI A: Tamu belum pernah melakukan check-in (jam_masuk masih kosong) -> PROSES CHECK-IN
    if (!kunjungan.jam_masuk) {
      const { error: updateInError } = await supabaseAdmin
        .from('kunjungan_tamu')
        .update({
          jam_masuk: waktuISO,
          waktu_hadir: jamSekarang, // Sinkronisasi teks tampilan riwayat tabel
          status: 'Hadir'
        })
        .eq('kode', kode.trim());

      if (updateInError) throw new Error(updateInError.message);

      return NextResponse.json({
        success: true,
        type: 'check-in',
        message: `Selamat datang, ${namaTamu}. Check-in berhasil dicatat!`,
        nama: namaTamu,
        jam: jamSekarang
      });
    }

    // KONDISI B: Tamu sudah masuk tapi belum pulang (jam_keluar kosong) -> PROSES CHECK-OUT
    if (kunjungan.jam_masuk && !kunjungan.jam_keluar) {
      const { error: updateOutError } = await supabaseAdmin
        .from('kunjungan_tamu')
        .update({
          jam_keluar: waktuISO,
          status: 'Selesai'
        })
        .eq('kode', kode.trim());

      if (updateOutError) throw new Error(updateOutError.message);

      return NextResponse.json({
        success: true,
        type: 'check-out',
        message: `Terima kasih atas kunjungannya, ${namaTamu}. Check-out berhasil dicatat!`,
        nama: namaTamu,
        jam: jamSekarang
      });
    }

    if (kunjungan.jam_masuk && kunjungan.jam_keluar) {
      return NextResponse.json({
        success: false,
        type: 'expired',
        message: `QR Code milik ${namaTamu} sudah kadaluwarsa karena sudah digunakan untuk Check-in & Check-out.`
      }, { status: 400 });
    }

  } catch (err) {
    console.error("🚨 Gagal melakukan POST Scan:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}