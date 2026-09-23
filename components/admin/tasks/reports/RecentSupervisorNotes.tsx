"use client";

import React, { useState } from "react";
import { MessageSquare, Clock, MapPin, X } from "lucide-react";

export type SupervisorNote = {
  id: string;
  text: string;
  createdAt: Date;
  user: { name: string | null; role: string };
  task: { 
    title: string; 
    status: string; 
    building: { nameEn: string; nameAr: string } 
  };
};

interface Props {
  notes: SupervisorNote[];
  locale: string;
}

export default function RecentSupervisorNotes({ notes, locale }: Props) {
  const isEn = locale === "en";
  const [selectedNote, setSelectedNote] = useState<SupervisorNote | null>(null);

  if (!notes || notes.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-base font-bold text-slate-800 mb-4">
          {isEn ? "Recent Supervisor Notes" : "آخر ملاحظات المشرف اليومية"}
        </h2>
        <div className="text-center py-6 text-slate-500 text-sm">
          {isEn ? "No recent notes found." : "لا توجد ملاحظات حديثة."}
        </div>
      </div>
    );
  }

  const timeAgo = (date: Date) => {
    const mins = Math.floor((new Date().getTime() - new Date(date).getTime()) / 60000);
    if (mins < 60) return isEn ? `${mins}m ago` : `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isEn ? `${hours}h ago` : `منذ ${hours} ساعة`;
    return isEn ? `${Math.floor(hours/24)}d ago` : `منذ ${Math.floor(hours/24)} يوم`;
  };

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-base font-bold text-slate-800 mb-4">
          {isEn ? "Recent Supervisor Notes" : "آخر ملاحظات المشرف اليومية"}
        </h2>
        <div className="space-y-3">
          {notes.map(note => (
            <div 
              key={note.id} 
              onClick={() => setSelectedNote(note)}
              className="bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 p-3 rounded-xl flex items-start gap-3 cursor-pointer"
            >
              <div className="bg-blue-100 text-blue-600 p-2 rounded-lg shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{note.task.title}</p>
                <p className="text-xs text-slate-600 mt-1 line-clamp-1">"{note.text}"</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(note.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {isEn ? note.task.building.nameEn : note.task.building.nameAr}
                  </span>
                  <span className="truncate">بواسطة: {note.user.name || "مشرف"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightweight Task Preview Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">{isEn ? "Task Preview" : "معاينة المهمة"}</h3>
              <button 
                onClick={() => setSelectedNote(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1">{isEn ? "Task Title" : "عنوان المهمة"}</p>
                <p className="font-bold text-slate-800 text-lg">{selectedNote.task.title}</p>
              </div>
              <div className="flex gap-4 mb-6">
                <div>
                  <p className="text-xs text-slate-500 mb-1">{isEn ? "Location" : "الموقع"}</p>
                  <p className="font-semibold text-slate-700 text-sm">
                    {isEn ? selectedNote.task.building.nameEn : selectedNote.task.building.nameAr}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">{isEn ? "Status" : "الحالة"}</p>
                  <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                    {selectedNote.task.status}
                  </span>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 relative">
                <MessageSquare className="w-5 h-5 text-blue-200 absolute top-4 left-4" />
                <p className="text-xs text-blue-600 font-bold mb-2">
                  {selectedNote.user.name || "مشرف"} • {timeAgo(selectedNote.createdAt)}
                </p>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  "{selectedNote.text}"
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
              <button 
                onClick={() => setSelectedNote(null)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-6 rounded-xl transition-colors text-sm"
              >
                {isEn ? "Close" : "إغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
