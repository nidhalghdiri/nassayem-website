"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createTask, type CreateTaskState } from "@/app/actions/tasks";
import { TASK_TYPE_CONFIG, TASK_PRIORITY_CONFIG, STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import { buildingLabel } from "@/lib/buildingLabel";
import type { TStaffRole } from "@/lib/tasks/constants";

type Building = {
  id: string;
  nameEn: string;
  nameAr: string;
  shortName?: string | null;
  buildingUnits?: { id: string; name: string }[];
};

type StaffUser = { id: string; name: string | null; email: string; role: string };

type ParentTask = { id: string; title: string; type: string } | null;

type Props = {
  buildings: Building[];
  assignableStaff: StaffUser[];
  locale: string;
  parentTask?: ParentTask;
  /** When true, the task is always assigned to the current user (no picker). */
  selfOnly?: boolean;
};

const initialState: CreateTaskState = { error: null };

const MAX_PHOTOS = 10;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type PendingPhoto = { id: string; file: File; preview: string };

export default function CreateTaskForm({ buildings, assignableStaff, locale, parentTask, selfOnly = false }: Props) {
  const isEn = locale === "en";
  const [state, formAction, isPending] = useActionState(createTask, initialState);
  const [selectedType, setSelectedType] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [unitMode, setUnitMode] = useState<"dropdown" | "custom">("dropdown");
  const router = useRouter();

  // ── Photos: compressed in the browser, uploaded one by one after the task
  // is created (each request stays well under the server body limits).
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const handledTaskId = useRef<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Free preview URLs when the form unmounts
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same file again
    if (!files.length) return;

    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) {
      setPhotoError(isEn ? `You can attach up to ${MAX_PHOTOS} photos.` : `يمكنك إرفاق ${MAX_PHOTOS} صور كحد أقصى.`);
    }

    setPreparingPhotos(true);
    const added: PendingPhoto[] = [];
    for (let file of files.slice(0, Math.max(0, room))) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        setPhotoError(isEn ? `"${file.name}" is not a JPG, PNG or WebP image.` : `"${file.name}" ليست صورة JPG أو PNG أو WebP.`);
        continue;
      }
      if (file.size > 1024 * 1024) {
        try {
          file = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
        } catch (err) {
          console.error("Compression failed:", err);
        }
      }
      if (file.size > 4 * 1024 * 1024) {
        setPhotoError(isEn ? `"${file.name}" is too large.` : `"${file.name}" حجمها كبير جداً.`);
        continue;
      }
      added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file, preview: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...added]);
    setPreparingPhotos(false);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  // Once the task exists: upload photos, then go to the Tasks page.
  useEffect(() => {
    const taskId = state.taskId;
    if (!taskId || handledTaskId.current === taskId) return;
    handledTaskId.current = taskId;

    (async () => {
      const toUpload = photosRef.current;
      let failed = 0;
      if (toUpload.length > 0) {
        setUploadProgress({ done: 0, total: toUpload.length });
        for (let i = 0; i < toUpload.length; i++) {
          const fd = new FormData();
          fd.append("file", toUpload[i].file);
          try {
            const res = await fetch(`/api/tasks/${taskId}/photos`, { method: "POST", body: fd });
            if (!res.ok) failed++;
          } catch {
            failed++;
          }
          setUploadProgress({ done: i + 1, total: toUpload.length });
        }
      }
      if (failed > 0) {
        window.alert(
          isEn
            ? `The task was created, but ${failed} photo(s) failed to upload. You can add them from the task details.`
            : `تم إنشاء المهمة، لكن تعذّر رفع ${failed} صورة. يمكنك إضافتها من تفاصيل المهمة.`,
        );
      }
      router.push(`/${locale}/admin/tasks`);
      router.refresh();
    })();
  }, [state.taskId, isEn, locale, router]);

  const isUploading = uploadProgress !== null;
  const isBusy = isPending || isUploading || preparingPhotos;

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const units = selectedBuilding?.buildingUnits || [];

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {parentTask && (
        <input type="hidden" name="parentTaskId" value={parentTask.id} />
      )}

      {/* Parent task banner */}
      {parentTask && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p>
            {isEn ? "Sub-task of: " : "مهمة فرعية لـ: "}
            <span className="font-semibold">{parentTask.title}</span>
          </p>
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {state.error}
        </div>
      )}

      {/* ── Task Type ───────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isEn ? "Task Type" : "نوع المهمة"} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.entries(TASK_TYPE_CONFIG) as [string, typeof TASK_TYPE_CONFIG[keyof typeof TASK_TYPE_CONFIG]][]).map(
            ([key, conf]) => (
              <label
                key={key}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer
                  transition-all text-center text-xs font-medium select-none
                  ${selectedType === key
                    ? `${conf.bg} ${conf.text} border-current shadow-sm`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }
                `}
              >
                <input
                  type="radio"
                  name="type"
                  value={key}
                  checked={selectedType === key}
                  onChange={() => setSelectedType(key)}
                  className="sr-only"
                  required
                />
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={conf.iconPath} />
                </svg>
                {isEn ? conf.labelEn : conf.labelAr}
              </label>
            ),
          )}
        </div>
      </div>

      {/* ── Cleaning Type (Conditional) ─────────────────────────────────── */}
      {selectedType === "CLEANING" && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isEn ? "Cleaning Type" : "نوع التنظيف"} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "DEEP", labelEn: "Deep Cleaning", labelAr: "تنظيف عميق" },
              { id: "MEDIUM", labelEn: "Medium Cleaning", labelAr: "تنظيف متوسط" },
              { id: "REGULAR", labelEn: "Regular Cleaning", labelAr: "تنظيف عادي" },
            ].map((ct) => (
              <label key={ct.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  name="cleaningType"
                  value={ct.id}
                  required
                  className="w-4 h-4 text-nassayem border-gray-300 focus:ring-nassayem"
                />
                <span className="text-gray-800">{isEn ? ct.labelEn : ct.labelAr}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="title">
          {isEn ? "Title" : "العنوان"}
          <span className="text-gray-400 font-normal ms-1.5 text-xs">
            ({isEn ? "optional" : "اختياري"})
          </span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={200}
          placeholder={isEn ? "e.g. Deep clean unit 302" : "مثال: تنظيف شامل للوحدة 302"}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
        />
      </div>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="description">
          {isEn ? "Description" : "الوصف"}
          <span className="text-gray-400 font-normal ms-1.5 text-xs">
            ({isEn ? "optional" : "اختياري"})
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder={isEn ? "Additional details or instructions…" : "تفاصيل أو تعليمات إضافية…"}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem resize-none"
        />
      </div>

      {/* ── Photos (Optional) ──────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="photos">
          {isEn ? "Attach Photos" : "إرفاق صور"}
          <span className="text-gray-400 font-normal ms-1.5 text-xs">
            ({isEn ? `optional · up to ${MAX_PHOTOS}` : `اختياري · حتى ${MAX_PHOTOS} صور`})
          </span>
        </label>

        {photos.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-2">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="w-full h-full object-cover" />
                {!isBusy && (
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute top-1 end-1 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                    title={isEn ? "Remove photo" : "إزالة الصورة"}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_PHOTOS && (
          <input
            id="photos"
            type="file"
            multiple
            accept="image/jpeg, image/jpg, image/png, image/webp"
            onChange={handlePhotoSelect}
            disabled={isBusy}
            className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-nassayem/10 file:text-nassayem hover:file:bg-nassayem/20 disabled:opacity-60"
          />
        )}
        {preparingPhotos && (
          <p className="text-xs text-gray-500 mt-1.5">{isEn ? "Preparing photos…" : "جارٍ تجهيز الصور…"}</p>
        )}
        {photoError && <p className="text-xs text-red-600 mt-1.5">{photoError}</p>}
      </div>

      {/* ── Building + Unit ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="buildingId">
            {isEn ? "Building" : "المبنى"} <span className="text-red-500">*</span>
          </label>
          <select
            id="buildingId"
            name="buildingId"
            required
            value={selectedBuildingId}
            onChange={(e) => {
              setSelectedBuildingId(e.target.value);
              setUnitMode("dropdown");
            }}
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            <option value="">{isEn ? "Select building…" : "اختر المبنى…"}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {buildingLabel(b, isEn)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isEn ? "Unit" : "الوحدة"} <span className="text-red-500">*</span>
          </label>
          {unitMode === "dropdown" ? (
            <select
              id="unitId"
              name="unitId"
              required
              onChange={(e) => {
                if (e.target.value === "CUSTOM") {
                  setUnitMode("custom");
                }
              }}
              disabled={!selectedBuildingId}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            >
              <option value="">{isEn ? "Select unit…" : "اختر الوحدة…"}</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
              <option value="CUSTOM">{isEn ? "Other / Common Area..." : "أخرى / منطقة مشتركة..."}</option>
            </select>
          ) : (
            <div className="relative">
              <input
                id="unitNumber"
                name="unitNumber"
                type="text"
                required
                maxLength={100}
                placeholder={isEn ? "e.g. Corridor, Lobby, Pool..." : "مثال: الممر، اللوبي، المسبح..."}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem pr-10"
                autoFocus
              />
              <button 
                type="button" 
                onClick={() => setUnitMode("dropdown")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title={isEn ? "Back to list" : "العودة للقائمة"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Priority + Assigned To ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="priority">
            {isEn ? "Priority" : "الأولوية"} <span className="text-red-500">*</span>
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue="MEDIUM"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
          >
            {(
              Object.entries(TASK_PRIORITY_CONFIG) as [
                string,
                typeof TASK_PRIORITY_CONFIG[keyof typeof TASK_PRIORITY_CONFIG],
              ][]
            ).map(([key, conf]) => (
              <option key={key} value={key}>
                {isEn ? conf.labelEn : conf.labelAr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="assignedToId">
            {isEn ? "Assign To" : "تعيين إلى"} <span className="text-red-500">*</span>
          </label>
          {selfOnly ? (
            <div className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
              {(assignableStaff[0]?.name ?? assignableStaff[0]?.email.split("@")[0]) || (isEn ? "You" : "أنت")}
              <span className="text-gray-400 ms-1.5 text-xs">
                ({isEn ? "yourself" : "نفسك"})
              </span>
              <input type="hidden" name="assignedToId" value={assignableStaff[0]?.id ?? ""} />
            </div>
          ) : !assignableStaff || assignableStaff.length === 0 ? (
            <p className="px-4 py-2.5 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
              {isEn ? "No assignable staff found." : "لا يوجد موظفون للتعيين."}
            </p>
          ) : (
            <select
              id="assignedToId"
              name="assignedToId"
              required
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
            >
              <option value="">{isEn ? "Select staff member…" : "اختر موظفاً…"}</option>
              {assignableStaff.map((u) => {
                const roleConf = STAFF_ROLE_CONFIG[u.role as TStaffRole];
                return (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email.split("@")[0]}
                    {roleConf ? ` (${isEn ? roleConf.labelEn : roleConf.labelAr})` : ""}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* ── Due Date & Time ──────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="dueDate">
          {isEn ? "Due Date & Time" : "تاريخ ووقت الاستحقاق"} <span className="text-red-500">*</span>
        </label>
        <input
          id="dueDate"
          name="dueDate"
          type="datetime-local"
          required
          min={new Date().toISOString().slice(0, 16)}
          className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white"
        />
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100">
        <a
          href={`/${locale}/admin/tasks`}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
        >
          {isEn ? "Cancel" : "إلغاء"}
        </a>
        <button
          type="submit"
          disabled={isBusy}
          className="flex items-center gap-2 px-6 py-2.5 bg-nassayem text-white text-sm font-medium rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {(isPending || isUploading) && (
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isUploading
            ? (isEn
                ? `Uploading photos ${uploadProgress!.done}/${uploadProgress!.total}…`
                : `جارٍ رفع الصور ${uploadProgress!.done}/${uploadProgress!.total}…`)
            : isPending
              ? (isEn ? "Creating…" : "جارٍ الإنشاء…")
              : (isEn ? "Create Task" : "إنشاء المهمة")}
        </button>
      </div>
    </form>
  );
}
