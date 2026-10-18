import { Metadata } from "next";
import Link from "next/link";
import {
  AirVent,
  Ambulance,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  CookingPot,
  Droplets,
  Fuel,
  Headphones,
  Hospital,
  KeyRound,
  Landmark,
  LogIn,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
  ScrollText,
  ShieldAlert,
  ShoppingCart,
  Shirt,
  Sparkles,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import prisma from "@/lib/prisma";
import {
  CONTACT_PHONE_E164,
  CONTACT_WHATSAPP,
  EMERGENCY_PHONE,
  RECEPTION_PHONE_DISPLAY,
  RECEPTION_PHONE_E164,
  whatsappLink,
} from "@/lib/contact";
import {
  APPLIANCES,
  CHECK_IN_TIME,
  CHECK_OUT_TIME,
  CHECKOUT_STEPS,
  HOSPITAL_MAPS_URL,
  HOUSE_RULES,
  NEARBY,
  nearbyMapsUrl,
  type ApplianceKey,
  type NearbyKey,
} from "@/lib/guestGuide";
import SectionNav from "@/components/guest-guide/SectionNav";
import MaintenanceRequestForm from "@/components/guest-guide/MaintenanceRequestForm";

// Building names for the maintenance form change rarely.
export const revalidate = 3600;

const CUSTOMER_SERVICE_DISPLAY = CONTACT_WHATSAPP.replace(/^968/, "");

const APPLIANCE_ICONS: Record<ApplianceKey, LucideIcon> = {
  ac: AirVent,
  heater: Droplets,
  power: Zap,
  tv: Tv,
  washer: WashingMachine,
  kitchen: CookingPot,
};

const NEARBY_ICONS: Record<NearbyKey, LucideIcon> = {
  pharmacy: Pill,
  supermarket: ShoppingCart,
  restaurant: UtensilsCrossed,
  hospital: Hospital,
  atm: Landmark,
  fuel: Fuel,
  mosque: Building2,
  laundry: Shirt,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn ? "Digital Guest Guide" : "دليل الضيف الرقمي",
    description: isEn
      ? "Everything you need during your stay at Nassayem Salalah: Wi-Fi, appliances, emergency numbers, nearby services and maintenance requests."
      : "كل ما تحتاجه خلال إقامتك في نسائم صلالة: الواي فاي، تشغيل الأجهزة، أرقام الطوارئ، الخدمات القريبة وطلبات الصيانة.",
    // Utility page for in-house guests (reached via the QR on the reservation paper).
    robots: { index: false, follow: true },
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/guest-guide`,
      languages: { en: "https://www.nassayem.com/en/guest-guide", ar: "https://www.nassayem.com/ar/guest-guide" },
    },
  };
}

async function getBuildings() {
  try {
    return await prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    });
  } catch {
    // The guide must render even if the DB is unreachable — the form falls back to apartment number only.
    return [];
  }
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-nassayem/10 text-nassayem">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

const card = "rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm";
const section = "scroll-mt-36";

export default async function GuestGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isEn = locale === "en";
  const t = (b: { en: string; ar: string }) => (isEn ? b.en : b.ar);
  const buildings = await getBuildings();

  const sections = [
    { id: "wifi", label: isEn ? "Wi-Fi" : "الواي فاي" },
    { id: "appliances", label: isEn ? "Appliances" : "تشغيل الأجهزة" },
    { id: "emergency", label: isEn ? "Emergency" : "الطوارئ" },
    { id: "nearby", label: isEn ? "Nearby" : "خدمات قريبة" },
    { id: "maintenance", label: isEn ? "Maintenance" : "طلب صيانة" },
    { id: "rules", label: isEn ? "House rules" : "قواعد الإقامة" },
  ];

  const wifiHelp = whatsappLink(
    isEn ? "Hello, I need the Wi-Fi details for my apartment. Apartment number: " : "مرحباً، أحتاج بيانات الواي فاي لشقتي. رقم الشقة: ",
  );

  return (
    <div className="pb-16">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-nassayem-dark via-nassayem to-nassayem-light text-white">
        <div aria-hidden className="pointer-events-none absolute -top-24 -end-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -start-16 h-80 w-80 rounded-full bg-white/5 blur-2xl" />
        <div className="relative mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {isEn ? "Digital Guest Guide" : "دليل الضيف الرقمي"}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
            {isEn ? "Welcome to Nassayem Salalah" : "أهلاً بك في نسائم صلالة"}
          </h1>
          <p className="mt-3 max-w-xl text-white/85">
            {isEn
              ? "Everything you need for a comfortable stay, all in one place. We're here 24/7 if you need anything."
              : "كل ما تحتاجه لإقامة مريحة في مكان واحد. نحن في خدمتك على مدار الساعة."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 backdrop-blur">
              <LogIn className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              {isEn ? "Check-in from" : "الدخول من"} <strong dir="ltr">{t(CHECK_IN_TIME)}</strong>
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 backdrop-blur">
              <LogOut className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
              {isEn ? "Check-out by" : "المغادرة قبل"} <strong dir="ltr">{t(CHECK_OUT_TIME)}</strong>
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* ── Quick actions (overlap the hero) ─────────────────── */}
        <div className="relative z-10 -mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: `tel:${RECEPTION_PHONE_E164}`, icon: Phone, label: isEn ? "Reception" : "الاستقبال", sub: RECEPTION_PHONE_DISPLAY, tone: "text-nassayem bg-nassayem/10" },
            { href: `tel:${CONTACT_PHONE_E164}`, icon: Headphones, label: isEn ? "Customer service" : "خدمة العملاء", sub: CUSTOMER_SERVICE_DISPLAY, tone: "text-nassayem bg-nassayem/10" },
            { href: whatsappLink(isEn ? "Hello, I'm a guest at Nassayem and I need help." : "مرحباً، أنا ضيف في نسائم وأحتاج مساعدة."), icon: MessageCircle, label: isEn ? "WhatsApp" : "واتساب", sub: isEn ? "Chat with us" : "راسلنا", tone: "text-[#128C7E] bg-[#25D366]/15", external: true },
            { href: `tel:${EMERGENCY_PHONE}`, icon: Ambulance, label: isEn ? "Emergency" : "الطوارئ", sub: EMERGENCY_PHONE, tone: "text-red-600 bg-red-50" },
          ].map((a) => (
            <a
              key={a.label}
              href={a.href}
              {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${a.tone}`}>
                <a.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-gray-900">{a.label}</span>
              <span className="text-xs text-gray-500" dir="ltr">{a.sub}</span>
            </a>
          ))}
        </div>

        <div className="mt-6">
          <SectionNav sections={sections} />
        </div>

        <div className="mt-6 space-y-10">
          {/* ── Wi-Fi ───────────────────────────────────────────── */}
          <section id="wifi" className={section}>
            <SectionHeader icon={Wifi} title={isEn ? "Wi-Fi & password" : "شبكة الواي فاي وكلمة المرور"} />
            <div className={card}>
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nassayem to-nassayem-light text-white">
                  <KeyRound className="h-6 w-6" aria-hidden />
                </span>
                <p className="text-gray-700 leading-relaxed">
                  {isEn
                    ? "The Wi-Fi network name and password are on the card inside your apartment or on the label of the router."
                    : "تجد اسم شبكة الواي فاي وكلمة المرور على البطاقة داخل شقتك أو على الملصق الموجود على جهاز الراوتر."}
                </p>
              </div>
              <div className="mt-5 rounded-xl bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">{isEn ? "Not connecting?" : "لا يتصل؟"}</p>
                <ol className="mt-2 space-y-1.5 text-sm text-gray-600 list-decimal ps-5">
                  <li>{isEn ? "Unplug the router, wait 30 seconds, then plug it back in." : "افصل الراوتر عن الكهرباء، انتظر 30 ثانية ثم أعد توصيله."}</li>
                  <li>{isEn ? "Wait 2–3 minutes until the lights are steady, then reconnect." : "انتظر 2–3 دقائق حتى تستقر الأضواء ثم أعد الاتصال."}</li>
                </ol>
              </div>
              <a
                href={wifiHelp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-nassayem hover:underline underline-offset-4"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {isEn ? "Can't find it? Ask us on WhatsApp" : "لم تجدها؟ اطلبها عبر واتساب"}
              </a>
            </div>
          </section>

          {/* ── Appliances ──────────────────────────────────────── */}
          <section id="appliances" className={section}>
            <SectionHeader
              icon={Zap}
              title={isEn ? "Using the appliances" : "تشغيل الأجهزة"}
              subtitle={isEn ? "Tap an appliance for quick instructions" : "اضغط على الجهاز لعرض طريقة التشغيل"}
            />
            <div className="space-y-3">
              {APPLIANCES.map((a, i) => {
                const Icon = APPLIANCE_ICONS[a.key];
                return (
                  <details key={a.key} open={i === 0} className="group rounded-2xl border border-gray-200 bg-white shadow-sm open:shadow-md transition-shadow">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nassayem/10 text-nassayem">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="flex-1 font-semibold text-gray-900">{t(a.title)}</span>
                      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
                    </summary>
                    <div className="px-4 pb-5 sm:px-5">
                      <ol className="space-y-3">
                        {a.steps.map((s, idx) => (
                          <li key={idx} className="flex gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nassayem text-xs font-bold text-white">{idx + 1}</span>
                            <span className="text-gray-700 leading-relaxed">{t(s)}</span>
                          </li>
                        ))}
                      </ol>
                      {a.tip && (
                        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <strong>{isEn ? "Tip: " : "نصيحة: "}</strong>
                          {t(a.tip)}
                        </p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          {/* ── Emergency ───────────────────────────────────────── */}
          <section id="emergency" className={section}>
            <SectionHeader icon={ShieldAlert} title={isEn ? "Emergency numbers" : "أرقام الطوارئ"} subtitle={isEn ? "Tap to call" : "اضغط للاتصال"} />
            <a
              href={`tel:${EMERGENCY_PHONE}`}
              className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-red-600 to-red-500 p-5 text-white shadow-md transition active:scale-[0.99]"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Ambulance className="h-7 w-7" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-sm text-white/85">{isEn ? "Police · Ambulance · Fire" : "الشرطة · الإسعاف · الإطفاء"}</span>
                <span className="block text-3xl font-bold tracking-wider" dir="ltr">{EMERGENCY_PHONE}</span>
              </span>
              <Phone className="h-6 w-6" aria-hidden />
            </a>
            <div className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white shadow-sm">
              {[
                { href: `tel:${RECEPTION_PHONE_E164}`, icon: Phone, label: isEn ? "Reception" : "الاستقبال", value: RECEPTION_PHONE_DISPLAY },
                { href: `tel:${CONTACT_PHONE_E164}`, icon: Headphones, label: isEn ? "Customer service" : "خدمة العملاء", value: CUSTOMER_SERVICE_DISPLAY },
                { href: HOSPITAL_MAPS_URL, icon: Hospital, label: isEn ? "Sultan Qaboos Hospital" : "مستشفى السلطان قابوس", value: isEn ? "Directions" : "الاتجاهات", external: true },
              ].map((r) => (
                <a
                  key={r.label}
                  href={r.href}
                  {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-4 p-4 transition hover:bg-gray-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nassayem/10 text-nassayem">
                    <r.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex-1 font-medium text-gray-900">{r.label}</span>
                  <span className="font-semibold text-nassayem" dir="ltr">{r.value}</span>
                </a>
              ))}
            </div>
          </section>

          {/* ── Nearby ──────────────────────────────────────────── */}
          <section id="nearby" className={section}>
            <SectionHeader
              icon={MapPin}
              title={isEn ? "Nearby services" : "خدمات قريبة"}
              subtitle={isEn ? "Opens Google Maps with the closest places to you" : "يفتح خرائط جوجل بأقرب الأماكن إليك"}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {NEARBY.map((n) => {
                const Icon = NEARBY_ICONS[n.key];
                return (
                  <a
                    key={n.key}
                    href={nearbyMapsUrl(n.query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-nassayem/40 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-nassayem/10 text-nassayem">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{t(n.label)}</span>
                    <ArrowUpRight className="absolute top-4 end-4 h-4 w-4 text-gray-300 transition group-hover:text-nassayem rtl:-scale-x-100" aria-hidden />
                  </a>
                );
              })}
            </div>
            <Link
              href={`/${locale}/recommendations`}
              className="mt-3 flex items-center justify-between rounded-2xl border border-nassayem/20 bg-nassayem/5 p-4 transition hover:bg-nassayem/10"
            >
              <span>
                <span className="block font-semibold text-nassayem-dark">{isEn ? "Places we recommend in Salalah" : "أماكن ننصح بزيارتها في صلالة"}</span>
                <span className="block text-sm text-gray-600">{isEn ? "Beaches, Khareef spots, restaurants & more" : "شواطئ، معالم الخريف، مطاعم والمزيد"}</span>
              </span>
              <ArrowUpRight className="h-5 w-5 text-nassayem rtl:-scale-x-100" aria-hidden />
            </Link>
          </section>

          {/* ── Maintenance ─────────────────────────────────────── */}
          <section id="maintenance" className={section}>
            <SectionHeader
              icon={Wrench}
              title={isEn ? "Request maintenance" : "طلب صيانة"}
              subtitle={isEn ? "Something not working? Let us know in seconds." : "هل هناك عطل؟ أبلغنا خلال ثوانٍ."}
            />
            <div className={card}>
              <MaintenanceRequestForm locale={locale} buildings={buildings} />
            </div>
          </section>

          {/* ── House rules & check-out ─────────────────────────── */}
          <section id="rules" className={section}>
            <SectionHeader icon={ScrollText} title={isEn ? "House rules & check-out" : "قواعد الإقامة والمغادرة"} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={card}>
                <h3 className="mb-3 font-semibold text-gray-900">{isEn ? "During your stay" : "أثناء إقامتك"}</h3>
                <ul className="space-y-3">
                  {HOUSE_RULES.map((r, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-nassayem" aria-hidden />
                      {t(r)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={card}>
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
                  <Clock className="h-4 w-4 text-nassayem" aria-hidden />
                  {isEn ? "Before you check out" : "قبل المغادرة"}
                  <span className="ms-auto rounded-full bg-nassayem/10 px-2.5 py-0.5 text-xs font-semibold text-nassayem" dir="ltr">
                    {t(CHECK_OUT_TIME)}
                  </span>
                </h3>
                <ul className="space-y-3">
                  {CHECKOUT_STEPS.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700 leading-relaxed">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nassayem" aria-hidden />
                      {t(s)}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-gray-500">
                  {isEn ? "Need a late check-out? Ask reception — subject to availability." : "تحتاج مغادرة متأخرة؟ تواصل مع الاستقبال — حسب التوفر."}
                </p>
              </div>
            </div>
          </section>

          {/* ── Closing ─────────────────────────────────────────── */}
          <div className="rounded-2xl bg-gradient-to-br from-nassayem-dark to-nassayem p-6 text-center text-white">
            <p className="text-lg font-bold">{isEn ? "Enjoy your stay! 🌿" : "نتمنى لك إقامة سعيدة! 🌿"}</p>
            <p className="mt-1 text-sm text-white/80">
              {isEn ? "Anything else? We're one tap away." : "تحتاج أي شيء آخر؟ نحن على بُعد ضغطة واحدة."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <a href={`tel:${RECEPTION_PHONE_E164}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-nassayem-dark transition hover:bg-white/90">
                <Phone className="h-4 w-4" aria-hidden />
                {isEn ? "Call reception" : "اتصل بالاستقبال"}
              </a>
              <Link
                href={`/${isEn ? "ar" : "en"}/guest-guide`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10"
              >
                {isEn ? "عربي" : "English"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
