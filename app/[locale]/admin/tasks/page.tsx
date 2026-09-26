import DashboardView from "./DashboardView";
import ListView from "./ListView";
import TasksViewTabs from "@/components/admin/tasks/TasksViewTabs";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminTasksModulePage({ params, searchParams }: PageProps) {
  const sp = await searchParams;
  const [{ locale }] = await Promise.all([params]);
  
  const view = (sp.view as string) || "dashboard";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TasksViewTabs currentView={view} locale={locale} />
      
      <div className="flex-1 relative">
        {view === "list" ? (
          <ListView params={params} searchParams={searchParams} />
        ) : (
          <DashboardView params={params as any} searchParams={searchParams as any} />
        )}
      </div>
    </div>
  );
}
