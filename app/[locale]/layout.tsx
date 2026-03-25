import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import "../globals.css";
import "leaflet/dist/leaflet.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { headers } from "next/headers";

// Optimize fonts for both languages
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const tajawal = Tajawal({
  weight: ["400", "500", "700"],
  subsets: ["arabic"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Nassayem Salalah", // Automatically appends your brand to page titles
    default: "Nassayem Salalah | Premium Property Rentals in Oman",
  },
  description:
    "Book luxury apartments, family suites, and premium properties in Salalah, Dhofar. Secure your Khareef vacation rental today.",
  alternates: {
    canonical: "https://www.nassayem.com",
    languages: {
      en: "https://www.nassayem.com/en",
      ar: "https://www.nassayem.com/ar",
      "x-default": "https://www.nassayem.com/en", // Fallback for other languages
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.nassayem.com",
    siteName: "Nassayem Salalah",
    images: [
      {
        url: "https://www.nassayem.com/_next/image?url=%2Fimages%2Fns-logo.jpeg&w=128&q=75",
        width: 1200,
        height: 630,
        alt: "Nassayem Salalah Premium Properties",
      },
    ],
  },
};

// In Next.js 15, layout params are asynchronous Promises
type RootLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await params;

  // Determine text direction for Tailwind and browser rendering
  const direction = locale === "ar" ? "rtl" : "ltr";

  // Read the current pathname set by middleware to decide whether to show
  // the public Navbar/Footer (admin pages have their own layout/chrome).
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isAdmin = pathname.includes("/admin");

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${inter.variable} ${tajawal.variable} scroll-smooth`}
    >
      <body
        className={`
          min-h-screen bg-gray-50 text-gray-900 antialiased
          ${locale === "ar" ? "font-arabic" : "font-english"}
          ${!isAdmin ? "flex flex-col" : ""}
        `}
      >
        {!isAdmin && <Navbar locale={locale} />}

        {isAdmin ? (
          children
        ) : (
          <main className="flex-grow flex flex-col">{children}</main>
        )}

        {!isAdmin && <Footer locale={locale} />}
      </body>
    </html>
  );
}
