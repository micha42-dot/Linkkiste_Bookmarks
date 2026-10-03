import React, { useState } from 'react';
import { Bookmark } from '../types';

interface WikiCalendarProps {
  pages: Bookmark[];
  onSelectPage: (id: number) => void;
  onCreateDailyNote: (dateStr: string) => Promise<void>;
  onCreatePageForDate?: (dateStr: string) => void;
}

export const WikiCalendar: React.FC<WikiCalendarProps> = ({
  pages,
  onSelectPage,
  onCreateDailyNote,
  onCreatePageForDate
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Map of date string YYYY-MM-DD -> Daily note page
  const dailyNotesMap: Record<string, Bookmark> = {};
  // Map of date string YYYY-MM-DD -> list of Wiki pages created on that date
  const pagesByDateMap: Record<string, Bookmark[]> = {};

  pages.forEach(p => {
    // Check if title is a daily note
    const match = p.title.match(/^Daily Note: (\d{4}-\d{2}-\d{2})$/i);
    if (match) {
      dailyNotesMap[match[1]] = p;
    }

    // Check creation date
    if (p.created_at) {
      const createdDate = p.created_at.split('T')[0];
      if (!pagesByDateMap[createdDate]) {
        pagesByDateMap[createdDate] = [];
      }
      pagesByDateMap[createdDate].push(p);
    }
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(todayStr);
  };

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const blanks = Array.from({ length: startOffset }, (_, i) => (
    <div key={`blank-${i}`} className="p-1 min-h-[36px]"></div>
  ));

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasDaily = !!dailyNotesMap[dateStr];
    const createdPagesCount = (pagesByDateMap[dateStr] || []).length;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;

    return (
      <button
        key={day}
        onClick={() => setSelectedDate(dateStr)}
        className={`p-1 min-h-[44px] flex flex-col items-center justify-between text-xs rounded-sm transition-all relative border cursor-pointer ${
          isSelected
            ? 'bg-del-blue text-white font-bold border-del-blue shadow-xs'
            : isToday
            ? 'bg-blue-50/70 border-del-blue text-del-blue font-bold'
            : 'bg-white border-gray-200 hover:border-gray-400 text-gray-700'
        }`}
        title={`${dateStr}: ${hasDaily ? 'Daily Note vorhanden' : ''} (${createdPagesCount} Seiten)`}
      >
        <div className="flex items-center justify-between w-full px-1">
          <span className="text-[11px]">{day}</span>
          {isToday && !isSelected && (
            <span className="w-1.5 h-1.5 rounded-full bg-del-blue"></span>
          )}
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-0.5 mt-1">
          {hasDaily && (
            <span
              className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-del-blue'}`}
              title="Daily Note vorhanden"
            ></span>
          )}
          {createdPagesCount > 0 && !hasDaily && (
            <span
              className={`text-[9px] px-1 rounded-full font-bold leading-tight ${
                isSelected ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {createdPagesCount}
            </span>
          )}
        </div>
      </button>
    );
  });

  // Selected date metadata
  const selectedDaily = dailyNotesMap[selectedDate];
  const selectedCreatedPages = (pagesByDateMap[selectedDate] || []).filter(
    p => !selectedDaily || p.id !== selectedDaily.id
  );

  // Mentions / Backlinks to this date in other pages
  const dateMentions = pages.filter(p => {
    if (selectedDaily && p.id === selectedDaily.id) return false;
    const text = (p.notes || '') + ' ' + (p.description || '') + ' ' + p.title;
    return text.includes(selectedDate) || text.includes(`[[${selectedDate}]]`);
  });

  return (
    <div className="flex flex-col h-full bg-white select-none overflow-y-auto">
      {/* Calendar Header */}
      <div className="p-3 border-b border-gray-200 bg-[#F9F9F9]">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={prevMonth}
            className="text-gray-500 hover:text-black px-2 py-0.5 bg-white border border-gray-300 rounded-sm text-xs font-bold"
            title="Vorheriger Monat"
          >
            ◀
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-800">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={goToToday}
              className="text-[10px] bg-white border border-gray-300 hover:border-del-blue text-del-blue px-2 py-0.5 rounded-sm font-bold cursor-pointer"
            >
              Heute
            </button>
          </div>
          <button
            onClick={nextMonth}
            className="text-gray-500 hover:text-black px-2 py-0.5 bg-white border border-gray-300 rounded-sm text-xs font-bold"
            title="Nächster Monat"
          >
            ▶
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center mt-2">
          {dayNames.map(d => (
            <div key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center mt-1">
          {blanks}
          {days}
        </div>
      </div>

      {/* Date Overview / Detail Section */}
      <div className="p-3 flex-grow bg-white space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div>
            <h4 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
              <span>📅</span> {selectedDate}
              {selectedDate === todayStr && (
                <span className="text-[10px] bg-blue-100 text-del-blue px-1.5 py-0.2 rounded-sm font-bold">
                  HEUTE
                </span>
              )}
            </h4>
            <span className="text-[10px] text-gray-400">Übersicht aller Einträge & Dailies für diesen Tag</span>
          </div>

          {!selectedDaily && (
            <button
              onClick={() => onCreateDailyNote(selectedDate)}
              className="text-[11px] bg-del-blue hover:bg-del-dark-blue text-white px-2.5 py-1 rounded-sm font-bold cursor-pointer transition-colors flex items-center gap-1"
              title="Daily Note für dieses Datum anlegen"
            >
              <span>+</span> Daily Note anlegen
            </button>
          )}
        </div>

        {/* Daily Note Display */}
        {selectedDaily ? (
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">Daily Note</div>
            <div
              onClick={() => onSelectPage(selectedDaily.id)}
              className="p-2.5 bg-[#F0F6FF] border border-blue-200 hover:border-del-blue rounded-sm cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-del-blue group-hover:underline">
                  📅 {selectedDaily.title}
                </span>
                <span className="text-[10px] text-gray-500 group-hover:text-del-blue">Öffnen →</span>
              </div>
              {selectedDaily.notes && (
                <p className="text-[11px] text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                  {selectedDaily.notes.replace(/^[#\-*]\s*/gm, '')}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* Wiki Pages Created on Selected Date */}
        <div>
          <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 flex items-center justify-between">
            <span>Erstellte Wiki-Seiten ({selectedCreatedPages.length})</span>
            {onCreatePageForDate && (
              <button
                onClick={() => onCreatePageForDate(selectedDate)}
                className="text-del-blue hover:underline font-bold lowercase text-[10px] cursor-pointer"
              >
                + neue Seite
              </button>
            )}
          </div>

          {selectedCreatedPages.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-1">
              Keine weiteren Wiki-Seiten an diesem Datum erstellt.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {selectedCreatedPages.map(page => (
                <div
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  className="p-2 bg-gray-50 hover:bg-white border border-gray-200 hover:border-del-blue rounded-sm text-xs cursor-pointer flex items-center justify-between transition-colors"
                >
                  <span className="truncate font-medium text-gray-800">📄 {page.title}</span>
                  <span className="text-[10px] text-gray-400 ml-2">Öffnen</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Date References & Mentions (Backlinks) */}
        {dateMentions.length > 0 && (
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              <span>Erwähnungen & Referenzen ({dateMentions.length})</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {dateMentions.map(page => (
                <div
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  className="p-2 bg-[#FAF8F5] hover:bg-white border border-[#E5DFD5] hover:border-del-blue rounded-sm text-xs cursor-pointer flex items-center justify-between transition-colors"
                >
                  <span className="truncate font-medium text-gray-800">🔗 {page.title}</span>
                  <span className="text-[10px] text-gray-400 ml-2">Ansehen</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
