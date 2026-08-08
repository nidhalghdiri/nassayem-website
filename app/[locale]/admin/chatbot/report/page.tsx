import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { getDailyReportData } from "@/lib/chatbot/dailyReportData";
import DailyReportView from "@/components/admin/chatbot/report/DailyReportView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
};

export default async function DailyChatbotReportPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { date: dateParam } = await searchParams;

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) {
    redirect(`/${locale}/admin/login`);
  }

  // Parse target date
  let targetDate = new Date();
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const parsed = new Date(`${dateParam}T12:00:00Z`);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const reportData = await getDailyReportData(targetDate);

  return (
    <DailyReportView
      data={reportData}
      locale={locale}
      currentDateParam={dateParam || reportData.dateIso}
    />
  );
}
