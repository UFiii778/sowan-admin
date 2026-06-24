import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function passwordAdminValid(request) {
  const tokenUtama = request.headers.get('authorization');
  const tokenAlternatif = request.headers.get('Authorization');
  
  const tokenFinal = tokenUtama || tokenAlternatif;
  
  if (!tokenFinal) return false;
  return tokenFinal.trim() === 'Bearer 24651458';
}

// 1. ENDPOINT UNTUK UPDATE DATA (PUT)
export async function PUT(request) {
  if (!passwordAdminValid(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { targetTable, id, updateData } = await request.json();

    if (!['kunjungan_tamu', 'profil_tamu'].includes(targetTable)) {
      return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
    }

    let cleanPayload = {};

    if (targetTable === 'kunjungan_tamu') {
      cleanPayload = {
        menemui: updateData.menemui,
        keperluan: updateData.keperluan,
        status: updateData.status,
        waktu_hadir: updateData.waktu_hadir
      };
    } else if (targetTable === 'profil_tamu') {
      cleanPayload = {
        nama: updateData.nama,
        instansi: updateData.instansi,
        whatsapp: updateData.whatsapp
      };
    }

    const { data, error } = await supabaseAdmin
      .from(targetTable)
      .update(cleanPayload)
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("🚨 Gagal melakukan PUT:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// 2. ENDPOINT UNTUK DELETE DATA (DELETE)
export async function DELETE(request) {
  if (!passwordAdminValid(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetTable = searchParams.get('table');
    const id = searchParams.get('id');

    if (!['kunjungan_tamu', 'profil_tamu'].includes(targetTable) || !id) {
      return NextResponse.json({ success: false, message: 'Parameter tidak valid' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(targetTable)
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err) {
    console.error("🚨 Gagal melakukan DELETE:", err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}