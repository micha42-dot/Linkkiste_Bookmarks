import React from 'react';
import { Bookmark } from '../types';

interface WikiTasksProps {
    pages: Bookmark[];
    onSelectPage: (id: number) => void;
}

export const WikiTasks: React.FC<WikiTasksProps> = ({ pages, onSelectPage }) => {
    const allTasks = pages.flatMap(p => {
        if (!p.notes) return [];
        const lines = p.notes.split('\n');
        return lines.map((line, i) => {
            const match = line.match(/^(\s*)- (\[[ x]\]) (.*)/i);
            if (match) {
                return {
                    id: `${p.id}-${i}`,
                    pageId: p.id,
                    pageTitle: p.title,
                    isDone: match[2].toLowerCase() === '[x]',
                    text: match[3].replace(/\[\[(.*?)\]\]/g, '$1'), // Strip wikilinks for clean reading
                };
            }
            return null;
        }).filter(Boolean);
    });

    const pendingTasks = allTasks.filter(t => !t?.isDone);
    const completedTasks = allTasks.filter(t => t?.isDone);

    return (
        <div className="p-3 overflow-y-auto flex-grow bg-[#F9F9F9]">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-200 pb-1">Offene Tasks ({pendingTasks.length})</h3>
            {pendingTasks.length === 0 && <div className="text-xs text-gray-400 italic bg-white p-3 rounded-sm border border-gray-100 shadow-sm">Keine offenen Aufgaben gefunden.</div>}
            
            <div className="flex flex-col gap-2 mb-6">
                {pendingTasks.map(t => (
                    <div 
                        key={t!.id} 
                        className="text-xs bg-white p-2.5 border border-gray-200 rounded-sm cursor-pointer hover:border-del-blue hover:shadow-sm transition-all group" 
                        onClick={() => onSelectPage(t!.pageId)}
                    >
                        <div className="flex items-start gap-2">
                            <span className="text-gray-300 mt-0.5 group-hover:text-del-blue transition-colors">☐</span>
                            <div>
                                <div className="text-gray-800 leading-snug">{t!.text}</div>
                                <div className="text-[10px] text-gray-400 mt-1 font-bold flex items-center gap-1">
                                    <span>📄</span> {t!.pageTitle}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {completedTasks.length > 0 && (
                <>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-3 border-b border-gray-200 pb-1">Erledigt ({completedTasks.length})</h3>
                    <div className="flex flex-col gap-2">
                        {completedTasks.map(t => (
                            <div 
                                key={t!.id} 
                                className="text-xs bg-gray-50 p-2.5 border border-gray-100 rounded-sm cursor-pointer hover:border-gray-300 transition-colors" 
                                onClick={() => onSelectPage(t!.pageId)}
                            >
                                <div className="flex items-start gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                    <span className="text-green-600 mt-0.5 font-bold">☑</span>
                                    <div>
                                        <div className="line-through text-gray-500 leading-snug">{t!.text}</div>
                                        <div className="text-[10px] text-gray-400 mt-1 font-bold flex items-center gap-1">
                                            <span>📄</span> {t!.pageTitle}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
