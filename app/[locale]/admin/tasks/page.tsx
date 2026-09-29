import { redirect } from "next/navigation";
import DashboardView from "./DashboardView";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Default Tasks dashboard for the user's role (Manager → manager dashboard,
// Supervisor → supervisor, Receptionist → receptionist, others → worker).
// The other dashboards live at /admin/tasks/{supervisor,receptionist,worker}.
export default async function AdminTasksModulePage({ params, searchParams }: PageProps) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);

  // Forward legacy URLs:
  //  - ?view=list / ?taskId= → the task list (WhatsApp notification templates
  //    link to /admin/tasks?taskId=…)
  //  - ?tab=supervisor|receptionist|worker → that dashboard's own route
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "view" || key === "tab" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
  }
  const query = qs.toString() ? `?${qs.toString()}` : "";

  if (sp.view === "list" || sp.taskId) {
    redirect(`/${locale}/admin/tasks/list${query}`);
  }
  if (sp.tab === "supervisor" || sp.tab === "receptionist" || sp.tab === "worker") {
    redirect(`/${locale}/admin/tasks/${sp.tab}${query}`);
  }

  return <DashboardView params={params} searchParams={searchParams as Promise<{ building?: string; worker?: string }>} />;
}
