import AdminLoginForm from "@/components/admin/AdminLoginForm";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

export default async function AdminLoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { next } = await searchParams;
  return <AdminLoginForm locale={locale} next={next} />;
}
