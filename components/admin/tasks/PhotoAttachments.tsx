"use client";

import React, { useId, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, X } from "lucide-react";

export type PendingPhoto = { id: string; file: File; preview: string };

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Photos picked before the task exists. They are compressed in the browser and
 * uploaded one by one (each request stays small) once the task has been created.
 * The parent owns the list so it can upload it after creating the task.
 */
export default function PhotoAttachments({
  isEn, photos, onChange, max = 5, disabled = false,
}: {
  isEn: boolean;
  photos: PendingPhoto[];
  onChange: (photos: PendingPhoto[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    input.value = ""; // allow picking the same file again
    if (!files.length) return;

    setError(null);
    const room = max - photos.length;
    if (files.length > room) {
      setError(isEn ? `You can attach up to ${max} photos.` : `يمكنك إرفاق ${max} صور كحد أقصى.`);
    }

    setBusy(true);
    const added: PendingPhoto[] = [];
    for (let file of files.slice(0, Math.max(0, room))) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(isEn ? `"${file.name}" is not a JPG, PNG or WebP image.` : `"${file.name}" ليست صورة JPG أو PNG أو WebP.`);
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
        setError(isEn ? `"${file.name}" is too large.` : `"${file.name}" حجمها كبير جداً.`);
        continue;
      }
      added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file, preview: URL.createObjectURL(file) });
    }
    onChange([...photos, ...added]);
    setBusy(false);
  }

  function remove(photoId: string) {
    const target = photos.find((p) => p.id === photoId);
    if (target) URL.revokeObjectURL(target.preview);
    onChange(photos.filter((p) => p.id !== photoId));
  }

  return (
    <div>
      <p className="text-sm font-bold text-slate-800 mb-2">
        {isEn ? "Photos" : "الصور"}
        <span className="text-slate-400 font-medium text-xs ms-1.5">
          ({isEn ? `optional · up to ${max}` : `اختياري · حتى ${max} صور`})
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="w-full h-full object-cover" />
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label={isEn ? "Remove photo" : "إزالة الصورة"}
                className="absolute top-1 end-1 w-5 h-5 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {photos.length < max && (
          <>
            <label
              htmlFor={id}
              className={`w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors ${
                disabled || busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-nassayem hover:text-nassayem hover:bg-nassayem/5"
              }`}
            >
              <Camera className="w-5 h-5" />
              {busy ? (isEn ? "Preparing…" : "جارٍ التجهيز…") : (isEn ? "Add" : "إضافة")}
            </label>
            <input
              id={id}
              type="file"
              accept="image/jpeg, image/jpg, image/png, image/webp"
              multiple
              onChange={handleSelect}
              disabled={disabled || busy}
              className="sr-only"
            />
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

/** Uploads the picked photos to a task, one request each. Returns how many failed. */
export async function uploadTaskPhotos(
  taskId: string,
  photos: PendingPhoto[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ failed: number }> {
  let failed = 0;
  for (let i = 0; i < photos.length; i++) {
    const fd = new FormData();
    fd.append("file", photos[i].file);
    try {
      const res = await fetch(`/api/tasks/${taskId}/photos`, { method: "POST", body: fd });
      if (!res.ok) failed++;
    } catch {
      failed++;
    }
    onProgress?.(i + 1, photos.length);
  }
  return { failed };
}
