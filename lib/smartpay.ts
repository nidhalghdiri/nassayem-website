import crypto from "crypto";

const WORKING_KEY = process.env.SMARTPAY_WORKING_KEY || "";

/**
 * Encrypts the request string for SmartPay.
 * Output format: Hex(IV) + Hex(Cipher + Tag) [cite: 152]
 */
export function encryptSmartPayRequest(plainText: string): string {
  // Create Initialization Vector (IV) of random 16 bytes [cite: 142]
  const iv = crypto.randomBytes(16);

  // Get Cipher instance as AES 256 GCM [cite: 144]
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(WORKING_KEY, "utf8"),
    iv,
  );

  // Generate encrypted value [cite: 145]
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Extract the 16-byte authentication tag
  const tag = cipher.getAuthTag().toString("hex");

  // Combine: IV Hex + Cipher Hex + Tag Hex [cite: 152]
  return iv.toString("hex") + encrypted + tag;
}

/**
 * Decrypts the response string from SmartPay.
 */
export function decryptSmartPayResponse(encResponse: string): string {
  // Extract first 32 characters (16 bytes) as IV Hex [cite: 158]
  const ivHex = encResponse.substring(0, 32);
  const iv = Buffer.from(ivHex, "hex");

  // The rest is the Ciphertext + Tag
  const encryptedAndTag = encResponse.substring(32);

  // The tag is the last 32 characters (16 bytes) of the remaining string
  const encryptedHex = encryptedAndTag.substring(
    0,
    encryptedAndTag.length - 32,
  );
  const tagHex = encryptedAndTag.substring(encryptedAndTag.length - 32);
  const tag = Buffer.from(tagHex, "hex");

  // Initialize decipher [cite: 160]
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(WORKING_KEY, "utf8"),
    iv,
  );
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
