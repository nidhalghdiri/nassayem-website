import type { Metadata } from "next";
import { Inter, Tajawal } from "next/font/google";
import "../globals.css";
import "leaflet/dist/leaflet.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

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

// Global SEO - Can be overridden on individual pages
export const metadata: Metadata = {
  title: {
    template: "%s | Salalah Premium Properties",
    default: "Salalah Premium Properties | Daily & Monthly Rentals",
  },
  description:
    "Book the best apartments and buildings in Salalah. Discover premium daily and monthly rentals with seamless booking.",
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

  return (
    <html
      lang={locale}
      dir={direction}
      // Inject CSS variables for fonts
      className={`${inter.variable} ${tajawal.variable} scroll-smooth`}
    >
      <body
        className={`
          min-h-screen flex flex-col bg-gray-50 text-gray-900 antialiased
          ${locale === "ar" ? "font-arabic" : "font-english"}
        `}
      >
        <Navbar locale={locale} />

        {/* Main content expands to push footer to the bottom */}
        <main className="flex-grow flex flex-col">{children}</main>

        <Footer locale={locale} />
      </body>
    </html>
  );
}
