import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PBKDF2 Password Hashing & Verification
async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(parts[2].match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const expectedHashHex = parts[3];

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const actualHashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return actualHashHex === expectedHashHex;
}

async function test() {
  console.log("Testing Direct Database Authentication...");
  const user = await prisma.adminUser.findFirst({
    where: { email: "ghdiri.nidhal@gmail.com" },
  });

  if (!user) {
    throw new Error("User not found!");
  }

  const validPassword = await verifyPassword("Nassayem2026@Admin", user.passwordHash);
  console.log("Correct password check:", validPassword ? "PASS ✅" : "FAIL ❌");

  const wrongPassword = await verifyPassword("WrongPassword123", user.passwordHash);
  console.log("Wrong password rejection check:", !wrongPassword ? "PASS ✅" : "FAIL ❌");

  await prisma.$disconnect();
}

test().catch(console.error);
