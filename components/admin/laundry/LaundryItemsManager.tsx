"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLaundryItemType,
  updateLaundryItemType,
  toggleLaundryItemActive,
  deleteLaundryItemType,
} from "@/app/actions/laundryItems";

type Item = {
  id: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  usageCount: number;
};

type ToastData = { msg: string; type: "success" | "error" };

export default function LaundryItemsManager({
  items,
  locale,
}: {
  items: Item[];
  locale: string;
}) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const [newEn, setNewEn] = useState("");
  const [newAr, setNewAr] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editAr, setEditAr] = useState("");

  const runAction = (fd: FormData, action: (fd: FormData) => Promise<{ error: string | null; success: boolean }>, onOk?: () => void) => {
    startTransition(async () => {
      const res = await action(fd);
      if (res.error) showToast(res.error, "error");
      else {
        onOk?.();
        showToast(isEn ? "Saved." : "تم الحفظ.");
        router.refresh();
      }
    });
  };

  const handleCreate = () => {
    if (!newEn.trim() || !newAr.trim()) {
      showToast(isEn ? "Enter both names." : "أدخل الاسمين.", "error");
      return;
    }
    const fd = new FormData();
    fd.set("nameEn", newEn.trim());
    fd.set("nameAr", newAr.trim());
    runAction(fd, createLaundryItemType, () => { setNewEn(""); setNewAr(""); });
  };

  const handleUpdate = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("nameEn", editEn.trim());
    fd.set("nameAr", editAr.trim());
    runAction(fd, updateLaundryItemType, () => setEditId(null));
  };

  const handleToggle = (item: Item) => {
    startTransition(async () => {
      const res = await toggleLaundryItemActive({ id: item.id, isActive: !item.isActive });
      if (res.error) showToast(res.error, "error");
      else { showToast(isEn ? "Updated." : "تم التحديث."); router.refresh(); }
    });
  };

  const handleDelete = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    runAction(fd, deleteLaundryItemType);
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Add new */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{isEn ? "Add Item" : "إضافة صنف"}</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newEn}
            onChange={(e) => setNewEn(e.target.value)}
            placeholder={isEn ? "English name" : "الاسم بالإنجليزية"}
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          />
          <input
            value={newAr}
            onChange={(e) => setNewAr(e.target.value)}
            placeholder={isEn ? "Arabic name" : "الاسم بالعربية"}
            dir="rtl"
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
          />
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="px-5 py-2.5 bg-nassayem text-white text-sm font-semibold rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60"
          >
            {isEn ? "Add" : "إضافة"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {items.length === 0 && (
          <p className="p-6 text-sm text-gray-400 text-center">{isEn ? "No items yet." : "لا توجد أصناف بعد."}</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            {editId === item.id ? (
              <>
                <input
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30"
                />
                <input
                  value={editAr}
                  onChange={(e) => setEditAr(e.target.value)}
                  dir="rtl"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nassayem/30"
                />
                <button onClick={() => handleUpdate(item.id)} disabled={isPending} className="px-3 py-2 bg-nassayem text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                  {isEn ? "Save" : "حفظ"}
                </button>
                <button onClick={() => setEditId(null)} className="px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg">
                  {isEn ? "Cancel" : "إلغاء"}
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.isActive ? "text-gray-800" : "text-gray-400 line-through"}`}>
                    {isEn ? item.nameEn : item.nameAr}
                  </p>
                  <p className="text-xs text-gray-400">{isEn ? item.nameAr : item.nameEn}</p>
                </div>
                {!item.isActive && (
                  <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {isEn ? "Retired" : "متقاعد"}
                  </span>
                )}
                <button
                  onClick={() => { setEditId(item.id); setEditEn(item.nameEn); setEditAr(item.nameAr); }}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={isEn ? "Edit" : "تعديل"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleToggle(item)}
                  disabled={isPending}
                  className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {item.isActive ? (isEn ? "Retire" : "تقاعد") : (isEn ? "Restore" : "استعادة")}
                </button>
                {item.usageCount === 0 && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                    aria-label={isEn ? "Delete" : "حذف"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
