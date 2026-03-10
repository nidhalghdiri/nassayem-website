import AdminSidebar from "@/components/admin/AdminSidebar";

type AdminLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 font-english">
      {/* We force 'font-english' or 'font-arabic' based on your global settings.
        Assuming your body tag handles the main font, we just need the structural layout here. 
      */}

      {/* Sidebar Component */}
      <AdminSidebar locale={locale} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Optional Admin Header (for search, profile, or notifications) */}
        <header className="hidden lg:flex h-16 bg-white border-b border-gray-200 items-center justify-end px-8 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">
              Admin User
            </span>
            <div className="w-10 h-10 bg-nassayem text-white rounded-full flex items-center justify-center font-bold">
              A
            </div>
          </div>
        </header>

        {/* Dynamic Page Content goes here */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
