"use client";

import { useRef, useState, useTransition } from "react";
import { uploadUnitImage } from "@/app/actions/image";
import Image from "next/image";
import imageCompression from "browser-image-compression";

export default function ImageUploadForm({
  unitId,
  locale,
}: {
  unitId: string;
  locale: string;
}) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [isCompressing, setIsCompressing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setCompressedFile(null);
      return;
    }

    // Show initial preview immediately
    setPreview(URL.createObjectURL(file));

    // If file is > 1MB, compress it
    if (file.size > 1024 * 1024) {
      setIsCompressing(true);
      try {
        const options = {
          maxSizeMB: 0.9, // Target under 1MB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressed = await imageCompression(file, options);
        setCompressedFile(compressed);
        // Update preview with compressed version
        setPreview(URL.createObjectURL(compressed));
      } catch (error) {
        console.error("Compression failed:", error);
        // Fallback to original file if compression fails
        setCompressedFile(file);
      } finally {
        setIsCompressing(false);
      }
    } else {
      setCompressedFile(file);
    }
  };

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!compressedFile) return;

    const formData = new FormData();
    formData.append("image", compressedFile);

    startTransition(async () => {
      try {
        await uploadUnitImage(formData, unitId, locale);
        setPreview(null);
        setCompressedFile(null);
        formRef.current?.reset();
      } catch (error) {
        console.error("Upload error:", error);
        alert(isEn ? "Upload failed. Please try again." : "فشل الرفع. يرجى المحاولة مرة أخرى.");
      }
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleUpload}
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8"
    >
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {isEn ? "Upload New Image" : "رفع صورة جديدة"}
      </h3>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 w-full relative">
          <input
            type="file"
            name="image"
            accept="image/jpeg, image/png, image/webp"
            required
            onChange={handleFileChange}
            disabled={isPending || isCompressing}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-nassayem/10 file:text-nassayem hover:file:bg-nassayem/20 cursor-pointer border border-gray-200 rounded-xl disabled:opacity-50"
          />
          {isCompressing && (
            <p className="text-xs text-nassayem font-bold mt-1 animate-pulse">
              {isEn ? "Optimizing image..." : "جاري تحسين الصورة..."}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || !compressedFile || isCompressing}
          className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-white bg-nassayem hover:bg-nassayem-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
        >
          {isPending ? (
            <svg
              className="animate-spin h-5 w-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : isEn ? (
            "Upload"
          ) : (
            "رفع الصورة"
          )}
        </button>
      </div>

      {preview && (
        <div className="mt-4 flex items-end gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">
              {isEn ? "Preview:" : "معاينة:"}
            </p>
            <div className="relative h-32 w-48 overflow-hidden rounded-lg shadow-sm border border-gray-100">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
              />
            </div>
          </div>
          {compressedFile && (
            <div className="text-xs text-gray-500 pb-1">
              {isEn ? "Size:" : "الحجم:"} {(compressedFile.size / 1024 / 1024).toFixed(2)} MB
            </div>
          )}
        </div>
      )}
    </form>
  );
}
