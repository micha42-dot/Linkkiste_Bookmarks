import React, { useState, useEffect } from 'react';
import { NewBookmark } from '../types';

interface AddBookmarkProps {
  onSave: (bookmark: NewBookmark) => Promise<void>;
  onCancel: () => void;
  initialUrl?: string;
  initialTitle?: string;
  allFolders?: string[];
  isPopup?: boolean;
}

export const AddBookmark: React.FC<AddBookmarkProps> = ({ 
    onSave, 
    onCancel, 
    initialUrl, 
    initialTitle,
    allFolders = [], 
    isPopup = false 
}) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [folders, setFolders] = useState('');
  const [toRead, setToRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  
  // Folder Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderTemp, setNewFolderTemp] = useState('');

  useEffect(() => {
    if (initialUrl && !url) setUrl(initialUrl);
    if (initialTitle && (!title || title === url)) setTitle(initialTitle);
  }, [initialUrl, initialTitle]);

  const handleAutoFill = async () => {
    if (!url) return;
    
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
        setUrl(targetUrl);
    }

    setFetchingMeta(true);
    try {
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(targetUrl)}`);
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            const { title: metaTitle, description: metaDesc } = data.data;
            if (metaTitle && (!title || title === initialUrl)) setTitle(metaTitle);
            if (metaDesc && !description) setDescription(metaDesc);
        }
    } catch (error) {
        console.error("Failed to fetch metadata", error);
    } finally {
        setFetchingMeta(false);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (!val) return;
      
      if (val === '___CREATE_NEW___') {
          setIsCreatingFolder(true);
          // Don't modify folders yet
      } else {
          // Append existing
          if (!folders.trim()) {
              setFolders(val);
          } else {
              const current = folders.split(',').map(f => f.trim());
              if (!current.includes(val)) {
                  setFolders(folders + ', ' + val);
              }
          }
      }
      e.target.value = ''; // Reset select
  };

  const confirmNewFolder = () => {
      const val = newFolderTemp.trim();
      if (val) {
          if (!folders.trim()) {
              setFolders(val);
          } else {
              const current = folders.split(',').map(f => f.trim());
              if (!current.includes(val)) {
                  setFolders(folders + ', ' + val);
              }
          }
      }
      setNewFolderTemp('');
      setIsCreatingFolder(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    
    const tagArray = tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const folderArray = folders
      .split(/[,;]+/)
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const finalTitle = title.trim() || url;

    await onSave({
      url: url.trim(),
      title: finalTitle,
      description,
      tags: tagArray,
      folders: folderArray,
      to_read: toRead
    });
    
    setLoading(false);
  };

  const previewTags = tags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  return (
    <div className={`w-full ${isPopup ? '' : 'max-w-xl'}`}>
      
      {!isPopup && (
          <h2 className="text-lg font-bold mb-4 text-black border-b border-gray-200 pb-2">
            Add a new bookmark
          </h2>
      )}

      {isPopup && (
          <div className="mb-4 flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                 <div className="w-4 h-4 bg-del-blue rounded-sm"></div>
                 <h2 className="text-sm font-bold text-gray-800">New Bookmark</h2>
              </div>
              {loading && <span className="text-xs text-gray-400 font-medium">Saving...</span>}
          </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* URL Field - Less prominent in Popup as it's autofilled */}
        <div className="relative">
             {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-600">URL</label>}
             <div className="flex">
                <input
                    type="url"
                    required
                    className={`flex-grow border border-gray-300 p-2 focus:border-del-blue focus:ring-1 focus:ring-del-blue outline-none rounded-l-sm transition-all ${isPopup ? 'text-xs bg-gray-50 text-gray-500' : 'text-sm'}`}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://"
                />
                <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={fetchingMeta || !url}
                    className="bg-gray-100 border border-l-0 border-gray-300 px-3 text-xs font-bold text-gray-500 hover:text-del-blue hover:bg-white rounded-r-sm transition-colors"
                    title="Auto-fetch details"
                >
                    {fetchingMeta ? '...' : '⚡'}
                </button>
             </div>
        </div>

        {/* Title */}
        <div>
          {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-600">Title</label>}
          <input
            type="text"
            required
            className={`w-full border border-gray-300 p-2 focus:border-del-blue focus:ring-1 focus:ring-del-blue outline-none font-bold text-black rounded-sm ${isPopup ? 'text-sm' : 'text-sm'}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
        </div>

        {/* Description */}
        <div>
          {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-600">Description</label>}
          <textarea
            className={`w-full border border-gray-300 p-2 focus:border-del-blue focus:ring-1 focus:ring-del-blue outline-none rounded-sm resize-none ${isPopup ? 'text-xs h-16' : 'text-sm h-20'}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />
        </div>

        {/* Tags & Folders Row */}
        <div className="grid grid-cols-2 gap-3">
            <div>
              {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-600">Tags</label>}
              <input
                type="text"
                className={`w-full border border-gray-300 p-2 focus:border-del-blue focus:ring-1 focus:ring-del-blue outline-none rounded-sm ${isPopup ? 'text-xs' : 'text-sm'}`}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={isPopup ? "# Tags (comma)" : "news, tech"}
                autoFocus={isPopup} // Focus tags first in popup for quick entry
              />
            </div>

            <div>
              {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-600">Folder</label>}
              <div className="flex gap-1">
                  <input
                    type="text"
                    className={`w-full border border-gray-300 p-2 focus:border-del-blue focus:ring-1 focus:ring-del-blue outline-none rounded-sm bg-yellow-50/50 ${isPopup ? 'text-xs' : 'text-sm'}`}
                    value={folders}
                    onChange={(e) => setFolders(e.target.value)}
                    placeholder={isPopup ? "📁 Folder" : "Work, Projects"}
                  />
                  
                  {/* FOLDER DROPDOWN OR NEW INPUT */}
                  {isCreatingFolder ? (
                      <div className="absolute bg-white border border-gray-300 p-2 shadow-lg rounded-sm z-10 flex gap-1 right-0 sm:right-auto mt-8 w-48">
                          <input 
                              type="text" 
                              autoFocus
                              placeholder="New Folder Name" 
                              className="text-xs border border-gray-200 p-1 w-full"
                              value={newFolderTemp}
                              onChange={(e) => setNewFolderTemp(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmNewFolder())}
                          />
                          <button onClick={confirmNewFolder} type="button" className="bg-del-blue text-white text-xs px-2 rounded-sm">OK</button>
                      </div>
                  ) : (
                      allFolders && (
                        <select 
                            onChange={handleFolderSelect}
                            className={`border border-gray-300 bg-white text-xs rounded-sm focus:border-del-blue outline-none w-8 ${isPopup ? 'p-0' : ''}`}
                        >
                            <option value="">+</option>
                            {allFolders.map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                            <option disabled>──────────</option>
                            <option value="___CREATE_NEW___">+ New Folder</option>
                        </select>
                      )
                  )}
              </div>
            </div>
        </div>

        {/* Tag Preview */}
        {previewTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0">
                {previewTags.map((t, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-sm">
                        #{t}
                    </span>
                ))}
            </div>
        )}

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
            <input 
                type="checkbox" 
                id="toRead" 
                checked={toRead} 
                onChange={(e) => setToRead(e.target.checked)}
                className="rounded-sm border-gray-300 text-del-blue focus:ring-del-blue"
            />
            <label htmlFor="toRead" className="text-xs text-gray-600 cursor-pointer select-none">Mark as <strong>Unread</strong> (Read Later)</label>
        </div>

        <div className={`pt-2 flex gap-3 ${isPopup ? 'sticky bottom-0 bg-white pb-2' : ''}`}>
          <button
            type="submit"
            disabled={loading}
            className={`bg-del-blue hover:bg-del-dark-blue text-white font-bold disabled:opacity-50 shadow-sm transition-colors ${isPopup ? 'w-full py-2.5 text-sm rounded-sm' : 'px-6 py-1.5 text-sm uppercase rounded-sm'}`}
          >
            {loading ? 'Saving...' : 'Save Bookmark'}
          </button>
          
          {!isPopup && (
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-500 text-xs hover:underline uppercase font-bold px-2"
              >
                cancel
              </button>
          )}
        </div>
      </form>
    </div>
  );
};