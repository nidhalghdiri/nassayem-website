"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar({ locale }: { locale: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Switch language by replacing the current locale in the URL
  const switchLocale = locale === "en" ? "ar" : "en";
  const newPath = pathname.replace(`/${locale}`, `/${switchLocale}`);

  const navLinks = [
    { name: locale === "en" ? "Home" : "الرئيسية", href: `/${locale}` },
    {
      name: locale === "en" ? "Properties" : "العقارات",
      href: `/${locale}/properties`,
    },
    {
      name: locale === "en" ? "Blog" : "المدونة",
      href: `/${locale}/blog`,
    },
    {
      name: locale === "en" ? "Contact" : "اتصل بنا",
      href: `/${locale}/contact`,
    },
  ];

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex-shrink-0 font-bold text-xl text-nassayem"
          >
            <Image
              src="/images/ns-logo.jpeg"
              alt="Nassayem Salalah Logo"
              width={60}
              height={60}
              className="object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-gray-600 hover:text-nassayem font-medium transition-colors"
              >
                {link.name}
              </Link>
            ))}

            {/* Language Switcher & CTA */}
            <div className="flex items-center gap-4 border-s border-gray-200 ps-4">
              <Link
                href={newPath}
                className="text-sm font-bold text-gray-700 hover:text-nassayem uppercase"
              >
                {switchLocale}
              </Link>
              <Link
                href={`/${locale}/properties`}
                className="bg-nassayem text-white px-4 py-2 rounded-md font-medium hover:bg-nassayem transition-colors"
              >
                {locale === "en" ? "Book Now" : "احجز الآن"}
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-600 hover:text-nassayem focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-nassayem hover:bg-gray-50 rounded-md"
              onClick={() => setIsOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center px-3">
            <Link
              href={newPath}
              className="text-base font-bold text-gray-700 uppercase"
            >
              {locale === "en" ? "العربية" : "English"}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
