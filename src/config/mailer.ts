
const sendOtpEmail = async (
  email: string,
  otp: string
): Promise<void> => {
  console.log('\n====================================');
  console.log('       OTP RESET PASSWORD REDScan');
  console.log('====================================');
  console.log('Email penerima :', email);
  console.log('Kode OTP       :', otp);
  console.log('Berlaku        : 10 menit');
  console.log('====================================\n');
};

export default sendOtpEmail;
