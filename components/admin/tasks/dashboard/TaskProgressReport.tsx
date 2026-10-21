"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, ChevronDown, ListChecks, Loader2, RotateCcw, Search, Users, X } from "lucide-react";
import { getTaskProgress, getTotalTasks } from "@/app/actions/taskProgress";
import type { TaskProgressResult } from "@/lib/reports/taskProgress";
import type { DashboardTask } from "@/lib/reports/receptionistDashboard";
import { STAFF_ROLE_CONFIG, type TStaffRole } from "@/lib/tasks/constants";
import TaskListModal from "./receptionist/TaskListModal";

type StaffUser = { id: string; name: string | null; email: string; role: string };

type Props = {
  isEn: boolean;
  staff: StaffUser[];
  onOpenTask: (id: string) => void;
  /** Bump to reload (e.g. after a task was changed in the details panel). */
  refreshKey: number;
};

type CardKey = "total" | "inProgress" | "overdue";

const staffName = (u: StaffUser) => u.name || u.email.split("@")[0];

/**
 * Manager dashboard: total tasks (by employee and assignment date), and tasks in
 * progress now / overdue (by employee, live).
 */
export default function TaskProgressReport({ isEn, staff, onOpenTask, refreshKey }: Props) {
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<TaskProgressResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openList, setOpenList] = useState<CardKey | null>(null);
  /** The total list is loaded when its card is opened (it can be long) */
  const [totalList, setTotalList] = useState<DashboardTask[] | null>(null);
  const [loadingTotal, setLoadingTotal] = useState(false);
  const [totalFailed, setTotalFailed] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setFailed(false);
    const res = await getTaskProgress({ assigneeIds, from: from || undefined, to: to || undefined });
    if (id !== requestId.current) return;
    if (res.ok) setData(res.data);
    else setFailed(true);
    setLoading(false);
  }, [assigneeIds, from, to]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function openCard(key: CardKey) {
    if (key !== "total") return setOpenList(key);
    setLoadingTotal(true);
    setTotalFailed(false);
    const res = await getTotalTasks({ assigneeIds, from: from || undefined, to: to || undefined });
    setLoadingTotal(false);
    if (!res.ok) return setTotalFailed(true);
    setTotalList(res.data);
    setOpenList("total");
  }

  const isFiltered = assigneeIds.length > 0 || from !== "" || to !== "";
  const hasDates = from !== "" || to !== "";
  const live = isEn ? "Live — not affected by the dates" : "وقتي — لا يتأثر بالتاريخ";
  const dateCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem";

  const cards: {
    key: CardKey; label: string; hint: string; count: number | undefined;
    icon: React.ReactNode; bubble: string; valueCls: string; hover: string;
  }[] = [
    {
      key: "total",
      label: isEn ? "Total tasks" : "إجمالي المهام",
      hint: hasDates
        ? isEn ? "Assigned in the chosen dates" : "المُسندة في الفترة المحددة"
        : isEn ? "All assigned tasks" : "كل المهام المُسندة",
      count: data?.totalCount,
      icon: <ListChecks className="w-5 h-5" />,
      bubble: "bg-slate-100 text-slate-600",
      valueCls: "text-slate-900",
      hover: "hover:border-nassayem/40",
    },
    {
      key: "inProgress",
      label: isEn ? "Tasks in progress now" : "المهام قيد الإنجاز حالياً",
      hint: `${isEn ? "Work started, not finished" : "بدأ العمل ولم ينتهِ"} · ${live}`,
      count: data?.inProgress.length,
      icon: <Activity className="w-5 h-5" />,
      bubble: "bg-blue-50 text-blue-600",
      valueCls: "text-slate-900",
      hover: "hover:border-blue-300",
    },
    {
      key: "overdue",
      label: isEn ? "Overdue tasks" : "المهام المتأخرة",
      hint: `${isEn ? "Not finished and past the due time" : "لم تكتمل وتجاوزت موعد التسليم"} · ${live}`,
      count: data?.overdue.length,
      icon: <AlertCircle className="w-5 h-5" />,
      bubble: "bg-red-50 text-red-600",
      valueCls: "text-red-600",
      hover: "hover:border-red-300",
    },
  ];

  return (
    <section className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-100 space-y-5" aria-label={isEn ? "Task progress" : "متابعة المهام"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-800">{isEn ? "Task progress" : "متابعة المهام"}</h2>
        {loading && data && <Loader2 className="w-4 h-4 animate-spin text-nassayem" aria-label={isEn ? "Loading" : "جارٍ التحميل"} />}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3 items-end">
        <div>
          <span className="block text-xs font-bold text-slate-500 mb-1.5">{isEn ? "Assigned employees" : "الموظفون المكلَّفون"}</span>
          <EmployeeMultiSelect isEn={isEn} staff={staff} selected={assigneeIds} onChange={setAssigneeIds} />
        </div>
        <label className="block">
          <span className="block text-xs font-bold text-slate-500 mb-1.5">{isEn ? "Assigned from" : "تاريخ الإسناد — من"}</span>
          <input type="date" dir="ltr" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateCls} />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-500 mb-1.5">{isEn ? "to" : "إلى"}</span>
          <input type="date" dir="ltr" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateCls} />
        </label>
      </div>
      {isFiltered && (
        <button
          type="button"
          onClick={() => { setAssigneeIds([]); setFrom(""); setTo(""); }}
          className="-mt-2 flex items-center gap-1.5 text-xs font-bold text-nassayem hover:text-nassayem/80"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {isEn ? "Reset filters" : "إعادة ضبط الفلاتر"}
        </button>
      )}

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      {failed && !data ? (
        <div className="py-8 text-center text-sm text-slate-600">
          {isEn ? "Could not load the report." : "تعذّر تحميل التقرير."}{" "}
          <button type="button" onClick={load} className="font-bold text-nassayem hover:underline">{isEn ? "Try again" : "إعادة المحاولة"}</button>
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-opacity ${loading && data ? "opacity-60" : ""}`}>
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              disabled={!data || loadingTotal}
              onClick={() => openCard(c.key)}
              className={`text-start bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4 transition-all hover:shadow-md ${c.hover} disabled:cursor-wait`}
            >
              <span className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${c.bubble}`}>
                {c.key === "total" && loadingTotal ? <Loader2 className="w-5 h-5 animate-spin" /> : c.icon}
              </span>
              <span className="min-w-0">
                <span className={`block text-3xl font-black leading-none tabular-nums ${c.valueCls}`}>
                  {c.count ?? <Loader2 className="w-6 h-6 animate-spin text-slate-300" />}
                </span>
                <span className="block text-sm font-bold text-slate-800 mt-2">{c.label}</span>
                <span className="block text-xs text-slate-400 mt-0.5">{c.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {totalFailed && (
        <p role="alert" className="text-sm text-red-600">
          {isEn ? "Could not load the task list. Please try again." : "تعذّر تحميل قائمة المهام. يرجى المحاولة مجدداً."}
        </p>
      )}

      {openList && data && (
        <TaskListModal
          isEn={isEn}
          title={cards.find((c) => c.key === openList)!.label}
          accentClass={cards.find((c) => c.key === openList)!.bubble}
          tasks={openList === "total" ? totalList ?? [] : data[openList]}
          onClose={() => setOpenList(null)}
          onOpenTask={onOpenTask}
        />
      )}
    </section>
  );
}

/** Dropdown with a search box and a checkbox per employee; nothing selected = everyone. */
function EmployeeMultiSelect({
  isEn,
  staff,
  selected,
  onChange,
}: {
  isEn: boolean;
  staff: StaffUser[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sorted = useMemo(() => [...staff].sort((a, b) => staffName(a).localeCompare(staffName(b))), [staff]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((u) => staffName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const roleLabel = (role: string) => {
    const conf = STAFF_ROLE_CONFIG[role as TStaffRole];
    return conf ? (isEn ? conf.labelEn : conf.labelAr) : role;
  };

  const summary =
    selected.length === 0
      ? isEn ? "All employees" : "كل الموظفين"
      : selected.length === 1
        ? staffName(staff.find((u) => u.id === selected[0]) ?? { id: "", name: null, email: "—", role: "" })
        : isEn ? `${selected.length} employees` : `${selected.length} موظفين`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 hover:border-nassayem/40 focus:outline-none focus:ring-2 focus:ring-nassayem/30 focus:border-nassayem"
      >
        <Users className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-start truncate">{summary}</span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-label={isEn ? "Clear" : "مسح"}
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange([]); } }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full min-w-[260px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isEn ? "Search employees…" : "ابحث عن موظف…"}
                className="w-full ps-8 pe-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-nassayem/30"
              />
            </div>
          </div>
          <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500 text-center">{isEn ? "No employees found." : "لا يوجد موظفون."}</li>
            ) : (
              visible.map((u) => {
                const checked = selected.includes(u.id);
                return (
                  <li key={u.id} role="option" aria-selected={checked}>
                    <label className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(u.id)}
                        className="w-4 h-4 rounded border-slate-300 text-nassayem focus:ring-nassayem/30"
                      />
                      <span className="flex-1 truncate text-slate-800">{staffName(u)}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{roleLabel(u.role)}</span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
