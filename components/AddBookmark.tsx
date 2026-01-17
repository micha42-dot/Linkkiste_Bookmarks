import React, { useState } from 'react';
import { NewBookmark } from '../types';

interface AddBookmarkProps {
  onSave: (bookmark: NewBookmark) => Promise<void>;
  onCancel: () => void;
}

export const AddBookmark: React.FC<AddBookmarkProps> = ({ onSave, onCancel }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [folders, setFolders] = useState('');
  const [toRead, setToRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);

  const handleAutoFill = async () => {
    if (!url) return;
    
    // Basic URL validation
    let targetUrl = url;
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
        setUrl(targetUrl); // Update input to valid URL
    }

    setFetchingMeta(true);
    try {
        // We use microlink.io as a proxy to avoid CORS issues in the browser
        const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(targetUrl)}`);
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            const { title: metaTitle, description: metaDesc } = data.data;
            
            if (metaTitle) setTitle(metaTitle);
            if (metaDesc) setDescription(metaDesc);
        }
    } catch (error) {
        console.error("Failed to fetch metadata", error);
        // Fail silently or show subtle UI hint, but don't block user
    } finally {
        setFetchingMeta(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Split tags by comma instead of space
    const tagArray = tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const folderArray = folders
      .split(/[,;]+/) // Split by comma or semicolon
      .map(f => f.trim())
      .filter(f => f.length > 0);

    await onSave({
      url,
      title: title || url,
      description,
      tags: tagArray,
      folders: folderArray,
      to_read: toRead
    });
    
    setLoading(false);
  };

  // Helper to generate preview tags
  const previewTags = tags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-bold mb-4 text-black border-b border-gray-200 pb-2">
        Add a new bookmark
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold mb-1 text-gray-600">URL</label>
          <div className="flex gap-2">
            <input
                type="url"
                required
                autoFocus
                className="flex-grow border border-gray-400 p-1.5 text-sm focus:border-del-blue outline-none"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
            />
            <button
                type="button"
                onClick={handleAutoFill}
                disabled={fetchingMeta || !url}
                className="bg-gray-100 border border-gray-300 px-3 py-1 text-xs font-bold text-gray-600 hover:text-del-blue hover:bg-white disabled:opacity-50 whitespace-nowrap"
                title="Automatically fetch Title and Description"
            >
                {fetchingMeta ? 'Fetching...' : '✨ Auto-fill'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1 text-gray-600">Title</label>
          <input
            type="text"
            required
            className="w-full border border-gray-400 p-1.5 text-sm focus:border-del-blue outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold mb-1 text-gray-600">Description (optional)</label>
          <textarea
            className="w-full border border-gray-400 p-1.5 text-sm focus:border-del-blue outline-none h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 text-gray-600">Folders</label>
              <input
                type="text"
                className="w-full border border-gray-400 p-1.5 text-sm focus:border-del-blue outline-none bg-yellow-50"
                value={folders}
                onChange={(e) => setFolders(e.target.value)}
                placeholder="e.g. Work, Project X"
              />
              <p className="text-[10px] text-gray-400 mt-1">Comma separated</p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-gray-600">Tags</label>
              <input
                type="text"
                className="w-full border border-gray-400 p-1.5 text-sm focus:border-del-blue outline-none"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="news, tech, design"
              />
              <div className="flex justify-between items-start mt-1">
                <p className="text-[10px] text-gray-400">Comma separated</p>
                {previewTags.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1 max-w-[70%]">
                        {previewTags.map((t, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] text-[#666] border border-[#ddd] rounded-sm">
                                {t}
                            </span>
                        ))}
                    </div>
                )}
              </div>
            </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
            <input 
                type="checkbox" 
                id="toRead" 
                checked={toRead} 
                onChange={(e) => setToRead(e.target.checked)}
            />
            <label htmlFor="toRead" className="text-xs font-bold text-gray-700 cursor-pointer">Read Later (Unread)</label>
        </div>

        <div className="pt-2 flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-del-green hover:bg-[#7bc038] text-white px-6 py-1.5 text-sm font-bold uppercase disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-del-blue text-sm hover:underline"
          >
            cancel
          </button>
        </div>
      </form>
    </div>
  );
};