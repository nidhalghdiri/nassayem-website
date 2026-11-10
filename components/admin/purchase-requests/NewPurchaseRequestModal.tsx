"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPurchaseRequestAction } from "@/app/actions/purchaseRequests";
import { PURCHASE_REQUEST_MAX_ITEMS, PURCHASE_REQUEST_NOTE_MAX } from "@/lib/purchaseRequestLimits";
import { formatOmr } from "@/lib/purchaseRequestFormat";

/**
 * "New purchase request" form, opened from the list with `?new=1`.
 *
 * Submitting is a Server Action behind an explicit button click. On success the
 * user lands on the new request's detail view.
 */

type Props = {
  isEn: boolean;
  locale: string;
  /** value = NetSuite location id (Building.netsuiteId). */
  buildingOptions: { value: string; label: string }[];
  closeHref: string;
};

type ItemDraft = { description: string; quantity: string; price: string };

const emptyItem = (): ItemDraft => ({ description: "", quantity: "1", price: "" });

const inputCls =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-nassayem/30 bg-white";

export default function NewPurchaseRequestModal({ isEn, locale, buildingOptions, closeHref }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(buildingOptions.length === 1 ? buildingOptions[0].value : "");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [tenantCharge, setTenantCharge] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0),
    [items],
  );

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const submit = () => {
    setError(null);
    if (!locationId) return setError(isEn ? "Choose a building." : "اختر المبنى.");
    if (!reason.trim()) return setError(isEn ? "Enter the reason for the request." : "اكتب سبب الطلب.");
    for (const it of items) {
      if (!it.description.trim()) return setError(isEn ? "Every item needs a description." : "كل صنف يحتاج وصفًا.");
      if (!(Number(it.quantity) > 0)) return setError(isEn ? "Every item needs a quantity." : "كل صنف يحتاج كمية.");
      if (it.price === "" || !(Number(it.price) >= 0)) return setError(isEn ? "Every item needs a price." : "كل صنف يحتاج سعرًا.");
    }

    startTransition(async () => {
      const result = await createPurchaseRequestAction({
        locationId,
        reason,
        priority,
        tenantCharge,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          price: Number(it.price),
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/${locale}/admin/purchase-requests?id=${encodeURIComponent(result.id)}`);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link href={closeHref} aria-label={isEn ? "Close" : "إغلاق"} className="absolute inset-0 bg-black/40" />
      <aside className="relative w-full sm:max-w-xl bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">{isEn ? "New purchase request" : "طلب شراء جديد"}</h2>
          <Link href={closeHref} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={isEn ? "Close" : "إغلاق"}>
            ×
          </Link>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">{isEn ? "Building" : "المبنى"}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
              <option value="">{isEn ? "Select a building…" : "اختر المبنى…"}</option>
              {buildingOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">{isEn ? "Reason" : "سبب الطلب"}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={PURCHASE_REQUEST_NOTE_MAX}
              className={inputCls}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-gray-500">{isEn ? "Priority" : "الأولوية"}</span>
              <div className="flex gap-2">
                {(["normal", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                      priority === p
                        ? p === "urgent"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-nassayem text-white border-nassayem"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {p === "urgent" ? (isEn ? "Urgent" : "عاجل") : isEn ? "Normal" : "عادي"}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mt-4">
              <input
                type="checkbox"
                checked={tenantCharge}
                onChange={(e) => setTenantCharge(e.target.checked)}
                className="w-4 h-4 accent-nassayem"
              />
              {isEn ? "Charge to tenant" : "على حساب المستأجر"}
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-500">{isEn ? "Items" : "الأصناف"}</span>
            {items.map((it, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <input
                  value={it.description}
                  onChange={(e) => setItem(i, { description: e.target.value })}
                  placeholder={isEn ? "Item description" : "وصف الصنف"}
                  maxLength={300}
                  className={inputCls}
                />
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <label className="text-[11px] text-gray-400">{isEn ? "Quantity" : "الكمية"}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400">{isEn ? "Unit price (OMR)" : "سعر الوحدة (ر.ع)"}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={it.price}
                      onChange={(e) => setItem(i, { price: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={items.length === 1}
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                    aria-label={isEn ? "Remove item" : "حذف الصنف"}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            {items.length < PURCHASE_REQUEST_MAX_ITEMS && (
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
                className="text-sm font-semibold text-nassayem hover:underline"
              >
                + {isEn ? "Add item" : "إضافة صنف"}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-500">{isEn ? "Estimated total" : "الإجمالي التقديري"}</span>
            <span className="font-bold text-gray-900">{formatOmr(total, isEn)}</span>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-4 flex gap-3">
          <Link
            href={closeHref}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300 text-center"
          >
            {isEn ? "Cancel" : "إلغاء"}
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-nassayem text-white font-semibold text-sm hover:bg-nassayem-dark transition-colors disabled:opacity-60"
          >
            {isPending ? (isEn ? "Submitting…" : "جارٍ الإرسال…") : isEn ? "Submit request" : "إرسال الطلب"}
          </button>
        </div>
      </aside>
    </div>
  );
}
