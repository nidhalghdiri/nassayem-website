import prisma from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import ImageUploadForm from "@/components/admin/ImageUploadForm";
import { deleteUnitImage } from "@/app/actions/image";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function UnitImagesPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  // Fetch the unit details and its associated images
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      images: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!unit) return <div>Unit not found</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href={`/${locale}/admin/units`}
          className="text-sm font-bold text-gray-500 hover:text-nassayem mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg
            className="w-4 h-4 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {isEn ? "Back to Units" : "العودة إلى الوحدات"}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Manage Gallery:" : "إدارة معرض الصور:"}{" "}
          {isEn ? unit.titleEn : unit.titleAr}
        </h1>
      </div>

      {/* The Upload Form */}
      <ImageUploadForm unitId={unit.id} locale={locale} />

      {/* The Existing Images Grid */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
          {isEn ? "Property Gallery" : "معرض صور العقار"}
        </h2>

        {unit.images.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {isEn ? "No images uploaded yet." : "لم يتم رفع أي صور بعد."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {unit.images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200"
              >
                <Image
                  src={img.url}
                  alt="Property"
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />

                {/* Delete Button Form */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <form
                    action={async () => {
                      "use server";
                      await deleteUnitImage(img.id, img.url, unit.id, locale);
                    }}
                  >
                    <button
                      type="submit"
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transform hover:scale-110 transition-all"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </form>
                </div>

                {/* Main Image Badge */}
                {img.isMain && (
                  <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-md shadow-sm z-10">
                    {isEn ? "Cover" : "الغلاف"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
