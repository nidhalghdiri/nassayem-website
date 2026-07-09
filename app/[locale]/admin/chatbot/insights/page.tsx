import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import AuditRunner from "@/components/admin/chatbot/AuditRunner";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string }> };

type IssueEntry = { tag: string; evidence: string; suggested_fix: string };

const FUNNEL_STEPS: { stage: number; en: string; ar: string }[] = [
  { stage: 1, en: "Started chat", ar: "بدأ المحادثة" },
  { stage: 2, en: "Qualified (dates + type)", ar: "حدد التواريخ والنوع" },
  { stage: 3, en: "Options shown", ar: "شاهد الخيارات" },
  { stage: 4, en: "Booking intent", ar: "أبدى نية الحجز" },
  { stage: 5, en: "Details collected", ar: "أعطى بياناته" },
  { stage: 6, en: "Reservation created", ar: "تم إنشاء الحجز" },
  { stage: 7, en: "Payment link sent", ar: "أُرسل رابط الدفع" },
  { stage: 8, en: "PAID", ar: "تم الدفع" },
];

const OUTCOME_LABELS: Record<string, { en: string; ar: string; cls: string }> = {
  paid: { en: "Paid", ar: "مدفوع", cls: "bg-emerald-100 text-emerald-700" },
  reserved_unpaid: { en: "Reserved, unpaid", ar: "محجوز بلا دفع", cls: "bg-amber-100 text-amber-700" },
  lead_captured: { en: "Lead captured", ar: "عميل محتمل", cls: "bg-blue-100 text-blue-700" },
  escalated: { en: "Escalated", ar: "مصعّد", cls: "bg-red-100 text-red-700" },
  info_only: { en: "Info only", ar: "استفسار فقط", cls: "bg-gray-100 text-gray-600" },
  abandoned: { en: "Abandoned", ar: "انسحب", cls: "bg-orange-100 text-orange-700" },
  spam: { en: "Spam", ar: "سبام", cls: "bg-gray-100 text-gray-400" },
};

export default async function ChatbotInsightsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (adminUser.role !== "MANAGER") redirect(`/${locale}/admin/chatbot`);

  const [audits, totalConversations] = await Promise.all([
    prisma.chatbotConversationAudit.findMany({
      include: {
        conversation: { select: { id: true, customerName: true, externalId: true } },
      },
    }),
    prisma.chatbotConversation.count({
      where: {
        NOT: { externalId: { startsWith: "playground-" } },
        messages: { some: { role: "USER" } },
      },
    }),
  ]);
  const remaining = Math.max(0, totalConversations - audits.length);
  const n = audits.length;

  // ── Aggregations ───────────────────────────────────────────────────────────
  const funnel = FUNNEL_STEPS.map((s) => ({
    ...s,
    count: audits.filter((a) => a.funnelStage >= s.stage).length,
  }));

  const outcomeCounts = new Map<string, number>();
  const sentimentCounts = new Map<string, number>();
  const issueMap = new Map<string, { count: number; examples: (IssueEntry & { convoId: string; who: string })[] }>();
  const topicCounts = new Map<string, number>();

  for (const a of audits) {
    outcomeCounts.set(a.outcome, (outcomeCounts.get(a.outcome) ?? 0) + 1);
    sentimentCounts.set(a.sentiment, (sentimentCounts.get(a.sentiment) ?? 0) + 1);
    const issues = (a.issues as IssueEntry[] | null) ?? [];
    for (const issue of issues) {
      const bucket = issueMap.get(issue.tag) ?? { count: 0, examples: [] };
      bucket.count++;
      if (bucket.examples.length < 3) {
        bucket.examples.push({
          ...issue,
          convoId: a.conversationId,
          who: a.conversation.customerName || a.conversation.externalId,
        });
      }
      issueMap.set(issue.tag, bucket);
    }
    for (const topic of (a.topics as string[] | null) ?? []) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const issuesRanked = [...issueMap.entries()].sort((a, b) => b[1].count - a[1].count);
  const topicsRanked = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const missed = audits
    .filter((a) => a.missedBooking)
    .sort((a, b) => b.auditedAt.getTime() - a.auditedAt.getTime())
    .slice(0, 20);
  const abandoned = audits
    .filter((a) => a.outcome === "abandoned" && a.abandonLastBotMessage)
    .slice(0, 10);

  const pct = (x: number, base: number) => (base > 0 ? Math.round((x / base) * 100) : 0);
  const convoUrl = (id: string) => `/${locale}/admin/chatbot/conversations/${id}`;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEn ? "Chatbot Insights" : "تحليلات المساعد"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEn
              ? "AI-graded audit of every conversation — funnel, issues, topics and missed bookings."
              : "تحليل آلي لكل المحادثات — مسار الحجز، المشاكل، المواضيع، والحجوزات المفقودة."}
          </p>
        </div>
        <Link href={`/${locale}/admin/chatbot`} className="text-sm text-nassayem hover:underline">
          {isEn ? "← Chatbot overview" : "← نظرة عامة"}
        </Link>
      </div>

      <AuditRunner locale={locale} total={totalConversations} remaining={remaining} />

      {n === 0 ? (
        <p className="text-center text-gray-400 py-12">
          {isEn
            ? "No audits yet — press “Run audit” above."
            : "لا توجد تحليلات بعد — اضغط «بدء التحليل» بالأعلى."}
        </p>
      ) : (
        <>
          {/* Funnel */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {isEn ? `Booking funnel (${n} conversations)` : `مسار الحجز (${n} محادثة)`}
            </h2>
            <div className="space-y-2">
              {funnel.map((step, i) => {
                const prev = i === 0 ? n : funnel[i - 1].count;
                const drop = prev - step.count;
                return (
                  <div key={step.stage} className="flex items-center gap-3">
                    <div className="w-44 text-xs text-gray-600 shrink-0">
                      {step.stage}. {isEn ? step.en : step.ar}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-full rounded-full flex items-center px-2 text-[10px] font-bold text-white ${step.stage === 8 ? "bg-emerald-500" : "bg-nassayem"}`}
                        style={{ width: `${Math.max(3, pct(step.count, n))}%` }}
                      >
                        {step.count}
                      </div>
                    </div>
                    <div className="w-24 text-[11px] text-end shrink-0">
                      {i > 0 && drop > 0 ? (
                        <span className="text-red-500">−{drop} ({pct(drop, prev)}%)</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Outcomes */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                {isEn ? "Outcomes" : "النتائج"}
              </h2>
              <div className="space-y-2">
                {Object.entries(OUTCOME_LABELS).map(([key, label]) => {
                  const count = outcomeCounts.get(key) ?? 0;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-36 text-center ${label.cls}`}>
                        {isEn ? label.en : label.ar}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-nassayem/70 rounded-full" style={{ width: `${pct(count, n)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-14 text-end">{count} · {pct(count, n)}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex gap-4 flex-wrap">
                {[...sentimentCounts.entries()].map(([s, c]) => (
                  <span key={s}>
                    {s === "positive" ? "😊" : s === "frustrated" ? "😡" : s === "negative" ? "🙁" : "😐"} {s}: {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                {isEn ? "Most asked topics" : "أكثر المواضيع سؤالاً"}
              </h2>
              {topicsRanked.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : (
                <div className="space-y-1.5">
                  {topicsRanked.map(([topic, count]) => (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="w-44 text-xs text-gray-600 truncate" dir="ltr">{topic}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-nassayem rounded-full"
                          style={{ width: `${pct(count, topicsRanked[0][1])}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-end">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Issues */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              {isEn ? "Bot issues (with evidence)" : "مشاكل البوت (مع الأدلة)"}
            </h2>
            {issuesRanked.length === 0 ? (
              <p className="text-sm text-gray-400">{isEn ? "No issues found 🎉" : "لا توجد مشاكل 🎉"}</p>
            ) : (
              <div className="space-y-3">
                {issuesRanked.map(([tag, data]) => (
                  <details key={tag} className="border border-gray-100 rounded-xl">
                    <summary className="cursor-pointer px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800" dir="ltr">{tag}</span>
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        {data.count}
                      </span>
                    </summary>
                    <div className="px-4 pb-3 space-y-2">
                      {data.examples.map((ex, i) => (
                        <div key={i} className="text-xs bg-gray-50 rounded-lg p-3">
                          <div className="text-gray-700">“{ex.evidence}”</div>
                          <div className="text-nassayem-dark mt-1">💡 {ex.suggested_fix}</div>
                          <Link href={convoUrl(ex.convoId)} className="text-nassayem hover:underline">
                            {isEn ? "Open conversation" : "فتح المحادثة"} — {ex.who}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Missed bookings */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                {isEn ? `Missed bookings (${missed.length})` : `حجوزات مفقودة (${missed.length})`}
              </h2>
              {missed.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : (
                <div className="space-y-2">
                  {missed.map((a) => (
                    <div key={a.id} className="text-xs bg-orange-50 border border-orange-100 rounded-lg p-3">
                      <div className="text-gray-700">{a.missedBookingReason}</div>
                      <Link href={convoUrl(a.conversationId)} className="text-nassayem hover:underline">
                        {a.conversation.customerName || a.conversation.externalId}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Abandonment autopsy */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                {isEn ? "Last bot message before customers vanished" : "آخر رسالة للبوت قبل انسحاب العميل"}
              </h2>
              {abandoned.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : (
                <div className="space-y-2">
                  {abandoned.map((a) => (
                    <div key={a.id} className="text-xs bg-gray-50 rounded-lg p-3">
                      <div className="text-gray-600 line-clamp-3">“{a.abandonLastBotMessage}”</div>
                      <Link href={convoUrl(a.conversationId)} className="text-nassayem hover:underline">
                        {a.conversation.customerName || a.conversation.externalId}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
