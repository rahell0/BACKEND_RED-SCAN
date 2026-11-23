import { Request, Response } from 'express';
import db from '../config/db';
import { generateAiReply } from '../services/aiService';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const chatAi = async (req: Request, res: Response) => {
  const waktuMulai = Date.now();

  try {
    const { messages } = req.body;

    // Validasi pesan masuk.
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pesan percakapan belum dikirim.',
      });
    }

    const validMessages: ChatMessage[] = [];

    for (const message of messages) {
      if (
        !message ||
        !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' ||
        !message.content.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Format pesan percakapan tidak valid.',
        });
      }

      if (message.content.length > 1500) {
        return res.status(400).json({
          success: false,
          message: 'Pesan maksimal 1500 karakter.',
        });
      }

      validMessages.push({
        role: message.role,
        content: message.content.trim(),
      });
    }

    // Menggunakan maksimal 12 pesan terakhir.
    const riwayat = validMessages.slice(-12);

    if (riwayat[riwayat.length - 1].role !== 'user') {
      return res.status(400).json({
        success: false,
        message: 'Pesan terakhir harus berasal dari pelanggan.',
      });
    }

    // Mengambil data menu dari database.
    const waktuMenuMulai = Date.now();

    const [menuRows]: any = await db.query(`
      SELECT
        id,
        nama_menu,
        kategori,
        harga,
        deskripsi
      FROM menu
      ORDER BY id ASC
    `);

    console.log(
      `[AI REDScan] Waktu mengambil menu: ${Date.now() - waktuMenuMulai} ms`
    );

    // Menyiapkan header streaming NDJSON.
    res.status(200);
    res.setHeader(
      'Content-Type',
      'application/x-ndjson; charset=utf-8'
    );
    res.setHeader(
      'Cache-Control',
      'no-cache, no-transform'
    );
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.flushHeaders();

    // Jika database belum memiliki menu, kirim pesan sebagai stream.
    if (!menuRows || menuRows.length === 0) {
      res.write(
        JSON.stringify({
          chunk: 'Maaf, daftar menu REDScan belum tersedia.',
        }) + '\n'
      );

      res.write(
        JSON.stringify({ done: true }) + '\n'
      );

      console.log('[AI REDScan] Database menu masih kosong.');

      return res.end();
    }

    // Memulai streaming jawaban Gemini.
    const waktuAiMulai = Date.now();
    let potonganPertama = true;
    let jumlahPotongan = 0;

    console.log('[AI REDScan] Memulai streaming Gemini...');

    for await (const potongan of generateAiReply(
      riwayat,
      menuRows
    )) {
      // Jika koneksi pelanggan terputus, hentikan pengiriman.
      if (res.destroyed || res.writableEnded) {
        console.log('[AI REDScan] Koneksi pelanggan terputus.');
        return;
      }

      if (potongan) {
        jumlahPotongan++;

        if (potonganPertama) {
          potonganPertama = false;

          console.log(
            `[AI REDScan] Waktu sampai potongan pertama: ${Date.now() - waktuAiMulai} ms`
          );
        }

        // Mengirim setiap potongan jawaban ke Flutter.
        res.write(
          JSON.stringify({
            chunk: potongan,
          }) + '\n'
        );
      }
    }

    // Memberi tahu Flutter bahwa jawaban sudah selesai.
    if (!res.destroyed && !res.writableEnded) {
      res.write(
        JSON.stringify({
          done: true,
        }) + '\n'
      );

      console.log(
        `[AI REDScan] Streaming selesai. Jumlah potongan: ${jumlahPotongan}`
      );

      console.log(
        `[AI REDScan] Waktu Gemini: ${Date.now() - waktuAiMulai} ms`
      );

      console.log(
        `[AI REDScan] Total waktu: ${Date.now() - waktuMulai} ms`
      );

      return res.end();
    }

  } catch (error: any) {
    console.error('\n========== ERROR AI REDSCAN ==========');
    console.error('Nama error:', error?.name);
    console.error('Pesan error:', error?.message);
    console.error('Penyebab koneksi:', error?.cause);
    console.error('Kode penyebab:', error?.cause?.code);
    console.error('Pesan penyebab:', error?.cause?.message);
    console.error('Status:', error?.status);
    console.error('Kode:', error?.code);
    console.error('Detail:', error?.error);
    console.error('======================================\n');

    console.error(
      `[AI REDScan] Gagal setelah ${Date.now() - waktuMulai} ms`
    );

    // Jika header streaming sudah dikirim,
    // error juga harus dikirim dalam format NDJSON.
    if (res.headersSent) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(
          JSON.stringify({
            error: 'AI REDScan mengalami gangguan saat menghasilkan jawaban.',
          }) + '\n'
        );

        return res.end();
      }

      return;
    }

    return res.status(500).json({
      success: false,
      message: 'AI Kasir mengalami gangguan. Periksa terminal backend.',
    });
  }
};
