import React, { useState, useEffect } from 'react';
import { Bookmark } from '../types';

interface BookmarkDetailProps {
  bookmark: Bookmark;
  onSaveNotes: (id: number, notes: string) => Promise<void>;
  onClose: () => void;
  onDelete: (id: number) => void;
  onToggleRead: (id: number, status: boolean) => void;
}

export const BookmarkDetail: React.FC<BookmarkDetailProps> = ({ 
  bookmark, 
  onSaveNotes, 
  onClose,
  onDelete,
  onToggleRead
}) => {
  const [notes, setNotes] = useState(bookmark.notes || '');
  const [isEditing, setIsEditing] = useState(!bookmark.notes); // Start in edit mode if empty
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Sync internal state if prop changes
  useEffect(() => {
    const currentNotes = bookmark.notes || '';
    setNotes(currentNotes);
    // If we switch bookmarks, go to edit mode if empty, view mode if content exists
    setIsEditing(!currentNotes); 
  }, [bookmark.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await onSaveNotes(bookmark.id, notes);
        setLastSaved(new Date());
        setIsEditing(false); // Switch to View Mode
    } catch (e) {
        // error handled in parent
    } finally {
        setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
      setNotes(bookmark.notes || ''); // Reset to saved value
      setIsEditing(false);
  };

  const dateStr = new Date(bookmark.created_at).toLocaleDateString('de-DE', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  });

  const handleDelete = () => {
      if(window.confirm('Really delete this bookmark?')) {
          onDelete(bookmark.id);
          onClose(); // Go back to list
      }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Navigation */}
      <div className="mb-6 border-b border-gray-200 pb-2 flex justify-between items-center">
        <button onClick={onClose} className="text-xs font-bold text-del-blue hover:underline">
            &laquo; back to list
        </button>
        <span className="text-[10px] text-gray-400">Permalink View</span>
      </div>

      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
        
        {/* Header */}
        <div className="mb-6">
            <h1 className="text-2xl font-bold text-black mb-1 leading-tight">
                <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-del-blue">
                    {bookmark.title}
                </a>
            </h1>
            <a href={bookmark.url} target="_blank" className="text-sm text-gray-500 hover:underline break-all">
                {bookmark.url}
            </a>
            <div className="text-[11px] text-gray-400 mt-1">
                Saved on {dateStr}
            </div>
        </div>

        {/* Description */}
        {bookmark.description && (
            <div className="mb-8 p-4 bg-gray-50 border-l-4 border-gray-200 text-gray-700 italic">
                {bookmark.description}
            </div>
        )}

        {/* Tags & Folders */}
        <div className="flex flex-wrap gap-4 mb-8 text-xs border-y border-gray-100 py-3">
             <div className="flex items-center gap-2">
                 <span className="font-bold text-gray-500">Tags:</span>
                 {bookmark.tags && bookmark.tags.length > 0 ? (
                     bookmark.tags.map(t => (
                         <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm">{t}</span>
                     ))
                 ) : <span className="text-gray-300 italic">none</span>}
             </div>
             
             <div className="w-px bg-gray-200 h-4"></div>

             <div className="flex items-center gap-2">
                 <span className="font-bold text-gray-500">Folders:</span>
                 {bookmark.folders && bookmark.folders.length > 0 ? (
                     bookmark.folders.map(f => (
                         <span key={f} className="bg-del-blue/10 text-del-blue px-2 py-0.5 rounded-sm">{f}</span>
                     ))
                 ) : <span className="text-gray-300 italic">none</span>}
             </div>
        </div>

        {/* Notes Editor */}
        <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
                <label className="font-bold text-sm text-gray-800 flex items-center gap-2">
                    <span>📝 Personal Notes</span>
                </label>
                {lastSaved && !isEditing && (
                    <span className="text-[10px] text-green-600 opacity-70">
                        Saved just now
                    </span>
                )}
            </div>
            
            {isEditing ? (
                /* EDIT MODE */
                <div className="animate-in fade-in duration-200">
                    <textarea
                        value={notes}
                        autoFocus={!bookmark.notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Write your thoughts, summary, or quotes here..."
                        className="w-full h-48 p-4 border border-del-blue rounded-sm text-sm outline-none leading-relaxed bg-white shadow-inner font-serif resize-y"
                    ></textarea>
                    
                    <div className="flex justify-end gap-2 mt-2">
                        {bookmark.notes && (
                            <button 
                                onClick={handleCancelEdit}
                                className="text-gray-500 hover:text-black text-xs font-bold px-3 py-2 uppercase"
                            >
                                Cancel
                            </button>
                        )}
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-del-blue hover:bg-del-dark-blue text-white text-xs font-bold px-4 py-2 rounded-sm disabled:opacity-50 shadow-sm uppercase tracking-wide"
                        >
                            {isSaving ? 'Saving...' : 'Save Notes'}
                        </button>
                    </div>
                </div>
            ) : (
                /* VIEW MODE (Looks "Saved") */
                <div className="bg-[#fffff8] border border-gray-200 p-6 rounded-sm shadow-sm relative group">
                    <div className="prose prose-sm max-w-none font-serif text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px]">
                        {notes}
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1 text-del-blue hover:text-del-dark-blue hover:underline text-xs font-bold uppercase"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            Edit Notes
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4 pt-4 border-t border-gray-100 mt-8 justify-between items-center">
            <div className="flex gap-4">
                <button 
                    onClick={() => onToggleRead(bookmark.id, bookmark.to_read)}
                    className="text-xs font-bold text-gray-500 hover:text-del-blue uppercase"
                >
                    {bookmark.to_read ? '✓ Mark as Read' : '○ Save for later'}
                </button>
                <button 
                    onClick={handleDelete}
                    className="text-xs font-bold text-gray-400 hover:text-red-600 uppercase"
                >
                    Delete Bookmark
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};