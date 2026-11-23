
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type MenuItem = {
  id: number;
  nama_menu: string;
  kategori: string;
  harga: number | string;
  deskripsi: string | null;
};

const MODEL_UTAMA = 'gemini-3.8-flash';
const MODEL_CADANGAN = 'gemini-3.5-flash-lite';

const BATAS_WAKTU_KONEKSI = 20000;
const BATAS_WAKTU_POTONGAN = 20000;
const BATAS_WAKTU_STREAM = 30000;

function denganTimeout<T>(
  promise: Promise<T>,
  waktu: number,
  pesan: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(pesan));
      }, waktu);
    }),
  ]).finally(() => {
    clearTimeout(timer);
  });
}

export async function* generateAiReply(
  messages: ChatMessage[],
  menus: MenuItem[]
): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum diatur di file .env');
  }

  if (!messages || messages.length === 0) {
    throw new Error('Riwayat percakapan masih kosong.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const daftarMenu = menus.map((menu) => ({
    id: menu.id,
    nama_menu: menu.nama_menu,
    kategori: menu.kategori,
    harga: Number(menu.harga),
    deskripsi: menu.deskripsi || 'Tidak ada deskripsi',
  }));

  const instructions = `
Kamu adalah REDScan AI, asisten virtual resmi REDScan.

TUGAS UTAMA:
Membantu pelanggan REDScan dengan ramah, natural, informatif,
dan menggunakan bahasa Indonesia yang mudah dipahami.

IDENTITAS REDSCAN:
- REDScan adalah aplikasi pemesanan makanan dan minuman berbasis QR Code.
- Kamu adalah asisten virtual untuk pelanggan REDScan.
- Jangan mengaku sebagai manusia atau pegawai.

INFORMASI MENU:
- Jelaskan nama, kategori, harga, dan deskripsi menu.
- Bandingkan beberapa menu jika diminta.
- Tampilkan daftar menu jika pelanggan memintanya.
- Gunakan hanya data menu dari database.
- Jangan mengarang harga, bahan, komposisi, stok, atau menu.

REKOMENDASI:
- Rekomendasikan makanan dan minuman sesuai selera pelanggan.
- Pertimbangkan cuaca panas atau sejuk berdasarkan informasi pelanggan.
- Pertimbangkan anggaran, rasa manis, pahit, creamy, dan segar.
- Berikan alasan singkat untuk setiap rekomendasi.
- Jangan merekomendasikan kopi jika pelanggan tidak menyukai kopi.
- Jangan mengklaim mengetahui cuaca aktual pelanggan.

PEMESANAN:
- Jelaskan pemesanan melalui QR Code.
- Bantu pelanggan memilih menu dan menambahkan produk.
- Jangan mengaku sudah membuat pesanan jika belum selesai dilakukan.

PEMBAYARAN:
- Jelaskan pembayaran Tunai dan QRIS jika ditanyakan.
- Tunai dilakukan mengikuti proses pembayaran di kasir.
- QRIS mengikuti proses pembayaran melalui aplikasi.

BANTUAN APLIKASI:
- Jelaskan fungsi dan penggunaan REDScan.
- Berikan panduan sederhana jika pelanggan mengalami kesulitan.

MEMAHAMI PERCAKAPAN:
- Perhatikan riwayat percakapan, bukan hanya pesan terakhir.
- Hubungkan pertanyaan baru dengan pembahasan sebelumnya.
- Pahami pertanyaan seperti "mana?", "contohnya apa?",
  "yang lain apa?", dan "berapa harganya?" berdasarkan konteks.
- Jangan meminta pelanggan mengulang pertanyaan jika konteks tersedia.

ATURAN DATA:
- Gunakan daftar menu dari database sebagai sumber informasi.
- Jangan mengarang informasi yang tidak tersedia.
- Jika informasi tidak tersedia, katakan dengan jujur.
- Jangan mengklaim stok tersedia secara real-time.

GAYA JAWABAN:
- Gunakan bahasa Indonesia yang ramah dan natural.
- Jawab langsung dan tidak bertele-tele.
- Gunakan bullet jika menampilkan beberapa menu.
- Cantumkan harga jika tersedia.
- Jangan mengulang salam setiap kali menjawab.
- Hindari penjelasan terlalu panjang untuk pertanyaan sederhana.

PERTANYAAN UMUM:
- Boleh menjawab pertanyaan umum secara singkat.
- Arahkan kembali secara natural ke layanan REDScan jika relevan.

DATA MENU REDSCAN:
${JSON.stringify(daftarMenu)}
`;

  const riwayatPercakapan = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  const mulaiStream = async (
    model: string,
    gunakanThinking: boolean
  ) => {
    console.log(`[Gemini] Menggunakan model: ${model}`);

    return ai.models.generateContentStream({
      model,
      contents: riwayatPercakapan,
      config: {
        systemInstruction: instructions,
        maxOutputTokens: 500,
        ...(gunakanThinking
          ? {
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
            }
          : {}),
      },
    });
  };

  let iterator: AsyncIterator<any>;
  let potonganPertama = '';

  // Mencoba membuka koneksi dan mengambil jawaban pertama.
  const cobaModel = async (
    model: string,
    gunakanThinking: boolean
  ): Promise<{
    iterator: AsyncIterator<any>;
    potonganPertama: string;
    }> => {
    console.log(`[Gemini] Memulai model: ${model}`);

    const stream = await denganTimeout(
      mulaiStream(model, gunakanThinking),
      BATAS_WAKTU_KONEKSI,
      `Koneksi ${model} timeout setelah 20 detik.`
    );

    console.log(`[Gemini] Koneksi ${model} berhasil dibuka.`);
    console.log('[Gemini] Menunggu jawaban pertama...');

    const streamIterator = stream[Symbol.asyncIterator]();

    while (true) {
      const hasil = await denganTimeout(
        streamIterator.next(),
        BATAS_WAKTU_POTONGAN,
        `Model ${model} tidak memberikan jawaban dalam 20 detik.`
      );

      if (hasil.done) {
        throw new Error(`${model} selesai tanpa memberikan jawaban.`);
      }

      const teks = hasil.value.text;

      if (teks) {
        console.log('[Gemini] Jawaban pertama berhasil diterima.');

        return {
          iterator: streamIterator,
          potonganPertama: teks,
        };
      }
    }
  };

  // Coba model utama terlebih dahulu.
  try {
    console.log('[Gemini] Mencoba model utama...');

    const hasil = await cobaModel(MODEL_UTAMA, true);

    iterator = hasil.iterator;
    potonganPertama = hasil.potonganPertama;
  } catch (error: any) {
    console.error('[Gemini] Model utama gagal:', error?.message);

    // Jika model utama gagal atau timeout, gunakan model cadangan.
    console.log('[Gemini] Beralih ke model cadangan...');

    try {
      const hasil = await cobaModel(MODEL_CADANGAN, false);

      iterator = hasil.iterator;
      potonganPertama = hasil.potonganPertama;

      console.log('[Gemini] Model cadangan berhasil digunakan.');
    } catch (fallbackError: any) {
      console.error(
        '[Gemini] Model cadangan juga gagal:',
        fallbackError?.message
      );

      throw new Error(
        'Model utama dan cadangan sedang tidak dapat memberikan jawaban. Silakan coba kembali.'
      );
    }
  }

  let jumlahPotongan = 0;

  // Kirim potongan pertama yang sudah diterima.
  jumlahPotongan++;
  yield potonganPertama;

  // Lanjutkan streaming jawaban secara bertahap.
  while (true) {
    const hasil = await denganTimeout(
      iterator.next(),
      BATAS_WAKTU_STREAM,
      'Streaming Gemini terhenti terlalu lama.'
    );

    if (hasil.done) {
      break;
    }

    const teks = hasil.value.text;

    if (teks) {
      jumlahPotongan++;
      yield teks;
    }
  }

  console.log(
    `[Gemini] Streaming selesai. Jumlah potongan: ${jumlahPotongan}`
  );
}
