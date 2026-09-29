import DashboardView from "../DashboardView";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ building?: string; worker?: string }>;
};

export default function ReceptionistDashboardPage({ params, searchParams }: PageProps) {
  return <DashboardView params={params} searchParams={searchParams} dashboard="receptionist" />;
}
