import { redirect } from "next/navigation";
import DashboardView from "./DashboardView";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTasksModulePage({ params, searchParams }: PageProps) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);

  // The task list now lives at /admin/tasks/list. Forward old list links and
  // task deep-links (?taskId= — used by the WhatsApp notification templates)
  // there so the detail panel opens.
  if (sp.view === "list" || sp.taskId) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "view" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
    }
    const query = qs.toString();
    redirect(`/${locale}/admin/tasks/list${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <DashboardView params={params as any} searchParams={searchParams as any} />
    </div>
  );
}
