import React, { useMemo, useState, useEffect } from 'react';
import { Bookmark, ViewMode } from '../types';
import { formatDate, parseDateSafe, parseTags, isWikiBookmark, isNoteBookmark } from '../utils/helpers';
import { ConfirmModal } from './ConfirmModal';
import { BookmarkItem } from './BookmarkItem';

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
  onAddTag: (bookmarkId: number, tag: string) => void;
  onRemoveTag: (bookmarkId: number, tag: string) => void;
  onViewDetail: (id: number, forceDetail?: boolean) => void;
  loading: boolean;
  viewMode: ViewMode;
  userEmail?: string;
  onAddClick: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  usePagination?: boolean;
  resetTrigger?: number;
  kmFeatures?: { wiki: boolean; ai: boolean };
  enabledTabs?: import('./Layout').EnabledTabsConfig;
  allBookmarks?: Bookmark[];
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const processWikiLinks = (text: string) => {
    if (!text) return '';
    return text.replace(/\[\[(.*?)\]\]/g, '[$1](/?q=$1)');
};

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
  onAddTag,
  onRemoveTag,
  onViewDetail,
  loading,
  viewMode,
  userEmail,
  onAddClick,
  onRefresh,
  isRefreshing = false,
  usePagination = true,
  resetTrigger = 0,
  kmFeatures = { wiki: true, ai: true },
  enabledTabs,
  allBookmarks
}) => {
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [sidebarTagMode, setSidebarTagMode] = useState<'cloud' | 'list'>('cloud');

  // Custom in-app Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [bookmarks.length, filterTag, filterFolder, viewMode, resetTrigger]);
  
  const sourceBookmarks = allBookmarks || bookmarks;

  const allFolders = useMemo(() => {
    const counts: Record<string, number> = {};
    sourceBookmarks.flatMap(b => b.folders || []).forEach(folder => {
      counts[folder] = (counts[folder] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sourceBookmarks]);

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    sourceBookmarks.flatMap(b => b.tags || []).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });
  }, [sourceBookmarks]);

  const maxTagCount = allTags.length > 0 ? allTags[0][1] : 1;

  const untaggedCount = useMemo(() => {
    return sourceBookmarks.filter(b => !b.tags || b.tags.length === 0).length;
  }, [sourceBookmarks]);

  const topTags = allTags.slice(0, 40);
  const unreadCount = sourceBookmarks.filter(b => b.to_read).length;

  const totalPages = Math.ceil(bookmarks.length / itemsPerPage);
  
  const displayedItems = useMemo(() => {
      if (!usePagination) {
          return bookmarks; 
      }
      const startIndex = (currentPage - 1) * itemsPerPage;
      return bookmarks.slice(startIndex, startIndex + itemsPerPage);
  }, [bookmarks, currentPage, usePagination]);

  const handleDelete = (id: number, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Bookmark löschen',
      message: `Möchtest du den Link "${title}" wirklich unwiderruflich löschen?`,
      onConfirm: () => {
        onDelete(id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

    const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveFromFolder = (id: number, folder: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Aus Ordner entfernen',
      message: `Möchtest du dieses Bookmark wirklich aus dem Ordner "${folder}" entfernen?`,
      onConfirm: () => {
        onRemoveFolderFromBookmark(id, folder);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

const renderTagLink = (tag: string, className: string, style?: React.CSSProperties) => (
      <a 
          key={tag} 
          href={`?tag=${encodeURIComponent(tag)}`}
          onClick={(e) => { e.preventDefault(); setFilterTag(tag); }}
          className={className}
          style={style}
      >
          {tag}
      </a>
  );

  const renderFolderLink = (folder: string, className: string, content: React.ReactNode) => (
      <a
          key={folder}
          href={`?folder=${encodeURIComponent(folder)}`}
          onClick={(e) => { e.preventDefault(); setFilterFolder(folder); }}
          className={className}
      >
          {content}
      </a>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin text-del-blue text-6xl font-bold" style={{ lineHeight: '0.7' }}>*</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-12">
      <div className="flex-1 min-w-0">
        {filterTag && (
          <div className="mb-6 bg-[#f9f9f9] border border-[#ddd] p-3 flex items-center justify-between text-sm shadow-sm rounded-sm">
            <span>
              {filterTag === '___WITHOUT_TAG___' || filterTag.toLowerCase() === 'without tag' || filterTag.toLowerCase() === 'without-tag' ? (
                <>Bookmarks <span className="font-bold text-black px-1.5 py-0.5 bg-[#eee] rounded-sm">without tag</span></>
              ) : (
                <>Bookmarks tagged with <span className="font-bold text-black px-1.5 py-0.5 bg-[#eee] rounded-sm">"{filterTag}"</span></>
              )}
            </span>
            <button onClick={() => setFilterTag(null)} className="text-del-blue font-bold text-xs uppercase hover:underline">remove filter</button>
          </div>
        )}

        {filterFolder && (
          <div className="mb-6 bg-[#f9f9f9] border border-[#ddd] p-3 flex flex-col sm:flex-row sm:items-center justify-between text-sm shadow-sm gap-2 rounded-sm">
            <div className="flex items-center gap-2">
                <span className="text-gray-600">Bookmarks in folder</span>
                <span className="font-bold text-white px-2 py-0.5 bg-del-blue rounded-sm flex items-center gap-1">📁 {filterFolder}</span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
                 <button onClick={() => onDeleteFolder(filterFolder)} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-sm text-xs font-bold uppercase transition-colors" title="Delete this folder completely from all bookmarks">Delete Folder</button>
                <span className="text-gray-300 hidden sm:inline">|</span>
                <button onClick={() => setFilterFolder(null)} className="text-del-blue font-bold text-xs uppercase hover:underline">close view</button>
            </div>
          </div>
        )}

        {viewMode === 'tags' ? (
             <div className="mt-4">
                <h3 className="font-bold text-xl mb-6 text-gray-800 border-b border-gray-200 pb-2 flex justify-between items-center">
                  <span>Tag Cloud</span>
                  <span className="text-xs text-gray-400 font-normal">{allTags.length} Tags</span>
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-4 items-baseline mb-8">
                {allTags.map(([tag, count]) => {
                    const size = 12 + (count / maxTagCount) * 18;
                    return renderTagLink(tag, "tag-cloud-item text-del-blue transition-colors", { fontSize: `${size}px` });
                })}
                </div>
                {untaggedCount > 0 && (
                  <div className="pt-4 border-t border-gray-200 flex items-center gap-2">
                    <a
                      href="?tag=___WITHOUT_TAG___"
                      onClick={(e) => { e.preventDefault(); setFilterTag('___WITHOUT_TAG___'); }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-300 hover:border-del-blue text-xs rounded-sm text-gray-700 hover:text-del-blue transition-colors"
                      title="Alle Lesezeichen ohne Tags anzeigen"
                    >
                      <span className="italic font-medium">Without Tag</span>
                      <span className="bg-white px-1.5 py-0.5 border border-gray-200 text-[10px] rounded font-mono text-gray-500">{untaggedCount}</span>
                    </a>
                  </div>
                )}
             </div>
        ) : viewMode === 'folders' ? (
             <div className="mt-4">
                <h3 className="font-bold text-xl mb-6 text-gray-800 border-b border-gray-200 pb-2">Folders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allFolders.length === 0 && <div className="text-gray-400 italic">No folders created yet. Add a bookmark and define a folder name.</div>}
                {allFolders.map(([folder, count]) => (
                    <div key={folder} className="group relative">
                        {renderFolderLink(folder, "w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 hover:border-del-blue hover:bg-white transition-all text-left rounded-sm", (
                            <>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl opacity-50 group-hover:opacity-100">📁</span>
                                <span className="font-bold text-gray-700 group-hover:text-del-blue">{folder}</span>
                            </div>
                            <span className="bg-white border border-gray-200 text-xs px-2 py-0.5 rounded-sm text-gray-400 group-hover:text-del-blue group-hover:border-del-blue">{count}</span>
                            </>
                        ))}
                        <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder); }} className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-600 bg-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Folder">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                ))}
                </div>
             </div>
        ) : (
            <div className="space-y-6 md:space-y-5">
            {bookmarks.length === 0 && !loading && (
                <div className="p-12 text-gray-400 text-center border-2 border-dashed border-gray-200 italic rounded-sm">
                    Your collection is empty. Add your first link!
                </div>
            )}
            
            {displayedItems.map(bm => (
                <BookmarkItem 
                    key={bm.id}
                    bm={bm}
                    filterTag={filterTag}
                    filterFolder={filterFolder}
                    allFolders={allFolders}
                    onViewDetail={onViewDetail}
                    onArchive={onArchive}
                    onToggleRead={onToggleRead}
                    onDelete={handleDelete}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                    onAddFolder={onAddFolder}
                    onRemoveFolderFromBookmark={handleRemoveFromFolder}
                    renderTagLink={renderTagLink}
                    renderFolderLink={renderFolderLink}
                    processWikiLinks={processWikiLinks}
                />
            ))}
            
            {usePagination && totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center gap-2 text-xs">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-200 bg-gray-50 rounded-sm hover:bg-white hover:text-del-blue disabled:opacity-40 disabled:hover:text-inherit">&laquo; Prev</button>
                    <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)).map((page, index, array) => {
                                const prev = array[index - 1];
                                const showEllipsis = prev && page - prev > 1;
                                return (
                                    <React.Fragment key={page}>
                                        {showEllipsis && <span className="px-1 text-gray-400">...</span>}
                                        <button onClick={() => handlePageChange(page)} className={`px-3 py-1.5 rounded-sm font-bold ${currentPage === page ? 'bg-del-blue text-white' : 'bg-white border border-gray-200 hover:text-del-blue'}`}>{page}</button>
                                    </React.Fragment>
                                )
                            })}
                    </div>
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-gray-200 bg-gray-50 rounded-sm hover:bg-white hover:text-del-blue disabled:opacity-40 disabled:hover:text-inherit">Next &raquo;</button>
                </div>
            )}
            </div>
        )}
      </div>
      <div className="w-full md:w-56 flex-shrink-0 pl-0 md:pl-6 border-l-0 md:border-l border-[#E5E5E5] mt-8 md:mt-0">
         <div className="mb-6">
            <h4 className="font-bold text-xs text-white bg-[#86C944] px-2.5 py-1 uppercase tracking-wide rounded-t-sm">Navigation</h4>
            <ul className="space-y-0.5 text-xs p-2 bg-[#F9F9F9] border border-t-0 border-[#E5E5E5] rounded-b-sm">
                <li><a href="?view=add" onClick={(e) => { e.preventDefault(); onAddClick(); }} className="text-del-blue hover:underline hover:bg-white block w-full text-left px-1.5 py-1 rounded-sm">+ Add a new bookmark</a></li>
                <li><a href="?view=unread" onClick={(e) => { e.preventDefault(); setFilterTag(null); setFilterFolder(null); window.dispatchEvent(new CustomEvent('changeView', {detail: 'unread'})) }} className={`hover:underline block w-full text-left px-1.5 py-1 rounded-sm ${viewMode === 'unread' ? 'text-black font-bold bg-white' : 'text-del-blue'}`}>Unread items ({unreadCount})</a></li>
                {onRefresh && (<li><button onClick={onRefresh} disabled={isRefreshing} className={`block w-full text-left px-1.5 py-1 rounded-sm hover:underline hover:bg-white transition-colors ${isRefreshing ? 'text-gray-400 cursor-not-allowed' : 'text-del-blue'}`}>{isRefreshing ? '↻ Syncing...' : '↻ Sync now'}</button></li>)}
            </ul>
         </div>
         {allFolders.length > 0 && (
             <div className="mb-6">
                <h4 className="font-bold text-xs text-white bg-[#86C944] px-2.5 py-1 uppercase tracking-wide rounded-t-sm">Folders</h4>
                <div className="flex flex-col p-2 bg-[#F9F9F9] border border-t-0 border-[#E5E5E5] rounded-b-sm">
                    {allFolders.map(([folder, count]) => (
                        <div key={folder} className="flex justify-between items-center group">
                             {renderFolderLink(folder, `flex-grow flex justify-between items-center text-xs px-1.5 py-1 rounded-sm hover:bg-white ${filterFolder === folder ? 'font-bold bg-white text-black' : ''}`, <><span className="text-del-blue hover:underline text-left truncate w-32">{folder}</span><span className="text-gray-400 text-[10px]">{count}</span></>)}
                            <button 
                                onClick={() => {
                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'Ordner löschen',
                                        message: `Möchtest du den Ordner "${folder}" wirklich löschen? Die enthaltenen Bookmarks bleiben erhalten.`,
                                        onConfirm: () => {
                                            onDeleteFolder(folder);
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                        }
                                    });
                                }} 
                                className="ml-1 text-[10px] text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1 cursor-pointer" 
                                title="Delete Folder"
                            >
                                x
                            </button>
                        </div>
                    ))}
                </div>
             </div>
         )}
         <div>
            <div className="flex justify-between items-center bg-[#86C944] px-2.5 py-1 rounded-t-sm">
                <h4 className="font-bold text-xs text-white uppercase tracking-wide">Popular Tags</h4>
                <div className="text-[10px] text-white/90 flex items-center gap-1 font-mono">
                    <button 
                        onClick={() => setSidebarTagMode('cloud')} 
                        className={`hover:underline cursor-pointer ${sidebarTagMode === 'cloud' ? 'font-bold underline text-white' : 'opacity-70'}`}
                    >
                        cloud
                    </button>
                    <span>|</span>
                    <button 
                        onClick={() => setSidebarTagMode('list')} 
                        className={`hover:underline cursor-pointer ${sidebarTagMode === 'list' ? 'font-bold underline text-white' : 'opacity-70'}`}
                    >
                        list
                    </button>
                </div>
            </div>
            <div className="p-2 bg-[#F9F9F9] border border-t-0 border-[#E5E5E5] rounded-b-sm">
                {sidebarTagMode === 'cloud' ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-1.5 items-baseline py-1">
                        {topTags.map(([tag, count]) => {
                            const size = 11 + Math.min(6, (count / maxTagCount) * 6);
                            return (
                                <a
                                    key={tag}
                                    href={`?tag=${encodeURIComponent(tag)}`}
                                    onClick={(e) => { e.preventDefault(); setFilterTag(tag); }}
                                    style={{ fontSize: `${size}px` }}
                                    className={`text-del-blue hover:underline transition-colors ${filterTag === tag ? 'font-bold text-black bg-yellow-200 px-1 rounded-sm' : ''}`}
                                    title={`${tag} (${count})`}
                                >
                                    {tag}
                                </a>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {topTags.map(([tag, count]) => (
                             <a 
                                key={tag} 
                                href={`?tag=${encodeURIComponent(tag)}`}
                                onClick={(e) => { e.preventDefault(); setFilterTag(tag); }}
                                className={`flex justify-between items-center text-xs px-1.5 py-1 rounded-sm hover:bg-white w-full mb-0.5 ${filterTag === tag ? 'font-bold text-black bg-yellow-100' : ''}`}
                            >
                                <span className={`text-del-blue hover:underline text-left truncate ${filterTag === tag ? 'text-black' : ''}`}>{tag}</span>
                                <span className="text-gray-400 text-[10px]">{count}</span>
                            </a>
                        ))}
                    </div>
                )}

                {untaggedCount > 0 && (
                     <a 
                        href="?tag=___WITHOUT_TAG___"
                        onClick={(e) => { e.preventDefault(); setFilterTag('___WITHOUT_TAG___'); }}
                        className={`flex justify-between items-center text-xs px-1.5 py-1 rounded-sm hover:bg-white w-full border-t border-gray-200 mt-2 pt-1.5 ${filterTag === '___WITHOUT_TAG___' ? 'font-bold text-black bg-yellow-100' : ''}`}
                        title="Bookmarks without tags"
                    >
                        <span className={`text-gray-600 italic hover:underline hover:text-del-blue text-left truncate ${filterTag === '___WITHOUT_TAG___' ? 'text-black font-bold not-italic' : ''}`}>
                            Without Tag
                        </span>
                        <span className="text-gray-400 text-[10px] font-mono">{untaggedCount}</span>
                    </a>
                )}

                <a href="?view=tags" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('changeView', {detail: 'tags'})) }} className="text-right text-[10px] text-gray-400 mt-2 hover:underline py-1 block">view all tags &raquo;</a>
            </div>
         </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};