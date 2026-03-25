import AdminLoginForm from "@/components/admin/AdminLoginForm";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AdminLoginPage({ params }: Props) {
  const { locale } = await params;
  return <AdminLoginForm locale={locale} />;
}
