import * as CryptoJS from 'crypto-js';

export class EncryptionUtil {
  private static readonly SECRET_KEY = process.env.ENCRYPTION_SECRET || 'your-encryption-secret-key';

  static encrypt(text: string): string {
    if (!text) return text;
    return CryptoJS.AES.encrypt(text, this.SECRET_KEY).toString();
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }
}