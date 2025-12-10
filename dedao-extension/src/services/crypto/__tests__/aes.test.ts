import { AESCrypto } from '../aes.ts';
import CryptoJS from 'crypto-js';

describe('AESCrypto', () => {
    const KEY = CryptoJS.enc.Utf8.parse('3e4r06tjkpjcevlbslr3d96gdb5ahbmo');
    const IV = CryptoJS.enc.Utf8.parse('6fd89a1b3a7f48fb');

    it('should decrypt correctly', () => {
        const plainText = 'Hello World';
        const encrypted = CryptoJS.AES.encrypt(plainText, KEY, {
            iv: IV,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString();

        const result = AESCrypto.decrypt(encrypted);
        expect(result).toBe(plainText);
    });
});
