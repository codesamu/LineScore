# 🔑 Offline Asymmetric License Key Generation & Management Guide

This guide explains how the offline cryptographic licensing system works for **[Project Name]** and how you can generate custom license keys for your business customers.

---

## 🔒 The Security Architecture (Asymmetric Cryptography)

To prevent customers or developers from generating their own license keys (even though they have 100% access to your source code), this application uses **Asymmetric Cryptography** (RSA-2048):

1. **Private Key (`private_key.pem`)**: This key is kept strictly private by **you** (Samuel) on your local computer. It is used to cryptographically *sign* the license keys. **NEVER share or commit this file.**
2. **Public Key (`PUBLIC_KEY`)**: Shipped publicly in the application source code ([utils/license.js](utils/license.js)). It is used to *verify* that a license key was signed by your private key. It is mathematically impossible to forge a valid license key without having your private key.

---

## 🛠️ How to Setup & Generate a License Key for a Customer

### 1. Initialize Your Keypair (Done once)
A secure 2048-bit RSA key pair has already been initialized. The private key is saved at `private_key.pem` in your project root directory (which has been added to `.gitignore` to prevent accidental commits), and the public verification key has been securely hardcoded inside [utils/license.js](utils/license.js).

> [!CAUTION]
> Back up your `private_key.pem` securely outside this repository. If you lose this file, you will not be able to generate new licenses for your customers! If you leak this file, anyone can generate their own keys.

---

### 2. Generate a License Key
To generate a key for a commercial customer, run the generator script on your computer from the project root:

```bash
node license-generator.js "<Customer Company Name>" <YYYY-MM-DD>
```

#### Example:
To generate a license key for **"Acme Corp Ltd"** expiring on **December 31, 2028**:
```bash
node license-generator.js "Acme Corp Ltd" 2028-12-31
```

#### Expected Output:
```text
======================================================
     🎉 OFFLINE LICENSE KEY GENERATED SUCCESSFULLY   
======================================================
Licensee (Company):  Acme Corp Ltd
Expiration Date:     2028-12-31
------------------------------------------------------
License Key (Send this complete string to customer):

QWNtZSBDb3JwIEx0ZA==.2028-12-31.9e854663787514679463d806...

======================================================
```

---

## 📨 What to Send to Your Customer

When a customer purchases a commercial license, you can email them the following details:

> **Thank you for purchasing a commercial license for [Project Name]!**
> 
> Here are your license details to activate your offline copy and remove the "Made by Samuel Fronthaler" footer:
> 
> * **Licensed To:** Acme Corp Ltd
> * **Expiration Date:** 2028-12-31
> * **License Key:** `QWNtZSBDb3JwIEx0ZA==.2028-12-31.9e854663787514679463d806...` *(Copy-paste the complete key)*
> 
> **How to Apply:**
> 1. Log into your **Admin Panel** (`/admin`).
> 2. Scroll to the **License Key Settings** card.
> 3. Paste the complete **License Key** string above into the field and click **Apply**.
> 4. The license will activate immediately and hide the branding footer across all pages.

---

## 🛠️ Regenerating a Keypair (If needed)
If you ever need to replace your keys (e.g. if the private key was leaked):
1. Delete the old `private_key.pem`.
2. Run `node scripts/generate-keypair.js` to generate a new pair.
3. Copy the printed public key and replace the `PUBLIC_KEY` constant in `utils/license.js`.
*(Note: Old licenses generated with the leaked private key will immediately become invalid once the public key is replaced in the source code).*
