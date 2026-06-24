import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    // 1. Verifikasi Token Authorization agar API ini aman dari pihak luar
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== 'Bearer 24651458') {
      return NextResponse.json({ success: false, message: 'Akses tidak sah (Unauthorized)' }, { status: 401 });
    }

    const body = await req.json();
    const { target, message, email, subject, kode } = body;

    if (!target || !kode) {
      return NextResponse.json({ success: false, message: 'Parameter target (WhatsApp) dan kode booking wajib diisi.' }, { status: 400 });
    }

    // 2. Generate Gambar QR Code dalam bentuk Base64 Data URL (untuk backup di frontend jika diperlukan)
    const qrCodeDataUrl = await QRCode.toDataURL(kode, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300
    });

    // Link gambar QR code publik menggunakan QR Server API untuk dilampirkan di teks WA/Email
    const qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${kode}`;

    let waSent = false;
    let emailSent = false;

    // 3. KIRIM WHATSAPP VIA FONNTE
    try {
      let formattedWhatsapp = target.trim();
      if (formattedWhatsapp.startsWith('0')) {
        formattedWhatsapp = '62' + formattedWhatsapp.slice(1);
      } else if (formattedWhatsapp.startsWith('+')) {
        formattedWhatsapp = formattedWhatsapp.replace('+', '');
      }

      const formData = new URLSearchParams();
      formData.append('target', formattedWhatsapp);
      // Teks pesan ditambahkan link gambar QR publik agar otomatis memunculkan preview gambar di WhatsApp
      formData.append('message', `${message}\n\nLink Tiket QR Anda:\n${qrPublicUrl}`);

      const waResponse = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          'Authorization': process.env.WA_GATEWAY_TOKEN // Pastikan token ini ada di .env kamu
        },
        body: formData
      });

      const waResult = await waResponse.json();
      if (waResult.status === true) {
        waSent = true;
      }
      console.log('Respons Admin Fonnte:', waResult);
    } catch (waError) {
      console.error('Gagal kirim WhatsApp via Admin API:', waError.message);
    }

    // 4. KIRIM EMAIL (Menggunakan Nodemailer)
    // Fitur ini otomatis berjalan jika email diisi dan env email dikonfigurasi
    if (email && email.trim() !== '-' && email.includes('@')) {
      try {
        // Konfigurasi transporter email (Gunakan SMTP Gmail / hosting kamu)
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER, // Alamat Gmail kamu (misal: sowanqr@gmail.com)
            pass: process.env.EMAIL_PASS  // App Password dari Google Akun (bukan password email biasa)
          }
        });

        // Struktur template email HTML formal pameran
        const mailOptions = {
          from: `"SowanQR System" <${process.env.EMAIL_USER}>`,
          to: email.trim(),
          subject: subject || 'Undangan Kunjungan SowanQR',
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #f8fafc;">
              <h2 style="color: #0284c7; text-align: center; margin-bottom: 5px;">Undangan Kunjungan</h2>
              <p style="text-align: center; font-size: 12px; color: #64748b; margin-top: 0;">Sistem Manajemen Tamu SowanQR</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                ${message.replace(/\n/g, '<br>')}
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 12px; color: #475569; font-weight: bold; margin-bottom: 10px;">SILAKAN SCAN QR CODE INI DI GERBANG MASUK</p>
                <img src="${qrPublicUrl}" alt="QR Tiket Masuk" style="width: 200px; height: 200px; border: 4px solid #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 12px;" />
                <p style="font-family: monospace; font-size: 14px; font-weight: bold; color: #0284c7; margin-top: 10px; letter-spacing: 1px;">KODE: ${kode}</p>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 11px; color: #94a3b8; text-align: center;">Email ini dikirim otomatis oleh aplikasi SowanQR. Tidak perlu membalas email ini.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log('Email undangan berhasil dikirim ke:', email);
      } catch (emailError) {
        console.error('Gagal kirim Email via Admin API:', emailError.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Proses pengiriman pesan selesai.',
      qrBase64: qrCodeDataUrl,
      meta: {
        waSent,
        emailSent
      }
    });

  } catch (error) {
    console.error('Error di internal API send-message:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}