import React, { useState } from 'react';
import { Bookmark } from '../types';
import { formatDate, isNoteBookmark } from '../utils/helpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface BookmarkItemProps {
  bm: Bookmark;
  filterTag: string | null;
  filterFolder: string | null;
  allFolders: [string, number][];
  onViewDetail: (id: number, forceDetail?: boolean) => void;
  onArchive: (id: number, url: string) => void;
  onToggleRead: (id: number, currentStatus: boolean) => void;
  onDelete: (id: number, title: string) => void;
  onAddTag: (bookmarkId: number, tag: string) => void;
  onRemoveTag: (bookmarkId: number, tag: string) => void;
  onAddFolder: (bookmarkId: number, folder: string) => void;
  onRemoveFolderFromBookmark: (bookmarkId: number, folder: string) => void;
  renderTagLink: (tag: string, className: string) => React.ReactNode;
  renderFolderLink: (folder: string, className: string, content: React.ReactNode) => React.ReactNode;
  processWikiLinks: (text: string) => string;
}

export const BookmarkItem: React.FC<BookmarkItemProps> = React.memo(({
  bm,
  filterTag,
  filterFolder,
  allFolders,
  onViewDetail,
  onArchive,
  onToggleRead,
  onDelete,
  onAddTag,
  onRemoveTag,
  onAddFolder,
  onRemoveFolderFromBookmark,
  renderTagLink,
  renderFolderLink,
  processWikiLinks
}) => {
  const [isManaging, setIsManaging] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const dateStr = formatDate(bm.created_at);
  const hasNotes = bm.notes && bm.notes.trim().length > 0;
  let hostname = '';
  try {
      hostname = new URL(bm.url).hostname;
  } catch(e) {}
  const displayDomain = hostname.replace(/^www\./, '');

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim()) {
      const tags = newTagInput.split(' ').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
      tags.forEach(tag => onAddTag(bm.id, tag));
      setNewTagInput('');
    }
  };

  const handleAddFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onAddFolder(bm.id, newFolderName.trim());
      setNewFolderName('');
    }
  };

  const handleSelectFolder = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const folder = e.target.value;
    if (folder === "___CREATE_NEW___") {
        const name = prompt("Name for new folder:");
        if (name && name.trim()) {
            onAddFolder(bm.id, name.trim());
        }
    } else if (folder) {
        onAddFolder(bm.id, folder);
    }
    e.target.value = ""; 
  };

  return (
    <div className="p-3.5 mb-3 border border-[#e5e5e5] rounded-md shadow-sm bg-white md:p-0 md:mb-0 md:bg-transparent md:border-0 md:border-b md:border-[#eeeeee] md:rounded-none md:shadow-none md:pb-4 group flex items-baseline gap-2 relative">
        {/* Read Later Marker */}
        {bm.to_read && (
            <div className="flex-shrink-0 self-baseline mt-1.5">
                <span className="w-2 h-2 rounded-sm bg-del-blue block" title="Unread"></span>
            </div>
        )}

        <div className="flex-grow min-w-0">
            <div className="mb-1 leading-tight flex items-baseline">
                {isNoteBookmark(bm) ? (
                    <div 
                        onClick={() => onViewDetail(bm.id, false)}
                        className="text-[14px] text-gray-800 leading-snug cursor-pointer hover:text-del-blue"
                    >
                        {bm.notes ? (
                            <span className="line-clamp-3 whitespace-pre-wrap text-gray-800">{bm.notes}</span>
                        ) : (
                            <span className="font-bold text-del-blue">📝 {bm.title}</span>
                        )}
                    </div>
                ) : bm.url ? (
                    <a href={bm.url} target="_blank" rel="noopener noreferrer" className="text-[16px] font-bold text-del-blue hover:underline break-words">
                        {bm.title}
                    </a>
                ) : (
                    <a 
                        href={`?id=${bm.id}`} 
                        onClick={(e) => { 
                            e.preventDefault(); 
                            onViewDetail(bm.id, false); 
                        }} 
                        className="text-[16px] font-bold text-del-blue hover:underline break-words cursor-pointer"
                    >
                        📄 {bm.title}
                    </a>
                )}
            </div>
            
            {bm.description && (
                <div className="text-[#444] text-[13px] mb-2 leading-snug break-words">
                    {bm.description}
                </div>
            )}
            
            {/* Source Line with Favicon */}
            {hostname && (
                <div className="flex items-center gap-1.5 mb-2">
                    <img 
                        src={`https://www.google.com/s2/favicons?domain=${hostname}`} 
                        alt="" 
                        className="w-3.5 h-3.5 opacity-60" 
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-[#999] text-xs">{displayDomain}</span>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-y-2 gap-x-2 text-xs">
                <span className="text-[#999] text-[11px] whitespace-nowrap mr-2">on {dateStr}</span>

                {bm.tags && bm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mr-2">
                        {bm.tags.map(tag => renderTagLink(tag, `text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] text-[#666] hover:bg-[#ddd] hover:text-black rounded-sm ${filterTag === tag ? 'bg-yellow-200 text-black' : ''}`))}
                    </div>
                )}

                 <div className="flex flex-wrap gap-1 mr-2 items-center">
                    {bm.folders && bm.folders.map(folder => (
                        <div key={folder} className="group/folder flex items-center gap-0 bg-gray-50 border border-transparent hover:border-gray-200 rounded-sm px-1 transition-colors">
                            {renderFolderLink(folder, "text-[10px] text-gray-500 hover:text-del-blue flex items-center gap-0.5 py-0.5", <><span className="opacity-50">📁</span> {folder}</>)}
                            <button onClick={() => onRemoveFolderFromBookmark(bm.id, folder)} className="ml-1 text-[12px] md:text-[9px] text-gray-400 md:text-gray-300 hover:text-red-500 hover:font-bold opacity-80 md:opacity-50 group-hover/folder:opacity-100 transition-opacity px-1.5 py-1 md:px-0.5 md:py-0" title={`Remove link from folder "${folder}"`}>x</button>
                        </div>
                    ))}
                </div>
                
                {/* Archive displayed BEFORE Notes */}
                {bm.archive_url && (
                     <a href={bm.archive_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-600 bg-green-50 px-1 border border-green-100 rounded-sm mr-2 hover:underline decoration-green-300 flex items-center gap-1" title="View archived version">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        archived
                     </a>
                )}
                
                {hasNotes && (
                    <button 
                        onClick={() => setShowNotes(!showNotes)}
                        className={`text-[10px] px-1.5 py-0.5 border rounded-sm mr-2 transition-colors flex items-center gap-1 ${
                            showNotes
                            ? 'bg-[#fffce6] border-[#eedc82] text-[#8a6d3b] font-bold'
                            : 'text-gray-400 bg-yellow-50 border-yellow-100 hover:bg-[#fffce6] hover:text-[#8a6d3b] hover:border-[#eedc82] cursor-pointer'
                        }`}
                    >
                        📝 {showNotes ? 'Hide notes' : 'View notes'}
                    </button>
                )}

                <div className="flex flex-wrap items-center gap-2 md:gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-auto md:ml-0 pt-2 md:pt-0 w-full md:w-auto border-t md:border-t-0 mt-2 md:mt-0">
                    <button 
                        onClick={() => setIsManaging(!isManaging)}
                        className={`text-[10px] md:text-[9px] font-bold uppercase cursor-pointer ${isManaging ? 'text-black bg-gray-100 px-1 rounded-sm' : 'text-gray-400 hover:text-del-blue'}`}
                    >
                        {isManaging ? 'Close' : 'edit tags/folder'}
                    </button>
                    <span className="text-gray-200 hidden md:inline">|</span>
                    <button 
                        onClick={() => onToggleRead(bm.id, bm.to_read || false)} 
                        className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase cursor-pointer"
                    >
                        {bm.to_read ? 'mark read' : 'save later'}
                    </button>
                    <span className="text-gray-200 hidden md:inline">|</span>
                    <a 
                        href={`?id=${bm.id}`}
                        onClick={(e) => { 
                            e.preventDefault(); 
                            onViewDetail(bm.id, true); 
                        }}
                        className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase cursor-pointer decoration-0"
                    >
                        edit
                    </a>
                    {!bm.archive_url && (
                        <>
                            <span className="text-gray-200 hidden md:inline">|</span>
                            <button 
                                onClick={() => onArchive(bm.id, bm.url)} 
                                className="text-gray-400 hover:text-del-blue text-[10px] md:text-[9px] font-bold uppercase cursor-pointer"
                            >
                                archive
                            </button>
                        </>
                    )}
                    <span className="text-gray-200 hidden md:inline">|</span>
                    <button 
                        onClick={() => onDelete(bm.id, bm.title)} 
                        className="text-red-300 hover:text-red-500 text-[10px] md:text-[9px] font-bold uppercase cursor-pointer"
                    >
                        delete
                    </button>
                </div>
            </div>
            
            {showNotes && (
                <div className="mt-3 mb-2 p-3 bg-[#fffce6] border border-[#eedc82] rounded-sm text-sm text-[#555] leading-relaxed relative">
                     <button onClick={() => setShowNotes(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">×</button>
                     <div className="markdown-body prose prose-sm max-w-none text-[#555]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {processWikiLinks(bm.notes || '')}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {isManaging && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-sm shadow-inner text-sm animate-in fade-in slide-in-from-top-1 duration-150 relative">
                     <button onClick={() => setIsManaging(false)} className="absolute top-1 right-2 text-gray-400 hover:text-gray-700 font-bold" title="Close edit mode">×</button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Folders Management */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Folder Management</div>
                            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[26px]">
                                {bm.folders && bm.folders.length > 0 ? bm.folders.map(f => (
                                    <span key={f} className="inline-flex items-center text-[11px] bg-[#fffce6] border border-[#eedc82] text-[#8a6d3b] px-1.5 py-0.5 rounded-sm group/chip font-arial cursor-default">
                                        <span className="opacity-50 mr-1.5">📁</span> 
                                        <span className="font-bold">{f}</span>
                                        <button onClick={() => onRemoveFolderFromBookmark(bm.id, f)} className="ml-2 w-3 h-3 rounded-sm hover:bg-[#eedc82] hover:text-[#8a6d3b] flex items-center justify-center transition-colors" title="Remove from folder">×</button>
                                    </span>
                                )) : (
                                    <span className="text-gray-400 text-xs italic py-0.5">Not in any folder.</span>
                                )}
                            </div>
                            
                            <div className="space-y-2">
                                <select 
                                    onChange={handleSelectFolder}
                                    defaultValue=""
                                    className="w-full border border-[#ccc] p-1.5 text-xs outline-none bg-white focus:border-del-blue rounded-sm"
                                >
                                    <option value="" disabled>Select existing folder...</option>
                                    {allFolders.filter(([f]) => !bm.folders?.includes(f)).map(([f]) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                    <option value="___CREATE_NEW___" className="font-bold text-del-blue">+ Create New Folder</option>
                                </select>
                                
                                <form onSubmit={handleAddFolderSubmit} className="flex gap-1">
                                    <input 
                                        type="text" 
                                        placeholder="Or type new folder name..." 
                                        className="flex-grow border border-[#ccc] px-2 py-1 text-xs outline-none focus:border-del-blue rounded-sm"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                    />
                                    <button type="submit" disabled={!newFolderName.trim()} className="bg-[#f0f0f0] border border-[#ccc] text-gray-600 hover:text-black hover:border-[#999] text-[10px] font-bold uppercase px-3 py-1 rounded-sm transition-colors disabled:opacity-50">
                                        Add
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Tags Management */}
                        <div>
                             <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Tags Management</div>
                             <div className="flex flex-wrap gap-1.5 mb-3 min-h-[26px]">
                                {bm.tags && bm.tags.length > 0 ? bm.tags.map(t => (
                                    <span key={t} className="inline-flex items-center text-[11px] bg-[#e6f2ff] border border-[#b3d9ff] text-[#3274D1] px-1.5 py-0.5 rounded-sm group/chip font-arial cursor-default">
                                        <span className="font-medium">{t}</span>
                                        <button onClick={() => onRemoveTag(bm.id, t)} className="ml-2 w-3 h-3 rounded-sm hover:bg-[#3274D1] hover:text-white flex items-center justify-center text-[#8ab9ff] transition-colors" title="Remove">×</button>
                                    </span>
                                )) : (
                                    <span className="text-gray-400 text-xs italic py-0.5">No tags added.</span>
                                )}
                            </div>
                            
                            <form onSubmit={handleAddTagSubmit} className="flex gap-1">
                                <input 
                                    type="text" 
                                    placeholder="Add tags (space separated)..." 
                                    className="flex-grow border border-[#ccc] px-2 py-1 text-xs outline-none focus:border-del-blue rounded-sm font-mono"
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value.toLowerCase())}
                                />
                                <button type="submit" disabled={!newTagInput.trim()} className="bg-[#f0f0f0] border border-[#ccc] text-gray-600 hover:text-black hover:border-[#999] text-[10px] font-bold uppercase px-3 py-1 rounded-sm transition-colors disabled:opacity-50">
                                    Add
                                </button>
                            </form>
                             <div className="mt-1.5 text-[10px] text-gray-400 flex items-center justify-between">
                                <span>Separate multiple tags with space</span>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
});

BookmarkItem.displayName = 'BookmarkItem';
