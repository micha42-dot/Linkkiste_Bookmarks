import React, { useState, useEffect } from 'react';
// Local settings fetch logic directly in AddBookmark
import { NewBookmark } from '../types';
import { normalizeUrl, parseTags } from '../utils/helpers';

interface AddBookmarkProps {
  onSave: (bookmark: NewBookmark) => Promise<void>;
  onCancel: () => void;
  initialUrl?: string;
  initialTitle?: string;
  allFolders?: string[];
  existingUrls?: string[];
  isPopup?: boolean;
}

export const AddBookmark: React.FC<AddBookmarkProps> = ({ 
    onSave, 
    onCancel, 
    initialUrl, 
    initialTitle,
    allFolders = [], 
    existingUrls = [],
    isPopup = false 
}) => {
  const [url, setUrl] = useState(initialUrl || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [toRead, setToRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [clipArticle, setClipArticle] = useState(false);
  const [clippingStatus, setClippingStatus] = useState('');
  
  // Local settings for clipping
  const [localOpenRouterKey, setLocalOpenRouterKey] = useState<string | null>(null);
  const [localAiBaseUrl, setLocalAiBaseUrl] = useState<string>('https://openrouter.ai/api/v1');
  const [localAiModel, setLocalAiModel] = useState<string>('google/gemini-2.5-flash');
  const [localClippingLanguage, setLocalClippingLanguage] = useState<string>('');
  
  useEffect(() => {
      const storedLang = localStorage.getItem('hk_clipping_language');
      if (storedLang) setLocalClippingLanguage(storedLang);
      const storedKey = localStorage.getItem('hk_openrouter_key');
      if (storedKey) setLocalOpenRouterKey(storedKey);
      
      const storedUrl = localStorage.getItem('hk_ai_base_url');
      if (storedUrl) setLocalAiBaseUrl(storedUrl);
      
      const storedModel = localStorage.getItem('hk_ai_query_model') || localStorage.getItem('hk_wiki_model');
      if (storedModel) setLocalAiModel(storedModel);
  }, []);
  const [isDuplicate, setIsDuplicate] = useState(false);
  
  // Folder Management
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderTemp, setNewFolderTemp] = useState('');

  useEffect(() => {
    if (initialUrl && !url) setUrl(initialUrl);
    if (initialTitle && (!title || title === url)) setTitle(initialTitle);
  }, [initialUrl, initialTitle]);

  // Duplicate Check Logic
  useEffect(() => {
      if (!url || !existingUrls || existingUrls.length === 0) {
          setIsDuplicate(false);
          return;
      }
      const currentNorm = normalizeUrl(url);
      const found = existingUrls.some(ex => normalizeUrl(ex) === currentNorm);
      setIsDuplicate(found);
  }, [url, existingUrls]);

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
      } else {
          if (!selectedFolders.includes(val)) setSelectedFolders([...selectedFolders, val]);
      }
      e.target.value = '';
  };

  const confirmNewFolder = () => {
      const val = newFolderTemp.trim();
      if (val && !selectedFolders.includes(val)) {
          setSelectedFolders([...selectedFolders, val]);
      }
      setNewFolderTemp('');
      setIsCreatingFolder(false);
  };

  const removeFolder = (folderToRemove: string) => {
      setSelectedFolders(selectedFolders.filter(f => f !== folderToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !url.trim()) return;

    setLoading(true);
    // Use shared utility
    const tagArray = parseTags(tags);
    let finalTitle = title.trim() || 'Untitled Note';
    let finalNotes = '';
    let finalTags = tagArray;

    if (clipArticle && url.trim()) {
        try {
            setClippingStatus('Scraping page...');
            const scrapeRes = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() })
            });
            
            if (scrapeRes.ok) {
                const scrapeData = await scrapeRes.json();
                
                // If title was empty, maybe use scraped title
                if (!title.trim() && scrapeData.title) {
                    finalTitle = scrapeData.title;
                }
                
                if (scrapeData.text && localOpenRouterKey) {
                    setClippingStatus('Generating AI summary...');
                    const aiRes = await fetch('/api/llm/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-openrouter-key': localOpenRouterKey || '',
                            'x-ai-base-url': localAiBaseUrl
                        },
                        body: JSON.stringify({
                            model: localAiModel,
                            customMessages: [
                                {
                                    role: "system",
                                    content: `You are an expert knowledge management assistant. The user is saving a webpage to their Second Brain. Provide a highly detailed and comprehensive summary of the content in Markdown. ${localClippingLanguage ? 'IMPORTANT: Write the summary in ' + localClippingLanguage + '!' : ''} Structure the summary logically with appropriate headings (e.g., '### Core Message', '### Key Points & Details', '### Conclusion'), use bullet points for readability, and highlight important terms in bold. Ensure all major arguments, facts, and insights from the text are captured. At the very end, extract 3-5 relevant tags and append them as #tag1 #tag2.`
                                },
                                {
                                    role: "user",
                                    content: `Title: ${scrapeData.title}\n\nText: ${scrapeData.text}`
                                }
                            ]
                        })
                    });
                    
                    if (aiRes.ok) {
                        const aiData = await aiRes.json();
                        const aiContent = aiData.choices?.[0]?.message?.content;
                        if (aiContent) {
                            finalNotes = `> **AI Summary**\n\n${aiContent}\n\n---\n*Source length: ${scrapeData.text.length} chars*`;
                        }
                    } else {
                        finalNotes = `> **Clipped Content**\n\n${scrapeData.text.substring(0, 1000)}...`;
                    }
                } else if (scrapeData.text) {
                    finalNotes = `> **Clipped Content**\n\n${scrapeData.text.substring(0, 1000)}...`;
                }
            }
        } catch (err) {
            console.error('Clipping failed', err);
        }
    }

    await onSave({
      url: url.trim(),
      title: finalTitle,
      description,
      notes: finalNotes ? finalNotes : undefined,
      tags: finalTags,
      folders: selectedFolders,
      to_read: toRead
    });

    setClippingStatus('');
    setLoading(false);
  };

  // Live preview logic using simplified split just for display
  const previewTags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

  return (
    <div className={`w-full ${isPopup ? '' : 'max-w-xl'}`}>
      {!isPopup && (
          <h2 className="text-lg font-bold mb-4 text-black border-b border-gray-200 pb-2">Add a new bookmark</h2>
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

      {isDuplicate && (
          <div className="mb-4 p-3 bg-[#f0fdf4] text-del-blue border border-blue-200 text-xs font-bold rounded-sm text-center uppercase tracking-wide">
              Bookmark already exists
          </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
             {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-700">URL (optional for notes)</label>}
             <div className="flex">
                <input type="text" className={`flex-grow web2-input p-2 outline-none rounded-l-sm transition-all ${isPopup ? 'text-xs bg-gray-50 text-gray-500' : 'text-sm'} ${isDuplicate ? 'border-blue-300 bg-blue-50' : ''}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https:// (optional)" />
                <button type="button" onClick={handleAutoFill} disabled={fetchingMeta || !url} className="web2-btn border-l-0 px-3 text-xs font-bold text-gray-600 hover:text-del-blue rounded-r-sm transition-colors min-w-[40px] cursor-pointer" title="Auto-fetch details">
                    {fetchingMeta ? <span className="inline-block animate-bounce">🐈</span> : '⚡'}
                </button>
             </div>
        </div>

        <div>
          {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-700">Title</label>}
          <input type="text" required className="w-full web2-input p-2 outline-none font-bold text-black rounded-sm text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        </div>

        <div>
          {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-700">Description</label>}
          <textarea className={`w-full web2-input p-2 outline-none rounded-sm resize-none ${isPopup ? 'text-xs h-16' : 'text-sm h-20'}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
        </div>

        <div className="grid grid-cols-2 gap-3">
            <div>
              {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-700">Tags</label>}
              <input type="text" className={`w-full web2-input p-2 outline-none rounded-sm ${isPopup ? 'text-xs' : 'text-sm'}`} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={isPopup ? "# Tags (comma)" : "news, tech"} autoFocus={isPopup} />
              <div className="flex flex-wrap gap-1 mt-1.5 min-h-[20px]">
                {previewTags.map((t, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-sm">{t}</span>
                ))}
                {previewTags.length === 0 && <span className="text-[10px] text-gray-300 italic">No tags</span>}
              </div>
            </div>

            <div>
              {!isPopup && <label className="block text-xs font-bold mb-1 text-gray-700">Folder</label>}
              <div className="relative">
                  {isCreatingFolder ? (
                      <div className="flex gap-1 w-full">
                          <input type="text" autoFocus placeholder="New Folder..." className={`web2-input p-2 w-full outline-none rounded-sm ${isPopup ? 'text-xs' : 'text-sm'}`} value={newFolderTemp} onChange={(e) => setNewFolderTemp(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), confirmNewFolder())} />
                          <button onClick={confirmNewFolder} type="button" className="web2-btn-blue text-xs px-2.5 rounded-sm">OK</button>
                      </div>
                  ) : (
                    <select onChange={handleFolderSelect} className={`w-full web2-input bg-white rounded-sm outline-none cursor-pointer ${isPopup ? 'text-xs p-2' : 'text-sm p-2'}`}>
                        <option value="">Select Folder...</option>
                        {allFolders.map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="___CREATE_NEW___">+ Add new folder</option>
                    </select>
                  )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5 min-h-[20px]">
                 {selectedFolders.map(folder => (
                     <span key={folder} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-sm">
                         📁 {folder}
                         <button type="button" onClick={() => removeFolder(folder)} className="hover:text-red-600 font-bold">×</button>
                     </span>
                 ))}
                 {selectedFolders.length === 0 && <span className="text-[10px] text-gray-300 italic">No folder</span>}
              </div>
            </div>
        </div>

        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
                <input type="checkbox" id="toRead" checked={toRead} onChange={(e) => setToRead(e.target.checked)} className="rounded-sm border-gray-300 text-del-blue focus:ring-del-blue" />
                <label htmlFor="toRead" className="text-xs text-gray-700 cursor-pointer select-none">Mark as <strong>Unread</strong> (Read Later)</label>
            </div>
            
            <div className="flex items-center gap-2">
                <input type="checkbox" id="clipArticle" checked={clipArticle} onChange={(e) => setClipArticle(e.target.checked)} disabled={!url} className="rounded-sm border-gray-300 text-purple-600 focus:ring-purple-600 disabled:opacity-50" />
                <label htmlFor="clipArticle" className={`text-xs cursor-pointer select-none ${!url ? 'text-gray-400' : 'text-purple-800'}`}>
                    <strong>✨ Web-Clipper:</strong> Seite lesen & mit KI zusammenfassen
                </label>
            </div>
        </div>

        <div className={`pt-2 flex gap-3 ${isPopup ? 'sticky bottom-0 bg-white pb-2' : ''}`}>
          <button type="submit" disabled={loading} className={`web2-btn-blue font-bold disabled:opacity-50 transition-all cursor-pointer ${isPopup ? 'w-full py-2.5 text-sm rounded-sm' : 'px-6 py-2 text-xs uppercase rounded-sm'}`}>
            {loading ? (clippingStatus || 'Saving...') : (isDuplicate ? 'SAVE ANYWAY' : 'Save Bookmark')}
          </button>
          {!isPopup && (
              <button type="button" onClick={onCancel} className="web2-btn text-gray-600 text-xs hover:text-black uppercase font-bold px-4 py-2 rounded-sm cursor-pointer">cancel</button>
          )}
        </div>
      </form>
    </div>
  );
};