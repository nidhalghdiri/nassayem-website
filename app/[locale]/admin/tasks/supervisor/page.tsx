import DashboardView from "../DashboardView";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ building?: string; worker?: string }>;
};

export default function SupervisorDashboardPage({ params, searchParams }: PageProps) {
  return <DashboardView params={params} searchParams={searchParams} dashboard="supervisor" />;
}
