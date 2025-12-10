import CryptoJS from 'crypto-js';
import { CryptoError } from '../../utils/errors.ts';

export class AESCrypto {
    // 32 bytes key for AES-256
    private static readonly KEY = CryptoJS.enc.Utf8.parse('3e4r06tjkpjcevlbslr3d96gdb5ahbmo');
    // 16 bytes IV
    private static readonly IV = CryptoJS.enc.Utf8.parse('6fd89a1b3a7f48fb');

    static decrypt(encryptedBase64: string): string {
        try {
            const decrypted = CryptoJS.AES.decrypt(
                encryptedBase64,
                AESCrypto.KEY,
                {
                    iv: AESCrypto.IV,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );

            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            throw new CryptoError(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
