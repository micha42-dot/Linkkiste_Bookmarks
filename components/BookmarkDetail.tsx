import React, { useState, useEffect } from 'react';
import { Bookmark } from '../types';

interface BookmarkDetailProps {
  bookmark: Bookmark;
  onSaveNotes: (id: number, notes: string) => Promise<void>;
  onUpdate: (id: number, data: { title: string, url: string, description: string, tags: string[], folders: string[] }) => Promise<void>;
  allFolders: string[];
  onClose: () => void;
  onDelete: (id: number) => void;
  onToggleRead: (id: number, status: boolean) => void;
}

export const BookmarkDetail: React.FC<BookmarkDetailProps> = ({ 
  bookmark, 
  onSaveNotes, 
  onUpdate,
  allFolders,
  onClose,
  onDelete,
  onToggleRead
}) => {
  // Notes State
  const [notes, setNotes] = useState(bookmark.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(!bookmark.notes); 
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // Metadata Edit State
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  
  // Form State
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [description, setDescription] = useState(bookmark.description || '');
  const [tags, setTags] = useState(bookmark.tags ? bookmark.tags.join(', ') : '');
  const [folders, setFolders] = useState(bookmark.folders ? bookmark.folders.join(', ') : '');

  // Sync internal state if prop changes (e.g. switching between bookmarks in detail view)
  useEffect(() => {
    setNotes(bookmark.notes || '');
    setIsEditingNotes(!bookmark.notes);
    
    // Reset Form
    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setDescription(bookmark.description || '');
    setTags(bookmark.tags ? bookmark.tags.join(', ') : '');
    setFolders(bookmark.folders ? bookmark.folders.join(', ') : '');
  }, [bookmark.id]);

  const handleSaveNotesAction = async () => {
    setIsSavingNotes(true);
    try {
        await onSaveNotes(bookmark.id, notes);
        setIsEditingNotes(false);
    } catch (e) {
        // error handled in parent
    } finally {
        setIsSavingNotes(false);
    }
  };

  const handleSaveMetaAction = async () => {
    setIsSavingMeta(true);
    try {
        const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const folderArray = folders.split(/[;,]+/).map(f => f.trim()).filter(f => f.length > 0);
        
        await onUpdate(bookmark.id, {
            title,
            url,
            description,
            tags: tagArray,
            folders: folderArray
        });
        setIsEditingMeta(false);
    } catch (e) {
        // error handled in parent
    } finally {
        setIsSavingMeta(false);
    }
  };

  const handleCancelEditNotes = () => {
      setNotes(bookmark.notes || '');
      setIsEditingNotes(false);
  };

  const handleAddExistingFolder = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selected = e.target.value;
      if (!selected) return;
      
      // If folders is empty, set it. If not, append with comma
      if (!folders.trim()) {
          setFolders(selected);
      } else {
          // Check if already exists in text to avoid duplicates
          const current = folders.split(',').map(f => f.trim());
          if (!current.includes(selected)) {
              setFolders(folders + ', ' + selected);
          }
      }
      e.target.value = ''; // Reset select
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
        
        <div className="flex gap-4 items-center">
             {/* EDIT BUTTON (Permanent sichtbar) */}
             {!isEditingMeta && (
                <button 
                    onClick={() => setIsEditingMeta(true)}
                    className="text-del-blue bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-sm flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    Edit Details
                </button>
             )}
             <span className="text-[10px] text-gray-400">Permalink View</span>
        </div>
      </div>

      <div className="bg-white p-6 border border-gray-200 shadow-sm rounded-sm">
        
        {/* EDIT META FORM */}
        {isEditingMeta ? (
            <div className="mb-8 space-y-4 bg-gray-50 p-6 border border-blue-200 rounded">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-sm text-del-blue uppercase">Edit Bookmark</h3>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Title</label>
                    <input 
                        type="text" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        className="w-full border p-2 text-sm font-bold rounded-sm focus:border-del-blue outline-none" 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">URL</label>
                    <input 
                        type="url" 
                        value={url} 
                        onChange={(e) => setUrl(e.target.value)} 
                        className="w-full border p-2 text-xs text-gray-500 rounded-sm focus:border-del-blue outline-none" 
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Description</label>
                    <textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        className="w-full border p-2 text-sm rounded-sm focus:border-del-blue outline-none h-20 resize-none" 
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tags (comma separated)</label>
                        <input 
                            type="text" 
                            value={tags} 
                            onChange={(e) => setTags(e.target.value)} 
                            className="w-full border p-2 text-sm rounded-sm focus:border-del-blue outline-none" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Folders</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={folders} 
                                onChange={(e) => setFolders(e.target.value)} 
                                className="w-full border p-2 text-sm rounded-sm focus:border-del-blue outline-none bg-yellow-50/50" 
                                placeholder="Folder1, Folder2..."
                            />
                            {/* Folder Dropdown */}
                            {allFolders.length > 0 && (
                                <select 
                                    onChange={handleAddExistingFolder}
                                    className="border border-gray-300 bg-white text-xs w-24 rounded-sm focus:border-del-blue outline-none"
                                >
                                    <option value="">+ Add...</option>
                                    {allFolders.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Type manual folders or select from list to append.</p>
                    </div>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-200 mt-2">
                    <button 
                        onClick={handleSaveMetaAction}
                        disabled={isSavingMeta}
                        className="bg-del-blue text-white text-xs font-bold px-4 py-2 rounded-sm hover:bg-del-dark-blue uppercase"
                    >
                        {isSavingMeta ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                        onClick={() => setIsEditingMeta(false)}
                        className="bg-white border border-gray-300 text-gray-600 text-xs font-bold px-3 py-2 rounded-sm hover:bg-gray-100 uppercase"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ) : (
            /* READ ONLY META VIEW */
            <>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-black mb-1 leading-tight pr-12">
                        <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-del-blue">
                            {bookmark.title}
                        </a>
                    </h1>
                    <a href={bookmark.url} target="_blank" className="text-sm text-gray-500 hover:underline break-all block pr-12">
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
            </>
        )}

        {/* Notes Editor */}
        <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
                <label className="font-bold text-sm text-gray-800 flex items-center gap-2">
                    <span>📝 Personal Notes</span>
                </label>
            </div>
            
            {isEditingNotes ? (
                /* EDIT MODE NOTES */
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
                                onClick={handleCancelEditNotes}
                                className="text-gray-500 hover:text-black text-xs font-bold px-3 py-2 uppercase"
                            >
                                Cancel
                            </button>
                        )}
                        <button 
                            onClick={handleSaveNotesAction}
                            disabled={isSavingNotes}
                            className="bg-del-blue hover:bg-del-dark-blue text-white text-xs font-bold px-4 py-2 rounded-sm disabled:opacity-50 shadow-sm uppercase tracking-wide"
                        >
                            {isSavingNotes ? 'Saving...' : 'Save Notes'}
                        </button>
                    </div>
                </div>
            ) : (
                /* VIEW MODE NOTES */
                <div className="bg-[#fffff8] border border-gray-200 p-6 rounded-sm shadow-sm relative group">
                    <div className="prose prose-sm max-w-none font-serif text-gray-800 whitespace-pre-wrap leading-relaxed text-[15px]">
                        {notes}
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setIsEditingNotes(true)}
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