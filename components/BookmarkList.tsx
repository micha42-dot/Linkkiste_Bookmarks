import React, { useMemo } from 'react';
import { Bookmark, ViewMode } from '../types';
import { formatDate, parseDateSafe } from '../utils/helpers';

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onDelete: (id: number) => void;
  onToggleRead: (id: number, currentStatus: boolean) => void;
  onArchive: (id: number, url: string) => void;
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
  // Props for lifted state pagination
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({ 
  bookmarks, 
  onDelete, 
  onToggleRead,
  onArchive,
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
  userEmail,
  onAddClick,
  onRefresh,
  isRefreshing = false,
  usePagination = true,
  currentPage,
  onPageChange
}) => {
  const [addingFolderToId, setAddingFolderToId] = React.useState<number | null>(null);
  const [newFolderName, setNewFolderName] = React.useState('');
  
  const itemsPerPage = 20;

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    bookmarks.flatMap(b => b.tags || []).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => {
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

  const maxTagCount = allTags.length > 0 ? allTags[0][1] : 1;

  // "Heute vor einem Jahr" Logic - Safari Safe via parseDateSafe
  const oneYearAgoToday = useMemo(() => {
    const now = new Date();
    return bookmarks.filter(b => {
        const d = parseDateSafe(b.created_at);
        if (!d) return false;
        
        // Match day and month, but from any previous year
        return d.getDate() === now.getDate() && 
               d.getMonth() === now.getMonth() && 
               d.getFullYear() < now.getFullYear();
    });
  }, [bookmarks]);

  const topTags = allTags.slice(0, 40);
  const unreadCount = bookmarks.filter(b => b.to_read).length;

  // PAGINATION LOGIC
  const totalPages = Math.ceil(bookmarks.length / itemsPerPage);
  
  // Decide which items to show based on settings
  const displayedItems = useMemo(() => {
      if (!usePagination) {
          return bookmarks; // Show all (endless list)
      }
      const startIndex = (currentPage - 1) * itemsPerPage;
      return bookmarks.slice(startIndex, startIndex + itemsPerPage);
  }, [bookmarks, currentPage, usePagination]);

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`Möchtest du den Link "${title}" wirklich löschen?`)) {
      onDelete(id);
    }
  };

  const handleDeleteFolderWrapper = (folder: string) => {
      if (window.confirm(`Möchtest du den Ordner "${folder}" wirklich löschen? Die Bookmarks bleiben erhalten, aber die Verknüpfung zu diesem Ordner wird entfernt.`)) {
          onDeleteFolder(folder);
      }
  };

  const handleRemoveFromFolder = (id: number, folder: string) => {
    if (window.confirm(`Möchtest du dieses Bookmark wirklich aus dem Ordner "${folder}" entfernen?`)) {
        onRemoveFolderFromBookmark(id, folder);
    }
  };

  const handleStartAddFolder = (id: number) => {
      setAddingFolderToId(id);
      setNewFolderName('');
  };

  const submitAddFolder = (e: React.FormEvent) => {
      e.preventDefault();
      if (addingFolderToId && newFolderName.trim()) {
          onAddFolder(addingFolderToId, newFolderName.trim());
          setAddingFolderToId(null);
          setNewFolderName('');
      }
  };

  const handlePageScroll = (newPage: number) => {
      onPageChange(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
                
                // Extract hostname for display and favicon
                const hostname = (() => {
                    try {
                        return new URL(bm.url).hostname.replace('www.', '');
                    } catch {
                        return '';
                    }
                })();
                
                // Get full hostname for favicon service to be accurate
                const fullHostname = (() => {
                    try {
                        return new URL(bm.url).hostname;
                    } catch {
                        return '';
                    }
                })();

                return (
                <div key={bm.id} className="pb-4 border-b border-[#eeeeee] group flex gap-3">
                    {bm.to_read && <div className="mt-2 w-1.5 h-1.5 bg-del-blue rounded-full flex-shrink-0" title="To Read"></div>}
                    <div className="flex-grow min-w-0">
                        <div className="mb-1 leading-tight">
                            <a href={bm.url} target="_blank" rel="noopener noreferrer" className="text-[16px] font-bold text-del-blue hover:bg-blue-50 hover:underline px-0.5 -ml-0.5 break-words">
                                {bm.title}
                            </a>
                        </div>
                        
                        {bm.description && (
                            <div className="text-[#444] text-[13px] mb-2 leading-snug break-words">
                                {bm.description}
                            </div>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-y-2 gap-x-2 text-xs">
                             {/* Source info (Icon + Domain) followed by pipe */}
                             <div className="flex items-center gap-1.5">
                                 <img 
                                    src={`https://www.google.com/s2/favicons?domain=${fullHostname}&sz=32`} 
                                    alt="" 
                                    className="w-3 h-3"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                 />
                                 <span className="text-[10px] font-bold text-gray-400">{hostname}</span>
                            </div>
                            <span className="text-gray-300 text-[10px]">|</span>

                            <span className="text-[#999] text-[11px] whitespace-nowrap mr-2">on {dateStr}</span>

                            {bm.tags && bm.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mr-2">
                                    {bm.tags.map(tag => (
                                        <button key={tag} onClick={() => setFilterTag(tag)} className={`text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] text-[#666] hover:bg-[#ddd] hover:text-black rounded-sm ${filterTag === tag ? 'bg-yellow-200 text-black' : ''}`}>
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}

                             <div className="flex flex-wrap gap-1 mr-2 items-center">
                                {bm.folders && bm.folders.map(folder => (
                                    <div key={folder} className="group/folder flex items-center gap-0 bg-gray-50 border border-transparent hover:border-gray-200 rounded px-1 transition-colors">
                                        <button onClick={() => setFilterFolder(folder)} className="text-[10px] text-gray-500 hover:text-del-blue flex items-center gap-0.5 py-0.5"><span className="opacity-50">📁</span> {folder}</button>
                                        <button onClick={() => handleRemoveFromFolder(bm.id, folder)} className="ml-1 text-[9px] text-gray-300 hover:text-red-500 hover:font-bold opacity-50 group-hover/folder:opacity-100 transition-opacity px-0.5" title={`Remove link from folder "${folder}"`}>x</button>
                                    </div>
                                ))}
                                
                                {addingFolderToId === bm.id && (
                                    <form onSubmit={submitAddFolder} className="flex items-center gap-1">
                                        <input type="text" autoFocus className="text-[10px] border border-del-blue px-1 py-0.5 w-20 outline-none" placeholder="Folder name" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onBlur={() => !newFolderName && setAddingFolderToId(null)} />
                                        <button type="submit" className="text-[9px] bg-del-blue text-white px-1.5 py-0.5 rounded-sm">ok</button>
                                        <button type="button" onClick={() => setAddingFolderToId(null)} className="text-[9px] text-gray-400 px-1">x</button>
                                    </form>
                                )}
                            </div>
                            
                            {bm.archive_url && (
                                 <a href={bm.archive_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 bg-green-50 px-1 border border-green-100 rounded-sm mr-2 hover:underline decoration-green-300 flex items-center gap-1" title="View archived version"><span>🏛️</span> archived</a>
                            )}
                            {hasNotes && <span className="text-[10px] text-gray-400 bg-yellow-50 px-1 border border-yellow-100 rounded-sm">📝 has notes</span>}
                            
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
                                <span className="text-gray-200 hidden md:inline">|</span>
                                <button onClick={() => handleStartAddFolder(bm.id)} className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase">add to folder</button>
                                <span className="text-gray-200 hidden md:inline">|</span>
                                <button onClick={() => handleDelete(bm.id, bm.title)} className="text-gray-400 hover:text-red-500 text-[10px] md:text-[9px] font-bold uppercase">delete</button>
                            </div>
                        </div>
                    </div>
                </div>
                )
            })}
            
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
                        <li key={bm.id} className="text-xs leading-tight"><a href={bm.url} target="_blank" className="text-del-blue font-bold hover:underline">{bm.title}</a></li>
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