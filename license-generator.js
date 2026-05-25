const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const privateKeyPath = path.join(__dirname, 'private_key.pem');

// Verify private key exists
if (!fs.existsSync(privateKeyPath)) {
    console.log('\n======================================================');
    console.log('             OFFLINE LICENSE GENERATOR                ');
    console.log('======================================================');
    console.log('Error: Private key file "private_key.pem" not found.');
    console.log('\nPlease run the generation script first to create it:');
    console.log('  node scripts/generate-keypair.js');
    console.log('======================================================\n');
    process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

// Read command line arguments
const companyName = process.argv[2];
const expiresAt = process.argv[3]; // Expected format: YYYY-MM-DD

if (!companyName || !expiresAt) {
    console.log('\n======================================================');
    console.log('             OFFLINE LICENSE GENERATOR                ');
    console.log('======================================================');
    console.log('Error: Missing arguments.');
    console.log('\nUsage:');
    console.log('  node license-generator.js "<Company Name>" <YYYY-MM-DD>');
    console.log('\nExample:');
    console.log('  node license-generator.js "Acme Corp Ltd" 2027-12-31');
    console.log('======================================================\n');
    process.exit(1);
}

// Validate date format
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(expiresAt)) {
    console.log('\nError: Invalid date format. Please use YYYY-MM-DD.\n');
    process.exit(1);
}

const expiryDate = new Date(expiresAt);
if (isNaN(expiryDate.getTime())) {
    console.log('\nError: The provided date is invalid.\n');
    process.exit(1);
}

// Encode company name to base64 to ensure dots/spaces don't break string splitting
const companyNameBase64 = Buffer.from(companyName).toString('base64');

// The data to sign is "companyNameBase64:expiresAt"
const dataToSign = `${companyNameBase64}:${expiresAt}`;

// Cryptographically sign the license key data using our private key
let signatureHex;
try {
    const signature = crypto.sign('sha256', Buffer.from(dataToSign), privateKey);
    signatureHex = signature.toString('hex');
} catch (e) {
    console.log('\nError: Failed to cryptographically sign the license key.\n', e);
    process.exit(1);
}

// Assemble the final offline license key string
const licenseKey = `${companyNameBase64}.${expiresAt}.${signatureHex}`;

console.log('\n======================================================');
console.log('     🎉 OFFLINE LICENSE KEY GENERATED SUCCESSFULLY   ');
console.log('======================================================');
console.log(`Licensee (Company):  ${companyName}`);
console.log(`Expiration Date:     ${expiresAt}`);
console.log('------------------------------------------------------');
console.log('License Key (Send this complete string to customer):');
console.log('\n' + licenseKey + '\n');
console.log('======================================================\n');
