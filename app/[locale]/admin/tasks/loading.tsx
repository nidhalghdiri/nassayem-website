// Shown instantly while a Tasks dashboard / list loads its data on the server.
export default function TasksLoading() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex items-start justify-center pt-24">
      <div className="w-8 h-8 border-4 border-nassayem border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
