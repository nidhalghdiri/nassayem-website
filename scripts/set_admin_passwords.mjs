import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PBKDF2 Password Hashing using Node.js crypto / Web Crypto
async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

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
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, "0")).join("");

  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

async function main() {
  const targetEmail = process.argv[2] || "ghdiri.nidhal@gmail.com";
  const targetPassword = process.argv[3] || "Nassayem2026@Admin";

  console.log(`Setting password for: ${targetEmail}`);

  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: targetEmail, mode: "insensitive" } },
  });

  if (!user) {
    console.error(`User with email "${targetEmail}" not found in database.`);
    const allUsers = await prisma.adminUser.findMany({ select: { email: true, role: true, name: true } });
    console.log("Available admin users:", allUsers);
    return;
  }

  const passwordHash = await hashPassword(targetPassword);

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`✅ Successfully set password for ${user.email} (${user.name || user.role})!`);
  console.log(`Password is now: ${targetPassword}`);

  // If setting for all users that don't have passwordHash
  const usersWithoutPassword = await prisma.adminUser.findMany({
    where: { passwordHash: null },
  });

  if (usersWithoutPassword.length > 0) {
    console.log(`\nInitializing default password for ${usersWithoutPassword.length} other users...`);
    const defaultHash = await hashPassword("Nassayem2026@Staff");
    for (const u of usersWithoutPassword) {
      await prisma.adminUser.update({
        where: { id: u.id },
        data: { passwordHash: defaultHash },
      });
      console.log(` - Set default password for ${u.email}`);
    }
    console.log(`✅ All ${usersWithoutPassword.length} users updated with default password: Nassayem2026@Staff`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
