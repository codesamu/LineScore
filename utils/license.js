const crypto = require('crypto');

// Hardcoded PEM Public Key
// Shipped publically in the repository. Safe to commit.
// This key can ONLY verify licenses; it CANNOT be used to generate them.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsr2z+WMAQwAxZxttKRfs
R2yqpZ+weAC9da2W8MwhzCfp4Ivf+yTDHWOSm6V3CK1b4jGk0KPiYiOlyd7Z89C+
EOPSWy/v+FNp90+HQGZfeblabokgLE89SnaLQHAT6Kae+H7Ii70cDT2XB4snUln5
vlovrpNF6Ilu0bntGkx748etPbZUAmgJdXWNvAGUsiRDBqRteE7qOw2OAi7V6tho
ok6wYqxOFC9IM32SLsCLI0D+vv4LFeQdbB2A28HhMHU35vXdDjB3HwyXf1KQ6DRE
mmYtRpW9Rily1cOaT09hbECWU69fixMhYZCMhfKz8j6630OyWAGst+wxB5cDOW0e
1QIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Validates the offline license key using asymmetric cryptographic signature verification.
 * @param {string} licenseKey - The license key string.
 * @returns {object} Validation result containing status, licensee name, and expiry info.
 */
function validateLicenseKey(licenseKey) {
    if (!licenseKey) {
        return { isLicensed: false };
    }
    
    const parts = licenseKey.trim().split('.');
    if (parts.length !== 3) {
        return { isLicensed: false, error: 'Malformed license key' };
    }
    
    const [companyNameBase64, expiresAt, signatureHex] = parts;
    let companyName;
    try {
        companyName = Buffer.from(companyNameBase64, 'base64').toString('utf8');
    } catch (e) {
        return { isLicensed: false, error: 'Invalid licensee encoding' };
    }
    
    // The data to sign is "companyNameBase64:expiresAt"
    const dataToVerify = `${companyNameBase64}:${expiresAt}`;
    
    try {
        // Cryptographically verify signature using the hardcoded public key
        const isSignatureValid = crypto.verify(
            'sha256',
            Buffer.from(dataToVerify),
            PUBLIC_KEY,
            Buffer.from(signatureHex, 'hex')
        );
        
        if (!isSignatureValid) {
            return { isLicensed: false, error: 'Invalid signature (forged key)' };
        }
    } catch (e) {
        return { isLicensed: false, error: 'Signature verification failed' };
    }
    
    // Validate date format and expiration
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
        return { isLicensed: false, error: 'Invalid expiration date format' };
    }
    
    const today = new Date();
    // Reset hours to start of day for accurate comparison
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
        return { 
            isLicensed: false, 
            error: 'License expired', 
            companyName, 
            expiresAt 
        };
    }
    
    return { 
        isLicensed: true, 
        companyName, 
        expiresAt 
    };
}

module.exports = {
    validateLicenseKey
};
