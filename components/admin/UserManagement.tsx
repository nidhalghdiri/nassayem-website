"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdminUser, updateAdminUser, deleteAdminUser } from "@/app/actions/users";
import { STAFF_ROLE_CONFIG } from "@/lib/tasks/constants";
import type { TStaffRole } from "@/lib/tasks/constants";
import { format } from "date-fns";

type AdminUser = {
  id: string;
  supabaseId: string;
  email: string;
  name: string | null;
  role: string;
  whatsappNumber: string | null;
  preferredLanguage: string;
  createdAt: Date;
};

type Props = {
  users: AdminUser[];
  currentSupabaseId: string;
  locale: string;
};

const ALL_ROLES = Object.keys(STAFF_ROLE_CONFIG) as TStaffRole[];

export default function UserManagement({ users, currentSupabaseId, locale }: Props) {
  const isEn = locale === "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  // ── Form errors ──────────────────────────────────────────────────────────────
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Create handler ───────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createAdminUser(fd);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    setShowCreate(false);
    startTransition(() => router.refresh());
  }

  // ── Edit handler ─────────────────────────────────────────────────────────────
  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editUser) return;
    setEditError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("adminUserId", editUser.id);
    fd.set("supabaseId", editUser.supabaseId);
    const result = await updateAdminUser(fd);
    if (result.error) {
      setEditError(result.error);
      return;
    }
    setEditUser(null);
    startTransition(() => router.refresh());
  }

  // ── Delete handler ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteUser) return;
    const fd = new FormData();
    fd.set("adminUserId", deleteUser.id);
    fd.set("supabaseId", deleteUser.supabaseId);
    await deleteAdminUser(fd);
    setDeleteUser(null);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {/* ── Users list ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No users yet" : "لا يوجد مستخدمون بعد"}
            </h3>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => {
              const isSelf = u.supabaseId === currentSupabaseId;
              const initials = (u.name ?? u.email).charAt(0).toUpperCase();
              const roleConf = STAFF_ROLE_CONFIG[u.role as TStaffRole];

              return (
                <li key={u.id} className="flex items-center gap-4 px-4 md:px-6 py-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-nassayem/10 text-nassayem rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {u.name ?? u.email}
                      </span>
                      {isSelf && (
                        <span className="text-xs bg-nassayem/10 text-nassayem px-2 py-0.5 rounded-full font-semibold">
                          {isEn ? "You" : "أنت"}
                        </span>
                      )}
                      {roleConf && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleConf.badge}`}>
                          {isEn ? roleConf.labelEn : roleConf.labelAr}
                        </span>
                      )}
                    </div>
                    {u.name && (
                      <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isEn ? "Added " : "أُضيف "}
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditError(null); setEditUser(u); }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {isEn ? "Edit" : "تعديل"}
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => setDeleteUser(u)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        {isEn ? "Delete" : "حذف"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Add User button (outside list) ────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={() => { setCreateError(null); setShowCreate(true); }}
          className="flex items-center gap-2 bg-nassayem text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-nassayem/90 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {isEn ? "Add User" : "إضافة مستخدم"}
        </button>
      </div>

      {/* ── Create modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal title={isEn ? "Add New User" : "إضافة مستخدم جديد"} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <ErrorBanner message={createError} />}

            <Field label={isEn ? "Full Name" : "الاسم الكامل"} optional isEn={isEn}>
              <input name="name" type="text" maxLength={100}
                placeholder={isEn ? "e.g. Ahmed Al-Rashdi" : "مثال: أحمد الرشدي"}
                className={inputCls} />
            </Field>

            <Field label={isEn ? "Email" : "البريد الإلكتروني"} isEn={isEn}>
              <input name="email" type="email" required
                placeholder="user@nassayem.com"
                className={inputCls} />
            </Field>

            <Field label={isEn ? "Password" : "كلمة المرور"} isEn={isEn}>
              <input name="password" type="password" required minLength={8}
                placeholder={isEn ? "Min. 8 characters" : "8 أحرف على الأقل"}
                className={inputCls} />
            </Field>

            <Field label={isEn ? "Role" : "الدور"} isEn={isEn}>
              <select name="role" defaultValue="RECEPTIONIST" className={inputCls}>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {isEn ? STAFF_ROLE_CONFIG[r].labelEn : STAFF_ROLE_CONFIG[r].labelAr}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={isEn ? "WhatsApp Number" : "رقم واتساب"} optional isEn={isEn}>
              <input name="whatsappNumber" type="tel" maxLength={15}
                placeholder="96898590405"
                className={inputCls} />
              <p className="mt-1 text-xs text-gray-400">
                {isEn ? "Omani format: 968XXXXXXXX (no + or spaces)" : "صيغة عمانية: 968XXXXXXXX (بدون + أو مسافات)"}
              </p>
            </Field>

            <Field label={isEn ? "Notification Language" : "لغة الإشعارات"} isEn={isEn}>
              <select name="preferredLanguage" defaultValue="en" className={inputCls}>
                <option value="en">{isEn ? "English" : "الإنجليزية"}</option>
                <option value="ar">{isEn ? "Arabic" : "العربية"}</option>
              </select>
            </Field>

            <ModalActions
              isEn={isEn}
              onCancel={() => setShowCreate(false)}
              submitLabel={isEn ? "Create User" : "إنشاء مستخدم"}
              isPending={isPending}
            />
          </form>
        </Modal>
      )}

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editUser && (
        <Modal title={isEn ? "Edit User" : "تعديل المستخدم"} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {editError && <ErrorBanner message={editError} />}

            <Field label={isEn ? "Full Name" : "الاسم الكامل"} optional isEn={isEn}>
              <input name="name" type="text" maxLength={100}
                defaultValue={editUser.name ?? ""}
                placeholder={isEn ? "e.g. Ahmed Al-Rashdi" : "مثال: أحمد الرشدي"}
                className={inputCls} />
            </Field>

            <Field label={isEn ? "Role" : "الدور"} isEn={isEn}>
              <select name="role" defaultValue={editUser.role} className={inputCls}>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {isEn ? STAFF_ROLE_CONFIG[r].labelEn : STAFF_ROLE_CONFIG[r].labelAr}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={isEn ? "WhatsApp Number" : "رقم واتساب"} optional isEn={isEn}>
              <input name="whatsappNumber" type="tel" maxLength={15}
                defaultValue={editUser.whatsappNumber ?? ""}
                placeholder="96898590405"
                className={inputCls} />
              <p className="mt-1 text-xs text-gray-400">
                {isEn ? "Omani format: 968XXXXXXXX (no + or spaces)" : "صيغة عمانية: 968XXXXXXXX (بدون + أو مسافات)"}
              </p>
            </Field>

            <Field label={isEn ? "Notification Language" : "لغة الإشعارات"} isEn={isEn}>
              <select name="preferredLanguage" defaultValue={editUser.preferredLanguage ?? "en"} className={inputCls}>
                <option value="en">{isEn ? "English" : "الإنجليزية"}</option>
                <option value="ar">{isEn ? "Arabic" : "العربية"}</option>
              </select>
            </Field>

            <Field label={isEn ? "New Password" : "كلمة مرور جديدة"} optional isEn={isEn}>
              <input name="password" type="password" minLength={8}
                placeholder={isEn ? "Leave blank to keep current" : "اتركه فارغاً للإبقاء على الحالي"}
                className={inputCls} />
            </Field>

            <ModalActions
              isEn={isEn}
              onCancel={() => setEditUser(null)}
              submitLabel={isEn ? "Save Changes" : "حفظ التغييرات"}
              isPending={isPending}
            />
          </form>
        </Modal>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      {deleteUser && (
        <Modal title={isEn ? "Delete User" : "حذف المستخدم"} onClose={() => setDeleteUser(null)}>
          <p className="text-sm text-gray-600">
            {isEn
              ? <>Are you sure you want to delete <strong>{deleteUser.name ?? deleteUser.email}</strong>? This cannot be undone.</>
              : <>هل أنت متأكد من حذف <strong>{deleteUser.name ?? deleteUser.email}</strong>؟ لا يمكن التراجع.</>}
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setDeleteUser(null)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isEn ? "Cancel" : "إلغاء"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
            >
              {isPending ? (isEn ? "Deleting…" : "جارٍ الحذف…") : (isEn ? "Delete" : "حذف")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

const inputCls =
  "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem bg-white";

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  optional,
  isEn,
}: {
  label: string;
  children: React.ReactNode;
  optional?: boolean;
  isEn: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {optional && (
          <span className="text-gray-400 font-normal ms-1.5 text-xs">
            ({isEn ? "optional" : "اختياري"})
          </span>
        )}
        {!optional && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      {message}
    </div>
  );
}

function ModalActions({
  isEn,
  onCancel,
  submitLabel,
  isPending,
}: {
  isEn: boolean;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {isEn ? "Cancel" : "إلغاء"}
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-nassayem hover:bg-nassayem/90 rounded-lg transition-colors disabled:opacity-60"
      >
        {isPending && (
          <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {submitLabel}
      </button>
    </div>
  );
}
