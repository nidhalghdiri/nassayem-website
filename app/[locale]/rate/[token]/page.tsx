import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { isValidRatingToken } from "@/lib/stayRating";
import StayRatingForm from "@/components/rate/StayRatingForm";

// The link is private to the guest: keep it out of search results and make
// sure it is never served from a shared cache.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function RateStayPage({ params }: PageProps) {
  const { locale, token } = await params;
  const isEn = locale === "en";

  if (!isValidRatingToken(token)) return notFound();
  const rating = await prisma.stayRating.findUnique({
    where: { token },
    select: {
      customerName: true,
      building: true,
      unitNumbers: true,
      reservationNumber: true,
      status: true,
    },
  });
  if (!rating) return notFound();

  const firstName = rating.customerName.split(" ")[0] ?? rating.customerName;
  const place = [rating.building, rating.unitNumbers && `${isEn ? "Unit" : "شقة"} ${rating.unitNumbers}`]
    .filter(Boolean)
    .join(" ");
  const subtitle = [place, rating.reservationNumber && `${isEn ? "Booking" : "حجز"} ${rating.reservationNumber}`]
    .filter(Boolean)
    .join("، ");

  return (
    <div className="min-h-screen bg-gray-50 sm:py-8">
      <div className="mx-auto w-full max-w-md bg-white sm:rounded-3xl sm:shadow-xl overflow-hidden">
        <header className="bg-gradient-to-b from-nassayem-dark to-nassayem text-white px-6 pt-8 pb-7 text-center">
          <Image
            src="/images/ns-logo.jpeg"
            alt={isEn ? "Nassayem Salalah" : "نسائم صلالة"}
            width={72}
            height={72}
            className="mx-auto mb-5 h-[72px] w-[72px] rounded-2xl bg-white object-contain p-1"
            priority
          />
          <h1 className="text-xl font-extrabold">
            {isEn ? `How was your stay, ${firstName}?` : `كيف كانت إقامتك يا ${firstName}؟`}
          </h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/85">{subtitle}</p>}
        </header>

        <StayRatingForm
          token={token}
          locale={isEn ? "en" : "ar"}
          alreadySubmitted={rating.status === "SUBMITTED"}
        />
      </div>
    </div>
  );
}
