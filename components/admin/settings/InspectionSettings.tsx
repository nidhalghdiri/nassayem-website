"use client";

import { useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory, addItem, deleteItem } from "@/app/actions/inspectionSettings";

type Item = {
  id: string;
  labelEn: string;
  labelAr: string;
};

type Category = {
  id: string;
  nameEn: string;
  nameAr: string;
  items: Item[];
};

type Props = {
  categories: Category[];
  locale: string;
};

export default function InspectionSettings({ categories, locale }: Props) {
  const isEn = locale === "en";
  const [isPending, startTransition] = useTransition();
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [addingItemToCatId, setAddingItemToCatId] = useState<string | null>(null);

  const handleCreateCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createCategory(formData, locale);
      (e.target as HTMLFormElement).reset();
    });
  };

  const handleUpdateCategory = (id: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateCategory(id, formData, locale);
      setEditingCatId(null);
    });
  };

  const handleAddItem = (categoryId: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addItem(categoryId, formData, locale);
      setAddingItemToCatId(null);
    });
  };

  return (
    <div className="space-y-8">
      {/* Create Category */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {isEn ? "Add New Category" : "إضافة فئة جديدة"}
        </h2>
        <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            name="nameEn"
            placeholder="Name (English)"
            required
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nassayem/30 outline-none"
          />
          <input
            name="nameAr"
            placeholder="الاسم (عربي)"
            required
            dir="rtl"
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nassayem/30 outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-nassayem text-white font-bold py-2 rounded-xl hover:bg-nassayem/90 transition-colors disabled:opacity-50"
          >
            {isEn ? "Add Category" : "إضافة فئة"}
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Category Header */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b border-gray-100">
              {editingCatId === cat.id ? (
                <form onSubmit={(e) => handleUpdateCategory(cat.id, e)} className="flex-1 flex gap-2">
                  <input
                    name="nameEn"
                    defaultValue={cat.nameEn}
                    required
                    className="flex-1 px-3 py-1 text-sm border border-gray-200 rounded-lg outline-none"
                  />
                  <input
                    name="nameAr"
                    defaultValue={cat.nameAr}
                    required
                    dir="rtl"
                    className="flex-1 px-3 py-1 text-sm border border-gray-200 rounded-lg outline-none"
                  />
                  <button type="submit" className="text-nassayem font-bold text-sm">Save</button>
                  <button type="button" onClick={() => setEditingCatId(null)} className="text-gray-400 text-sm">Cancel</button>
                </form>
              ) : (
                <>
                  <div>
                    <h3 className="font-bold text-gray-900">{isEn ? cat.nameEn : cat.nameAr}</h3>
                    <p className="text-xs text-gray-500">{isEn ? cat.nameAr : cat.nameEn}</p>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setEditingCatId(cat.id)} className="text-blue-600 text-sm font-medium">
                      {isEn ? "Edit" : "تعديل"}
                    </button>
                    <button
                      onClick={() => { if(confirm("Delete category?")) startTransition(() => deleteCategory(cat.id, locale)) }}
                      className="text-red-600 text-sm font-medium"
                    >
                      {isEn ? "Delete" : "حذف"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Items List */}
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{isEn ? item.labelEn : item.labelAr}</p>
                      <p className="text-[10px] text-gray-500 truncate">{isEn ? item.labelAr : item.labelEn}</p>
                    </div>
                    <button
                      onClick={() => { if(confirm("Delete item?")) startTransition(() => deleteItem(item.id, locale)) }}
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Add Item Trigger */}
                {addingItemToCatId === cat.id ? (
                  <form onSubmit={(e) => handleAddItem(cat.id, e)} className="p-3 border-2 border-dashed border-gray-200 rounded-xl space-y-2">
                    <input
                      name="labelEn"
                      placeholder="Label (EN)"
                      autoFocus
                      required
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-nassayem/30 outline-none"
                    />
                    <input
                      name="labelAr"
                      placeholder="العنوان (AR)"
                      required
                      dir="rtl"
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-nassayem/30 outline-none"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-nassayem text-white text-[10px] py-1 rounded">Add</button>
                      <button type="button" onClick={() => setAddingItemToCatId(null)} className="flex-1 bg-gray-100 text-gray-500 text-[10px] py-1 rounded">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingItemToCatId(cat.id)}
                    className="flex items-center justify-center p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-nassayem hover:text-nassayem transition-all"
                  >
                    <svg className="w-5 h-5 me-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium">{isEn ? "Add Item" : "إضافة عنصر"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
