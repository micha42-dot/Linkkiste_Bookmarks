import React, { useMemo, useState } from 'react';
import { Bookmark, ViewMode } from '../types';
import { formatDate, parseDateSafe, sanitizeUrl } from '../utils/helpers';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onDelete: (id: number) => void;
  onToggleRead: (id: number, currentStatus: boolean) => void;
  onArchive: (id: number, url: string) => void;
  onSaveNotes: (id: number, notes: string) => Promise<void>;
  onUpdate: (id: number, data: Partial<Bookmark>) => Promise<void>;
  filterTag: string | null;
  setFilterTag: (tag: string | null) => void;
  filterFolder: string | null;
  setFilterFolder: (folder: string | null) => void;
  onAddFolder: (bookmarkId: number, folder: string) => void;
  onRemoveFolderFromBookmark: (bookmarkId: number, folder: string) => void;
  onDeleteFolder: (folder: string) => void;
  onViewDetail: (id: number) => void;
  loading: boolean;
  viewMode: ViewMode;
  userEmail?: string;
  onAddClick: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  usePagination?: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({ 
  bookmarks, 
  onDelete, 
  onToggleRead,
  onArchive,
  onSaveNotes,
  onUpdate,
  filterTag, 
  setFilterTag,
  filterFolder, 
  setFilterFolder,
  onAddFolder,
  onRemoveFolderFromBookmark,
  onDeleteFolder,
  onViewDetail,
  loading,
  viewMode,
  onAddClick,
  onRefresh,
  isRefreshing = false,
  usePagination = true,
  currentPage,
  onPageChange
}) => {
  // --- STATE MANAGEMENT ---
  
  // Note Drawer & Inline Editing
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Tags/Folders Drawer
  const [editingTagsFoldersId, setEditingTagsFoldersId] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  
  const itemsPerPage = 20;

  // --- MEMOIZED DATA CALCULATIONS ---

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    bookmarks.flatMap(b => b.tags || []).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => {
        // Sort by count desc, then alpha asc
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });
  }, [bookmarks]);

  const allFolders = useMemo(() => {
    const counts: Record<string, number> = {};
    bookmarks.flatMap(b => b.folders || []).forEach(folder => {
      counts[folder] = (counts[folder] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [bookmarks]);

  // "On this day" Logic
  const oneYearAgoToday = useMemo(() => {
    const now = new Date();
    return bookmarks.filter(b => {
        const d = parseDateSafe(b.created_at);
        if (!d) return false;
        
        return d.getDate() === now.getDate() && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() < now.getFullYear();
    });
  }, [bookmarks]);

  const topTags = allTags.slice(0, 40);
  const unreadCount = bookmarks.filter(b => b.to_read).length;

  // --- PAGINATION ---
  const totalPages = Math.ceil(bookmarks.length / itemsPerPage);
  
  const displayedItems = useMemo(() => {
      if (!usePagination) {
          return bookmarks; 
      }
      const startIndex = (currentPage - 1) * itemsPerPage;
      return bookmarks.slice(startIndex, startIndex + itemsPerPage);
  }, [bookmarks, currentPage, usePagination, itemsPerPage]);

  // --- HANDLERS: GENERAL ---

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`Möchtest du den Link "${title}" wirklich löschen?`)) {
      onDelete(id);
    }
  };

  const handleDeleteFolderWrapper = (folder: string) => {
      if (window.confirm(`Möchtest du den Ordner "${folder}" wirklich löschen?`)) {
          onDeleteFolder(folder);
      }
  };

  const handleRemoveFromFolder = (id: number, folder: string) => {
    if (window.confirm(`Möchtest du dieses Bookmark wirklich aus dem Ordner "${folder}" entfernen?`)) {
        onRemoveFolderFromBookmark(id, folder);
    }
  };

  const handlePageScroll = (newPage: number) => {
      onPageChange(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- HANDLERS: NOTES DRAWER ---

  // Just toggles the view (read-only)
  const handleToggleNoteDrawer = (id: number) => {
      if (expandedNoteId === id) {
          setExpandedNoteId(null);
          setEditingNoteId(null);
          setTempNoteText('');
      } else {
          setExpandedNoteId(id);
          setEditingTagsFoldersId(null); // Close other drawer
          setEditingNoteId(null);
      }
  };

  // Used by the outer "Add Note" button (Toggle behavior)
  const handleStartEditNote = (bm: Bookmark) => {
      if (expandedNoteId === bm.id) {
          // Toggle off if already open
          setExpandedNoteId(null);
          setEditingNoteId(null);
          setTempNoteText('');
      } else {
          // Open
          setExpandedNoteId(bm.id);
          setEditingTagsFoldersId(null); // Close other drawer
          setEditingNoteId(bm.id);
          setTempNoteText(bm.notes || '');
      }
  };

  // Used by the internal "Edit Notes" button (Force Edit, no toggle close)
  const handleSwitchToEditMode = (bm: Bookmark) => {
      setExpandedNoteId(bm.id);
      setEditingTagsFoldersId(null); 
      setEditingNoteId(bm.id);
      setTempNoteText(bm.notes || '');
  };

  const handleSaveNote = async (id: number) => {
      setIsSavingNote(true);
      await onSaveNotes(id, tempNoteText);
      setIsSavingNote(false);
      setEditingNoteId(null);
      // We keep expandedNoteId set so it stays open in read mode
  };

  const handleCancelEditNote = (bm: Bookmark) => {
      // If note was empty to begin with, close the whole drawer
      if (!bm.notes || bm.notes.trim() === '') {
          setExpandedNoteId(null);
          setEditingNoteId(null);
      } else {
          // Otherwise just revert to read-only mode
          setEditingNoteId(null);
      }
      setTempNoteText('');
  };

  // --- HANDLERS: TAGS/FOLDERS DRAWER ---

  const handleToggleTagsFoldersDrawer = (id: number) => {
      if (editingTagsFoldersId === id) {
          setEditingTagsFoldersId(null);
      } else {
          setEditingTagsFoldersId(id);
          setExpandedNoteId(null); // Close note drawer
          setTagInput('');
          setFolderInput('');
      }
  };

  const handleAddTag = async (bm: Bookmark) => {
      const tagToAdd = tagInput.trim().toLowerCase();
      if (!tagToAdd) return;
      
      const currentTags = bm.tags || [];
      if (!currentTags.includes(tagToAdd)) {
          const newTags = [...currentTags, tagToAdd];
          await onUpdate(bm.id, { tags: newTags });
      }
      setTagInput('');
  };

  const handleRemoveTag = async (bm: Bookmark, tagToRemove: string) => {
      const currentTags = bm.tags || [];
      const newTags = currentTags.filter(t => t !== tagToRemove);
      await onUpdate(bm.id, { tags: newTags });
  };

  const handleAddFolderInline = (bmId: number) => {
      const folderToAdd = folderInput.trim();
      if (!folderToAdd) return;
      onAddFolder(bmId, folderToAdd);
      setFolderInput('');
  };

  const handleRemoveFolderInline = (bmId: number, folderToRemove: string) => {
      onRemoveFolderFromBookmark(bmId, folderToRemove);
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin text-yellow-500 text-6xl font-bold" style={{ lineHeight: '0.7' }}>*</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-12">
      <div className="flex-1 min-w-0">
        {/* Active Filters Display */}
        {filterTag && (
          <div className="mb-6 bg-[#f9f9f9] border border-[#ddd] p-3 flex items-center justify-between text-sm shadow-sm">
            <span>Bookmarks tagged with <span className="font-bold text-black px-1.5 py-0.5 bg-[#eee] rounded-sm">"{filterTag}"</span></span>
            <button onClick={() => setFilterTag(null)} className="text-del-blue font-bold text-xs uppercase">remove filter</button>
          </div>
        )}

        {filterFolder && (
          <div className="mb-6 bg-[#f9f9f9] border border-[#ddd] p-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm shadow-sm gap-2">
            <div className="flex items-center gap-2">
                <span className="text-gray-600">Bookmarks in folder</span>
                <span className="font-bold text-white px-2 py-0.5 bg-del-blue rounded-sm flex items-center gap-1">📁 {filterFolder}</span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
                 <button onClick={() => handleDeleteFolderWrapper(filterFolder)} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold uppercase transition-colors" title="Delete this folder completely from all bookmarks">Delete Folder</button>
                <span className="text-gray-300 hidden sm:inline">|</span>
                <button onClick={() => setFilterFolder(null)} className="text-del-blue font-bold text-xs uppercase hover:underline">close view</button>
            </div>
          </div>
        )}

        {/* View Modes */}
        {viewMode === 'tags' ? (
             <div className="mt-4">
                <h3 className="font-bold text-xl mb-6 text-gray-800 border-b border-gray-200 pb-2">All Tags</h3>
                <div className="flex flex-wrap gap-2">
                {allTags.map(([tag, count]) => (
                    <button 
                        key={tag} 
                        onClick={() => setFilterTag(tag)} 
                        className="group border border-[#cccccc] bg-white hover:border-del-blue hover:bg-blue-50 px-2 py-1.5 rounded-sm text-sm transition-all flex items-center gap-2"
                    >
                        <span className="font-bold text-del-blue group-hover:underline">#{tag}</span>
                        <span className="text-gray-400 text-xs font-normal bg-gray-50 px-1.5 rounded-sm group-hover:bg-white group-hover:text-del-blue">{count}</span>
                    </button>
                ))}
                </div>
             </div>
        ) : viewMode === 'folders' ? (
             <div className="mt-4">
                <h3 className="font-bold text-xl mb-6 text-gray-800 border-b border-gray-200 pb-2">Folders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allFolders.length === 0 && <div className="text-gray-400 italic">No folders created yet. Add a bookmark and define a folder name.</div>}
                {allFolders.map(([folder, count]) => (
                    <div key={folder} className="group relative">
                        <button onClick={() => setFilterFolder(folder)} className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 hover:border-del-blue hover:bg-white transition-all text-left">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl opacity-50 group-hover:opacity-100">📁</span>
                                <span className="font-bold text-gray-700 group-hover:text-del-blue">{folder}</span>
                            </div>
                            <span className="bg-white border border-gray-200 text-xs px-2 py-0.5 rounded text-gray-400 group-hover:text-del-blue group-hover:border-del-blue">{count}</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFolderWrapper(folder); }} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-600 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Folder">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                ))}
                </div>
             </div>
        ) : (
            <div className="space-y-6 md:space-y-5">
            {bookmarks.length === 0 && !loading && (
                <div className="p-12 text-gray-400 text-center border-2 border-dashed border-gray-200 italic rounded">
                    Your collection is empty. Add your first link!
                </div>
            )}
            
            {displayedItems.map(bm => {
                const dateStr = formatDate(bm.created_at);
                const hasNotes = bm.notes && bm.notes.trim().length > 0;
                const safeUrl = sanitizeUrl(bm.url);
                const isNoteExpanded = expandedNoteId === bm.id;
                const isEditing = editingNoteId === bm.id;
                const isEditingTagsFolders = editingTagsFoldersId === bm.id;
                
                // Optimized URL parsing
                let hostname = '';
                let fullHostname = '';
                try {
                    const u = new URL(bm.url);
                    fullHostname = u.hostname;
                    hostname = fullHostname.replace('www.', '');
                } catch { /* invalid url */ }

                return (
                <div key={bm.id} className="pb-4 border-b border-[#eeeeee] group flex gap-3">
                    {bm.to_read && <div className="mt-2 w-1.5 h-1.5 bg-del-blue rounded-full flex-shrink-0" title="To Read"></div>}
                    <div className="flex-grow min-w-0">
                        {/* Title Row */}
                        <div className="mb-1 leading-tight">
                            <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="text-[16px] font-bold text-del-blue hover:bg-blue-50 hover:underline px-0.5 -ml-0.5 break-words">
                                {bm.title}
                            </a>
                        </div>
                        
                        {/* Description */}
                        {bm.description && (
                            <div className="text-[#444] text-[13px] mb-2 leading-snug break-words">
                                {bm.description}
                            </div>
                        )}
                        
                        {/* Meta Row */}
                        <div className="flex flex-wrap items-center gap-y-2 gap-x-2 text-xs">
                             <div className="flex items-center gap-1.5">
                                 {fullHostname && (
                                     <img 
                                        src={`https://www.google.com/s2/favicons?domain=${fullHostname}&sz=32`} 
                                        alt="" 
                                        className="w-3 h-3"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                     />
                                 )}
                                 <span className="text-[10px] font-bold text-gray-400">{hostname}</span>
                            </div>
                            <span className="text-gray-300 text-[10px]">|</span>

                            <span className="text-[#999] text-[11px] whitespace-nowrap mr-2">on {dateStr}</span>

                            {/* Tags */}
                            {bm.tags && bm.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mr-2">
                                    {bm.tags.map(tag => (
                                        <button key={tag} onClick={() => setFilterTag(tag)} className={`text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] text-[#666] hover:bg-[#ddd] hover:text-black rounded-sm ${filterTag === tag ? 'bg-yellow-200 text-black' : ''}`}>
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}

                             {/* Folders */}
                             <div className="flex flex-wrap gap-1 mr-2 items-center">
                                {bm.folders && bm.folders.map(folder => (
                                    <div key={folder} className="group/folder flex items-center gap-0 bg-gray-50 border border-transparent hover:border-gray-200 rounded px-1 transition-colors">
                                        <button onClick={() => setFilterFolder(folder)} className="text-[10px] text-gray-500 hover:text-del-blue flex items-center gap-0.5 py-0.5"><span className="opacity-50">📁</span> {folder}</button>
                                        <button onClick={() => handleRemoveFromFolder(bm.id, folder)} className="ml-1 text-[9px] text-gray-300 hover:text-red-500 hover:font-bold opacity-50 group-hover/folder:opacity-100 transition-opacity px-0.5" title={`Remove link from folder "${folder}"`}>x</button>
                                    </div>
                                ))}
                            </div>
                            
                            {bm.archive_url && (
                                 <a href={bm.archive_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 bg-green-50 px-1 border border-green-100 rounded-sm mr-2 hover:underline decoration-green-300 flex items-center gap-1" title="View archived version"><span>🏛️</span> archived</a>
                            )}
                            
                            {/* Notes Indicator */}
                            {hasNotes && (
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleToggleNoteDrawer(bm.id);
                                    }}
                                    className={`text-[10px] px-1.5 border rounded-sm transition-colors ${isNoteExpanded ? 'bg-yellow-100 border-yellow-300 text-yellow-800 font-bold' : 'text-gray-400 bg-yellow-50 border-yellow-100 hover:border-yellow-300 hover:text-yellow-600 cursor-pointer'}`}
                                    title="Click to view notes"
                                >
                                    📝 {isNoteExpanded ? 'hide notes' : 'has notes'}
                                </button>
                            )}
                            
                            {/* Action Buttons (Hover) */}
                            <div className="flex flex-wrap items-center gap-3 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                                <button onClick={() => onToggleRead(bm.id, bm.to_read)} className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase">{bm.to_read ? 'mark read' : 'save later'}</button>
                                <span className="text-gray-200 hidden md:inline">|</span>
                                <button onClick={() => onViewDetail(bm.id)} className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase">permalink</button>
                                {!bm.archive_url && (
                                    <>
                                        <span className="text-gray-200 hidden md:inline">|</span>
                                        <button onClick={() => onArchive(bm.id, bm.url)} className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase" title="Create snapshot on archive.is">Archive Page</button>
                                    </>
                                )}
                                {filterFolder && bm.folders?.includes(filterFolder) && (
                                    <>
                                        <span className="text-gray-200 hidden md:inline">|</span>
                                        <button onClick={() => handleRemoveFromFolder(bm.id, filterFolder)} className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase whitespace-nowrap">remove from folder</button>
                                    </>
                                )}
                                {!hasNotes && (
                                  <>
                                    <span className="text-gray-200 hidden md:inline">|</span>
                                    <button onClick={() => handleStartEditNote(bm)} className={`text-[10px] md:text-[9px] font-bold uppercase ${isEditing ? 'text-black bg-gray-100 px-1 rounded-sm' : 'text-gray-400 hover:text-del-blue'}`}>add note</button>
                                  </>
                                )}
                                <span className="text-gray-200 hidden md:inline">|</span>
                                <button onClick={() => handleToggleTagsFoldersDrawer(bm.id)} className={`text-[10px] md:text-[9px] font-bold uppercase ${isEditingTagsFolders ? 'text-black bg-gray-100 px-1 rounded-sm' : 'text-gray-400 hover:text-del-blue'}`}>edit tags / folders</button>
                                <span className="text-gray-200 hidden md:inline">|</span>
                                <button onClick={() => handleDelete(bm.id, bm.title)} className="text-gray-400 hover:text-red-500 text-[10px] md:text-[9px] font-bold uppercase">delete</button>
                            </div>
                        </div>

                        {/* Note Drawer */}
                        {isNoteExpanded && (
                           <div className="mt-3 bg-[#fffff8] border border-yellow-200 p-4 rounded-sm shadow-sm text-sm">
                               <h4 className="font-bold text-[10px] text-yellow-700 uppercase tracking-widest mb-1">Personal Notes</h4>
                               <div className="border-b border-yellow-100 mb-3"></div>
                               
                               {isEditing ? (
                                   <div className="space-y-3">
                                       <textarea 
                                          value={tempNoteText} 
                                          onChange={(e) => setTempNoteText(e.target.value)} 
                                          className="w-full h-32 p-2 text-sm bg-white border border-yellow-300 outline-none focus:ring-1 focus:ring-yellow-400 font-serif resize-y text-gray-800"
                                          placeholder="Type your notes here..."
                                          autoFocus
                                       />
                                       <div className="flex justify-end gap-2">
                                           <button onClick={() => handleSaveNote(bm.id)} disabled={isSavingNote} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm transition-colors">
                                               {isSavingNote ? 'Saving...' : 'Save Notes'}
                                           </button>
                                           <button onClick={() => handleCancelEditNote(bm)} className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase px-2">
                                               Cancel
                                           </button>
                                       </div>
                                   </div>
                               ) : (
                                   <>
                                        <div className="font-serif text-gray-800 whitespace-pre-wrap leading-relaxed mb-4 pl-1">
                                            {bm.notes}
                                        </div>
                                        <div className="flex justify-end gap-3 border-t border-yellow-100 pt-2">
                                            <button onClick={() => handleSwitchToEditMode(bm)} className="text-[10px] font-bold text-yellow-600 hover:text-yellow-800 uppercase tracking-wide">
                                                Edit Notes
                                            </button>
                                            <button onClick={() => handleToggleNoteDrawer(bm.id)} className="bg-[#fcfcf0] hover:bg-yellow-50 text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase px-2 py-1 rounded-sm">
                                                Close
                                            </button>
                                        </div>
                                   </>
                               )}
                           </div>
                        )}

                        {/* Tags / Folders Editor Drawer */}
                        {isEditingTagsFolders && (
                            <div className="mt-3 bg-gray-50 border border-gray-200 p-4 rounded-sm shadow-sm text-sm">
                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* Folders Column */}
                                    <div className="flex-1">
                                        <h4 className="font-bold text-[10px] text-gray-500 uppercase tracking-widest mb-2">Folders</h4>
                                        <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
                                            {bm.folders && bm.folders.map(folder => (
                                                <span key={folder} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-sm">
                                                    📁 {folder}
                                                    <button onClick={() => handleRemoveFolderInline(bm.id, folder)} className="hover:text-red-600 font-bold ml-1">×</button>
                                                </span>
                                            ))}
                                            {(!bm.folders || bm.folders.length === 0) && <span className="text-[10px] text-gray-400 italic">No folders</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <input 
                                                list={`folder-list-${bm.id}`}
                                                type="text" 
                                                className="border border-gray-300 p-1 text-xs w-full rounded-sm outline-none focus:border-del-blue" 
                                                placeholder="New folder..." 
                                                value={folderInput}
                                                onChange={(e) => setFolderInput(e.target.value)}
                                                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddFolderInline(bm.id); } }}
                                            />
                                            <datalist id={`folder-list-${bm.id}`}>
                                                {allFolders.map(([folderName]) => <option key={folderName} value={folderName} />)}
                                            </datalist>
                                            <button onClick={() => handleAddFolderInline(bm.id)} className="bg-white border border-gray-300 text-gray-600 text-[10px] font-bold px-2 rounded-sm hover:bg-gray-100">ADD</button>
                                        </div>
                                    </div>

                                    {/* Tags Column */}
                                    <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
                                        <h4 className="font-bold text-[10px] text-gray-500 uppercase tracking-widest mb-2">Tags</h4>
                                        <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
                                            {bm.tags && bm.tags.map(tag => (
                                                <span key={tag} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-50 text-del-blue border border-blue-200 rounded-sm">
                                                    {tag}
                                                    <button onClick={() => handleRemoveTag(bm, tag)} className="hover:text-red-600 font-bold ml-1">×</button>
                                                </span>
                                            ))}
                                            {(!bm.tags || bm.tags.length === 0) && <span className="text-[10px] text-gray-400 italic">No tags</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <input 
                                                type="text" 
                                                className="border border-gray-300 p-1 text-xs w-full rounded-sm outline-none focus:border-del-blue" 
                                                placeholder="Add tag..." 
                                                value={tagInput}
                                                onChange={(e) => setTagInput(e.target.value)}
                                                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleAddTag(bm); } }}
                                            />
                                            <button onClick={() => handleAddTag(bm)} className="bg-del-blue text-white border border-del-blue text-[10px] font-bold px-2 rounded-sm hover:bg-del-dark-blue">ADD</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end mt-4 pt-2 border-t border-gray-200">
                                    <button onClick={() => handleToggleTagsFoldersDrawer(bm.id)} className="text-[10px] font-bold text-gray-400 hover:text-gray-600 uppercase px-2 py-1 border border-gray-200 bg-white rounded-sm hover:bg-gray-50">
                                        Close
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                )
            })}
            
            {/* Pagination Controls */}
            {usePagination && totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center gap-2 text-xs">
                    <button onClick={() => handlePageScroll(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-200 bg-gray-50 rounded-sm hover:bg-white hover:text-del-blue disabled:opacity-40 disabled:hover:text-inherit">&laquo; Prev</button>
                    <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)).map((page, index, array) => {
                                const prev = array[index - 1];
                                const showEllipsis = prev && page - prev > 1;
                                return (
                                    <React.Fragment key={page}>
                                        {showEllipsis && <span className="px-1 text-gray-400">...</span>}
                                        <button onClick={() => handlePageScroll(page)} className={`px-3 py-1.5 rounded-sm font-bold ${currentPage === page ? 'bg-del-blue text-white' : 'bg-white border border-gray-200 hover:text-del-blue'}`}>{page}</button>
                                    </React.Fragment>
                                )
                            })}
                    </div>
                    <button onClick={() => handlePageScroll(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-gray-200 bg-gray-50 rounded-sm hover:bg-white hover:text-del-blue disabled:opacity-40 disabled:hover:text-inherit">Next &raquo;</button>
                </div>
            )}
            </div>
        )}
      </div>

      {/* Sidebar / Navigation */}
      <div className="w-full md:w-56 flex-shrink-0 pl-0 md:pl-6 border-l-0 md:border-l border-gray-100 mt-8 md:mt-0">
         <div className="mb-8">
            <h4 className="font-bold text-xs text-white bg-[#86c944] mb-3 uppercase tracking-wide p-2 rounded-sm">Navigation</h4>
            <ul className="space-y-1 text-xs">
                <li><button onClick={onAddClick} className="text-del-blue hover:underline hover:bg-blue-50 block w-full text-left px-1 py-1">+ Add a new bookmark</button></li>
                <li><button onClick={() => { setFilterTag(null); setFilterFolder(null); window.dispatchEvent(new CustomEvent('changeView', {detail: 'unread'})) }} className={`hover:underline block w-full text-left px-1 py-1 ${viewMode === 'unread' ? 'text-black font-bold' : 'text-del-blue'}`}>Unread items ({unreadCount})</button></li>
                {onRefresh && (<li><button onClick={onRefresh} disabled={isRefreshing} className={`block w-full text-left px-1 py-1 hover:underline hover:bg-blue-50 transition-colors ${isRefreshing ? 'text-gray-400 cursor-not-allowed' : 'text-del-blue'}`}>{isRefreshing ? '↻ Syncing...' : '↻ Sync now'}</button></li>)}
            </ul>
         </div>
         {allFolders.length > 0 && (
             <div className="mb-8">
                <h4 className="font-bold text-xs text-white bg-[#86c944] mb-3 uppercase tracking-wide p-2 rounded-sm">Folders</h4>
                <div className="flex flex-col">
                    {allFolders.map(([folder, count]) => (
                        <div key={folder} className="flex justify-between items-center group">
                            <button onClick={() => setFilterFolder(folder)} className={`flex-grow flex justify-between items-center text-xs px-1 py-1 rounded hover:bg-[#f0f0f0] ${filterFolder === folder ? 'font-bold bg-gray-100' : ''}`}><span className="text-del-blue hover:underline text-left truncate w-32">{folder}</span><span className="text-gray-400 text-[10px]">{count}</span></button>
                            <button onClick={() => handleDeleteFolderWrapper(folder)} className="ml-1 text-[10px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1" title="Delete Folder">x</button>
                        </div>
                    ))}
                </div>
             </div>
         )}
         {oneYearAgoToday.length > 0 && (
            <div className="mb-8 p-3 bg-[#fff9c4] border border-[#fbc02d]">
                <h4 className="font-bold text-xs text-[#f57f17] mb-2 uppercase tracking-wide">On this day</h4>
                <ul className="space-y-2">
                    {oneYearAgoToday.map(bm => (
                        <li key={bm.id} className="text-xs leading-tight"><a href={sanitizeUrl(bm.url)} target="_blank" className="text-del-blue font-bold hover:underline">{bm.title}</a></li>
                    ))}
                </ul>
            </div>
         )}
         <div>
            <h4 className="font-bold text-xs text-white bg-[#86c944] mb-3 uppercase tracking-wide p-2 rounded-sm">Popular Tags</h4>
            <div className="flex flex-col">
                {topTags.map(([tag, count]) => (
                    <div key={tag} className="flex justify-between items-center">
                        <button onClick={() => setFilterTag(tag)} className={`flex-grow flex justify-between items-center text-xs px-1 py-1 rounded hover:bg-[#f0f0f0] ${filterTag === tag ? 'font-bold bg-yellow-100' : ''}`}>
                            <span className={`text-del-blue hover:underline text-left truncate w-32 ${filterTag === tag ? 'text-black' : ''}`}>{tag}</span>
                            <span className="text-gray-400 text-[10px]">{count}</span>
                        </button>
                    </div>
                ))}
                <button onClick={() => window.dispatchEvent(new CustomEvent('changeView', {detail: 'tags'}))} className="text-right text-[10px] text-gray-400 mt-2 hover:underline py-1">view all tags &raquo;</button>
            </div>
         </div>
      </div>
    </div>
  );
};