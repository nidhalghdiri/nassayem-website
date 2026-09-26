const fs = require('fs');
const file = '/Users/marketing/Desktop/nassayem-website/nassayem-website/components/admin/tasks/dashboard/DirectorDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update imports
code = code.replace(
  'import { Plus, CheckCircle2, AlertCircle, TrendingUp, CalendarDays, X } from "lucide-react";',
  'import { Plus, CheckCircle2, AlertCircle, TrendingUp, CalendarDays, X, Clock, Activity, CheckSquare } from "lucide-react";\nimport { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";'
);

// Update Stats type
code = code.replace(
  'type Stats = {\\n  totalAssigned: number;\\n  active: number;\\n  completed: number;\\n  delayed: number;\\n};',
  'type Stats = {\\n  totalAssigned: number;\\n  active: number;\\n  completed: number;\\n  delayed: number;\\n  timeAdherence: number;\\n  waitingAudit: number;\\n};'
);

// Update Props
code = code.replace(
  '  stats: Stats;\\n  buildings: Building[];',
  '  stats: Stats;\\n  trendData: { date: string; count: number }[];\\n  buildings: Building[];'
);

code = code.replace(
  'export default function DirectorDashboard({ locale, stats, buildings',
  'export default function DirectorDashboard({ locale, stats, trendData, buildings'
);

// Add Modal state
code = code.replace(
  '  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);',
  `  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"ACTIVE" | "DELAYED" | "WAITING_AUDIT" | null>(null);
  const [modalTasks, setModalTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  React.useEffect(() => {
    if (!modalType) {
      setModalTasks([]);
      return;
    }
    setIsLoadingTasks(true);
    let url = \`/api/tasks?\`;
    if (modalType === "ACTIVE") url += "status=IN_PROGRESS&status=ASSIGNED&status=WORK_STARTED"; // Simplified for now, or fetch all and filter, wait API doesn't support multiple same params easily in this basic implementation, we can just fetch all and filter or add an endpoint. Actually, let's just fetch all and filter in JS if not too many, or just rely on standard statuses.
    // Better: just fetch all tasks for the modal and filter client side since it's a dashboard and tasks aren't millions.
    fetch(\`/api/tasks\`)
      .then(res => res.json())
      .then(data => {
        let filtered = data;
        const TERMINAL = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
        if (modalType === "ACTIVE") {
          filtered = data.filter((t: any) => !TERMINAL.includes(t.status));
        } else if (modalType === "DELAYED") {
          filtered = data.filter((t: any) => !TERMINAL.includes(t.status) && new Date(t.dueDate) < new Date());
        } else if (modalType === "WAITING_AUDIT") {
          filtered = data.filter((t: any) => ["CLEANING_COMPLETED", "WORK_COMPLETED"].includes(t.status));
        }
        setModalTasks(filtered);
        setIsLoadingTasks(false);
      })
      .catch(() => setIsLoadingTasks(false));
  }, [modalType]);`
);

// Translations updates
code = code.replace(
  '    activeTasks: isEn ? "Active Tasks" : "المهام النشطة",',
  `    activeTasks: isEn ? "Active Tasks" : "المهام النشطة",
    timeAdherence: isEn ? "Time Adherence" : "الالتزام بالوقت",
    waitingAudit: isEn ? "Waiting Audit" : "بانتظار تدقيق المشرف",`
);

const kpiRegex = /{\/\* KPI Cards \*\/}[\s\S]*?{\/\* Middle Section: Charts \*\/}/;

const newKpiSection = `{/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div 
            onClick={() => setModalType("ACTIVE")}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-nassayem/50 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.activeTasks}</p>
            <p className="text-3xl font-bold text-slate-800">{stats.active}</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.timeAdherence}</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.timeAdherence}%</p>
          </div>

          <div 
            onClick={() => setModalType("DELAYED")}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-red-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-3 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.delayedTasks}</p>
            <p className="text-3xl font-bold text-red-500">{stats.delayed}</p>
          </div>

          <div 
            onClick={() => setModalType("WAITING_AUDIT")}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-orange-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-3 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{t.waitingAudit}</p>
            <p className="text-3xl font-bold text-orange-500">{stats.waitingAudit}</p>
          </div>
        </div>

        {/* Trend Chart Area */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-slate-800">{t.trendTitle}</h2>
            <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{isEn ? "Last 14 Days" : "آخر 14 يوماً"}</span>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                />
                <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Middle Section: Charts */}`;

code = code.replace(kpiRegex, newKpiSection);

const modalHtml = `
      {/* Create Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">
                {isEn ? "Create New Task" : "إنشاء مهمة جديدة"}
              </h2>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              <CreateTaskForm
                buildings={buildings}
                assignableStaff={assignableStaff}
                locale={locale}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tasks List Modal */}
      {modalType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {modalType === "ACTIVE" && <Activity className="w-5 h-5 text-blue-600" />}
                {modalType === "DELAYED" && <AlertCircle className="w-5 h-5 text-red-600" />}
                {modalType === "WAITING_AUDIT" && <CheckSquare className="w-5 h-5 text-orange-600" />}
                {modalType === "ACTIVE" ? t.activeTasks : modalType === "DELAYED" ? t.delayedTasks : t.waitingAudit}
              </h2>
              <button
                onClick={() => setModalType(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              {isLoadingTasks ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-8 h-8 border-4 border-nassayem border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : modalTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>{isEn ? "No tasks found." : "لا توجد مهام."}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalTasks.map((t) => (
                    <div key={t.id} className="bg-white border border-slate-100 p-4 rounded-xl flex justify-between items-center hover:border-nassayem/30 transition-colors shadow-sm">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">{t.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>{isEn ? t.building?.nameEn : t.building?.nameAr}</span>
                          {t.unitNumber && (
                            <>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span>{t.unitNumber}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-end">
                        <span className={\`text-xs font-bold px-2.5 py-1 rounded-md \${
                          modalType === 'DELAYED' ? 'bg-red-50 text-red-600' :
                          modalType === 'WAITING_AUDIT' ? 'bg-orange-50 text-orange-600' :
                          'bg-blue-50 text-blue-600'
                        }\`}>
                          {t.status}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {new Date(t.dueDate).toLocaleDateString(isEn ? 'en-US' : 'ar-EG', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

code = code.replace(/\{\/\* Create Task Modal \*\/\}[\s\S]*?<\/div>\n  \);\n\}/, modalHtml);

fs.writeFileSync(file, code);
