"use client";

import { useState, useTransition } from "react";
import { saveChatbotSettings } from "@/app/actions/chatbot";
import type { ChatbotSettings } from "@/lib/chatbot/config";

type Props = { locale: string; settings: ChatbotSettings };

const inputCls =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nassayem/50";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

export default function ConfigForm({ locale, settings }: Props) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const t = (en: string, ar: string) => (isEn ? en : ar);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setSaved(false);
          await saveChatbotSettings(formData);
          setSaved(true);
        })
      }
      className="space-y-6"
    >
      {/* Toggles */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="w-4 h-4 accent-[#2a7475]"
          />
          <span className="text-sm font-medium text-gray-800">
            {t("Chatbot enabled (web widget visible, replies active)", "تفعيل المساعد (ظهور الأداة والردود)")}
          </span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="show_prices"
            defaultChecked={settings.show_prices}
            className="w-4 h-4 accent-[#2a7475]"
          />
          <span className="text-sm font-medium text-gray-800">
            {t(
              "Show prices — when off, the bot never quotes prices and directs customers to the call center",
              "عرض الأسعار — عند الإيقاف لا يذكر البوت أي سعر ويوجّه العميل لمركز الاتصال",
            )}
          </span>
        </label>
      </div>

      {/* Persona */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
        <div>
          <label className={labelCls}>{t("System prompt (business persona)", "التوجيه الأساسي (شخصية البوت)")}</label>
          <textarea name="system_prompt" defaultValue={settings.system_prompt} rows={8} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("Tone", "الأسلوب")}</label>
          <textarea name="tone" defaultValue={settings.tone} rows={2} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("Business rules", "قواعد العمل")}</label>
          <textarea name="business_rules" defaultValue={settings.business_rules} rows={5} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("Escalation triggers", "حالات التصعيد للموظف")}</label>
          <textarea name="escalation_triggers" defaultValue={settings.escalation_triggers} rows={5} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("Canned replies (reference answers)", "ردود جاهزة (إجابات مرجعية)")}</label>
          <textarea name="canned_replies" defaultValue={settings.canned_replies} rows={4} className={inputCls} />
        </div>
      </div>

      {/* Contact + greetings */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t("Call center number", "رقم مركز الاتصال")}</label>
          <input name="call_center" defaultValue={settings.contact_numbers.call_center} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("WhatsApp number (digits only)", "رقم واتساب (أرقام فقط)")}</label>
          <input name="whatsapp" defaultValue={settings.contact_numbers.whatsapp} className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>
            {t(
              "Escalation WhatsApp numbers (digits only, comma-separated — empty = call center number)",
              "أرقام واتساب للتصعيد (أرقام فقط، مفصولة بفواصل — فارغ = رقم مركز الاتصال)",
            )}
          </label>
          <input
            name="escalation_whatsapp_numbers"
            defaultValue={settings.escalation_whatsapp_numbers}
            placeholder="96899551237,96898590405"
            dir="ltr"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelCls}>
            {t("Escalation email (staff notified on escalation — empty = off)", "بريد التصعيد (يُرسل إشعار للموظفين — فارغ = إيقاف)")}
          </label>
          <input name="escalation_email" type="email" defaultValue={settings.escalation_email} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("Widget greeting (English)", "رسالة الترحيب (إنجليزي)")}</label>
          <textarea name="greeting_en" defaultValue={settings.greeting_en} rows={2} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t("Widget greeting (Arabic)", "رسالة الترحيب (عربي)")}</label>
          <textarea name="greeting_ar" defaultValue={settings.greeting_ar} rows={2} dir="rtl" className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-xl bg-nassayem text-white text-sm font-medium hover:bg-nassayem-dark transition-colors disabled:opacity-50"
        >
          {isPending ? t("Saving…", "جارٍ الحفظ…") : t("Save configuration", "حفظ الإعدادات")}
        </button>
        {saved && !isPending && (
          <span className="text-sm text-emerald-600 font-medium">
            {t("Saved — live within a minute.", "تم الحفظ — سيُطبق خلال دقيقة.")}
          </span>
        )}
      </div>
    </form>
  );
}
