const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Generating secure 2048-bit RSA key pair...');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

// Write private key to private_key.pem in the root directory (this is gitignored)
const privateKeyPath = path.join(__dirname, '..', 'private_key.pem');
fs.writeFileSync(privateKeyPath, privateKey);

console.log('\n======================================================');
console.log('🎉 RSA KEY PAIR GENERATED SUCCESSFULLY');
console.log('======================================================');
console.log(`Private Key written to:\n  ${privateKeyPath}`);
console.log('⚠️ IMPORTANT: Keep private_key.pem safe and NEVER commit it to Git!');
console.log('------------------------------------------------------');
console.log('Public Key (to copy and paste into utils/license.js):');
console.log('\n' + publicKey);
console.log('======================================================\n');
