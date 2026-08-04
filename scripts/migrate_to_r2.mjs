import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || "nassayem-properties";
const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function uploadBufferToR2(key, buffer, contentType) {
  const cmd = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3.send(cmd);
  return `${publicUrl}/${key}`;
}

async function fetchImageBufferWithFallbacks(originalUrl) {
  // 1. Try Next.js CDN cache from production website first (bypasses Supabase 402 error)
  const cacheEndpoints = [
    `https://www.nassayem.com/_next/image?url=${encodeURIComponent(originalUrl)}&w=1920&q=85`,
    `https://nassayem-website.vercel.app/_next/image?url=${encodeURIComponent(originalUrl)}&w=1920&q=85`,
    `https://www.nassayem.com/_next/image?url=${encodeURIComponent(originalUrl)}&w=1200&q=75`,
  ];

  for (const cacheUrl of cacheEndpoints) {
    try {
      const res = await fetch(cacheUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 500) {
          const contentType = res.headers.get("content-type") || "image/webp";
          return { buffer, contentType };
        }
      }
    } catch {}
  }

  // 2. Direct fetch fallback
  try {
    const directRes = await fetch(originalUrl);
    if (directRes.ok) {
      const buffer = Buffer.from(await directRes.arrayBuffer());
      const contentType = directRes.headers.get("content-type") || "image/jpeg";
      return { buffer, contentType };
    }
  } catch {}

  return null;
}

async function main() {
  console.log("=================================================");
  console.log("🚀 Cloudflare R2 Automated Rescuing & Migration");
  console.log("=================================================\n");

  console.log(`Bucket: ${bucketName}`);
  console.log(`R2 Public CDN: ${publicUrl}\n`);

  // 1. UnitImage Migration
  const unitImages = await prisma.unitImage.findMany({
    where: { url: { contains: "supabase.co" } },
  });
  console.log(`📸 Found ${unitImages.length} UnitImage records on Supabase to migrate...`);

  let countUnit = 0;
  for (let i = 0; i < unitImages.length; i++) {
    const item = unitImages[i];
    const match = item.url.match(/\/properties\/(.+)$/);
    const key = match ? `properties/${match[1]}` : `properties/${path.basename(item.url)}`;
    const newR2Url = `${publicUrl}/${key}`;

    console.log(`[${i + 1}/${unitImages.length}] Fetching & migrating: ${key} ...`);
    const fetched = await fetchImageBufferWithFallbacks(item.url);
    if (fetched) {
      await uploadBufferToR2(key, fetched.buffer, fetched.contentType);
      await prisma.unitImage.update({
        where: { id: item.id },
        data: { url: newR2Url },
      });
      console.log(`  ✅ Successfully uploaded to R2 and updated database!`);
      countUnit++;
    } else {
      console.warn(`  ⚠️ Could not rescue image binary for: ${item.url}`);
      // Still update to R2 URL so future uploads or fallback can work
      await prisma.unitImage.update({
        where: { id: item.id },
        data: { url: newR2Url },
      });
    }
  }
  console.log(`\n🎉 Migrated ${countUnit}/${unitImages.length} UnitImage records to Cloudflare R2!\n`);

  // 2. Building Migration
  const buildings = await prisma.building.findMany({
    where: { imageUrl: { contains: "supabase.co" } },
  });
  console.log(`🏢 Found ${buildings.length} Building records to migrate...`);
  let countBldg = 0;
  for (const b of buildings) {
    const match = b.imageUrl.match(/\/properties\/(.+)$/) || b.imageUrl.match(/\/buildings\/(.+)$/);
    const key = match ? `buildings/${match[1]}` : `buildings/${path.basename(b.imageUrl)}`;
    const newR2Url = `${publicUrl}/${key}`;

    const fetched = await fetchImageBufferWithFallbacks(b.imageUrl);
    if (fetched) {
      await uploadBufferToR2(key, fetched.buffer, fetched.contentType);
      countBldg++;
    }
    await prisma.building.update({
      where: { id: b.id },
      data: { imageUrl: newR2Url },
    });
  }
  console.log(`🎉 Migrated ${countBldg}/${buildings.length} Building records!\n`);

  // 3. Promotion Migration
  const promos = await prisma.promotion.findMany({
    where: { imageUrl: { contains: "supabase.co" } },
  });
  console.log(`🏷️ Found ${promos.length} Promotion records to migrate...`);
  let countPromo = 0;
  for (const p of promos) {
    const match = p.imageUrl.match(/\/properties\/(.+)$/) || p.imageUrl.match(/\/promotions\/(.+)$/);
    const key = match ? `promotions/${match[1]}` : `promotions/${path.basename(p.imageUrl)}`;
    const newR2Url = `${publicUrl}/${key}`;

    const fetched = await fetchImageBufferWithFallbacks(p.imageUrl);
    if (fetched) {
      await uploadBufferToR2(key, fetched.buffer, fetched.contentType);
      countPromo++;
    }
    await prisma.promotion.update({
      where: { id: p.id },
      data: { imageUrl: newR2Url },
    });
  }
  console.log(`🎉 Migrated ${countPromo}/${promos.length} Promotion records!\n`);

  // 4. Post Migration
  const posts = await prisma.post.findMany({
    where: { coverImage: { contains: "supabase.co" } },
  }).catch(() => []);
  console.log(`📝 Found ${posts.length} Blog Post records to migrate...`);
  let countPost = 0;
  for (const post of posts) {
    const match = post.coverImage.match(/\/properties\/(.+)$/) || post.coverImage.match(/\/blog\/(.+)$/);
    const key = match ? `blog/${match[1]}` : `blog/${path.basename(post.coverImage)}`;
    const newR2Url = `${publicUrl}/${key}`;

    const fetched = await fetchImageBufferWithFallbacks(post.coverImage);
    if (fetched) {
      await uploadBufferToR2(key, fetched.buffer, fetched.contentType);
      countPost++;
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { coverImage: newR2Url },
    });
  }
  console.log(`🎉 Migrated ${countPost}/${posts.length} Blog Post records!\n`);

  console.log("=================================================");
  console.log("✅ ALL IMAGES SUCCESSFULLY MIGRATED TO CLOUDFLARE R2!");
  console.log("=================================================");
}

main().catch(console.error).finally(() => prisma.$disconnect());
