import { ImageResponse } from "next/og";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const alt = "Nassayem Salalah Property";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function OgImage({ params }: Props) {
  const { id, locale } = await params;
  const isEn = locale !== "ar";

  const unit = await prisma.unit.findUnique({
    where: { id },
    include: { images: { orderBy: { displayOrder: "asc" }, take: 1 }, building: true },
  });

  const title = unit
    ? isEn
      ? unit.titleEn
      : unit.titleAr
    : isEn
      ? "Premium Property"
      : "عقار متميز";

  const location = unit
    ? isEn
      ? unit.building.locationEn
      : unit.building.locationAr
    : isEn
      ? "Salalah, Oman"
      : "صلالة، عُمان";

  const price = unit?.dailyPrice
    ? `${unit.dailyPrice} OMR / ${isEn ? "night" : "ليلة"}`
    : "";

  const imageUrl = unit?.images[0]?.url ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          position: "relative",
          fontFamily: "sans-serif",
          backgroundColor: "#1d5455",
        }}
      >
        {/* Background property photo */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.45,
            }}
          />
        )}

        {/* Dark gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(10,40,40,0.95) 0%, rgba(10,40,40,0.5) 55%, transparent 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "48px 60px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Brand badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "4px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#2a7475",
              }}
            />
            <span
              style={{
                color: "#7ecbcc",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Nassayem Salalah
            </span>
          </div>

          {/* Property title */}
          <div
            style={{
              color: "#ffffff",
              fontSize: "52px",
              fontWeight: 800,
              lineHeight: 1.1,
              maxWidth: "820px",
            }}
          >
            {title}
          </div>

          {/* Location + price row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              marginTop: "8px",
            }}
          >
            <span style={{ color: "#a8d8d8", fontSize: "22px" }}>
              📍 {location}
            </span>
            {price && (
              <span
                style={{
                  backgroundColor: "#2a7475",
                  color: "#ffffff",
                  fontSize: "20px",
                  fontWeight: 700,
                  padding: "6px 20px",
                  borderRadius: "100px",
                }}
              >
                {price}
              </span>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
