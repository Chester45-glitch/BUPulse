const crypto = require('crypto');

// This safely ensures the key is ALWAYS exactly 32 bytes, preventing the crash.
const rawKey = process.env.ENCRYPTION_KEY || 'bupulse-default-secret-key-32-bt';
const ENCRYPTION_KEY = Buffer.alloc(32);
ENCRYPTION_KEY.write(rawKey, 'utf-8');

const ALGORITHM = 'aes-256-gcm';

function encryptData(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return JSON.stringify({
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag
    });
}

function decryptData(encryptedJsonString) {
    try {
        const { iv, encryptedData, authTag } = JSON.parse(encryptedJsonString);
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(iv, 'hex'));
        
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

module.exports = { encryptData, decryptData };