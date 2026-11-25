
import nodemailer from 'nodemailer';

// ==========================================
// KIRIM EMAIL OTP RESET PASSWORD REDScan
// ==========================================
const sendOtpEmail = async (
  email: string,
  otp: string
): Promise<void> => {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_APP_PASSWORD;

  // Pastikan konfigurasi email tersedia
  if (!emailUser || !emailPassword) {
    throw new Error(
      'EMAIL_USER atau EMAIL_APP_PASSWORD belum diatur di Railway Variables.'
    );
  }

  // Validasi OTP
  if (!/^\d{6}$/.test(otp)) {
    throw new Error('OTP harus terdiri dari 6 digit angka.');
  }

  // Konfigurasi SMTP Gmail
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  try {
    // Kirim email OTP
    const info = await transporter.sendMail({
      from: {
        name: 'REDScan Security',
        address: emailUser,
      },
      to: email,
      subject: 'Kode OTP Reset Password REDScan',

      text: [
        'REDScan Security',
        '',
        'Kamu meminta reset kata sandi akun REDScan.',
        '',
        `Kode OTP kamu: ${otp}`,
        '',
        'Kode berlaku selama 10 menit.',
        'Jangan berikan kode ini kepada siapa pun.',
        '',
        'Jika kamu tidak meminta reset kata sandi, abaikan email ini.',
      ].join('\n'),

      html: `
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>OTP Reset Password REDScan</title>
          </head>

          <body style="
            margin: 0;
            padding: 24px;
            background-color: #f5f2ed;
            font-family: Arial, sans-serif;
          ">
            <div style="
              max-width: 480px;
              margin: 0 auto;
              padding: 32px;
              background-color: #ffffff;
              border-radius: 16px;
            ">
              <h2 style="
                margin: 0 0 24px;
                color: #e54322;
                text-align: center;
              ">
                REDScan
              </h2>

              <h3 style="color: #210d04;">
                Reset Kata Sandi
              </h3>

              <p style="color: #555555; line-height: 1.6;">
                Kamu meminta reset kata sandi akun REDScan.
                Gunakan kode OTP berikut untuk melanjutkan:
              </p>

              <div style="
                margin: 24px 0;
                padding: 20px;
                background-color: #f5f2ed;
                border-radius: 12px;
                text-align: center;
              ">
                <h1 style="
                  margin: 0;
                  color: #210d04;
                  font-size: 32px;
                  letter-spacing: 8px;
                ">
                  ${otp}
                </h1>
              </div>

              <p style="
                color: #555555;
                text-align: center;
              ">
                Kode berlaku selama <b>10 menit</b>.
              </p>

              <p style="
                color: #777777;
                font-size: 13px;
                line-height: 1.6;
              ">
                Jangan berikan kode ini kepada siapa pun.
                Jika kamu tidak meminta reset kata sandi,
                abaikan email ini.
              </p>

              <hr style="
                margin: 24px 0;
                border: none;
                border-top: 1px solid #eeeeee;
              " />

              <p style="
                color: #999999;
                font-size: 11px;
                text-align: center;
              ">
                REDScan Security System
              </p>
            </div>
          </body>
        </html>
      `,
    });

    // Log aman: tidak menampilkan OTP atau password
    console.log('====================================');
    console.log('EMAIL OTP BERHASIL DIKIRIM');
    console.log('Penerima:', email);
    console.log('Message ID:', info.messageId);
    console.log('====================================');

  } catch (error) {
    console.error('====================================');
    console.error('GAGAL MENGIRIM EMAIL OTP');
    console.error(
      error instanceof Error ? error.message : error
    );
    console.error('====================================');

    // Lempar error agar controller mengetahui email gagal
    throw new Error('Gagal mengirim email OTP. Periksa konfigurasi Gmail.');
  } finally {
    transporter.close();
  }
};

export default sendOtpEmail;
