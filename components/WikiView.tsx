import React, { useState, useEffect } from 'react';
import { Bookmark, NewBookmark } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConfirmModal } from './ConfirmModal';
import { WikiCalendar } from './WikiCalendar';
import { WikiTasks } from './WikiTasks';
import { isWikiBookmark } from '../utils/helpers';

interface WikiViewProps {
  bookmarks: Bookmark[];
  onAddBookmark: (bm: NewBookmark) => Promise<Bookmark>;
  onUpdateBookmark: (id: number, data: Partial<Bookmark>) => Promise<void>;
  onDeleteBookmark?: (id: number) => Promise<void>;
  onViewDetail: (id: number) => void;
  kmFeatures?: { wiki: boolean; ai: boolean };
  openRouterKey?: string;
  defaultWikiModel?: string;
  aiBaseUrl?: string;
}

export const WikiView: React.FC<WikiViewProps> = ({ 
    bookmarks, 
    onAddBookmark, 
    onUpdateBookmark,
    onDeleteBookmark,
    onViewDetail,
    kmFeatures = { wiki: true, ai: true },
    openRouterKey = '',
    defaultWikiModel = '',
    aiBaseUrl = ''
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [splitScreen, setSplitScreen] = useState(false);
  const [sortBy, setSortBy] = useState<'alpha'|'recent'>('alpha');
  const [activeTab, setActiveTab] = useState<'pages'|'calendar'|'tasks'>('pages');
  const [editNotes, setEditNotes] = useState('');
  const [editTitle, setEditTitle] = useState('');

  // Confirmation Modal State
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

  const handleDeletePage = async (id: number, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Wikiseite löschen',
      message: `Möchtest du die Wikiseite "${title}" wirklich unwiderruflich löschen?`,
      onConfirm: async () => {
        if (onDeleteBookmark) {
          await onDeleteBookmark(id);
          if (selectedId === id) {
            setSelectedId(null);
            setIsEditing(false);
          }
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };
  
  // Insert Bookmark Modal State
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [insertTab, setInsertTab] = useState<'existing' | 'new'>('existing');
  const [searchInsertQuery, setSearchInsertQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Insert Wiki Page Modal State
  const [showPageLinkModal, setShowPageLinkModal] = useState(false);
  const [pageLinkSearch, setPageLinkSearch] = useState('');

  // Wiki Search State
  const [wikiSearchTerm, setWikiSearchTerm] = useState('');

  // AI Assistant State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const pages = bookmarks.filter(b => isWikiBookmark(b));

  // Handle URL parameter ?page=... or custom event 'selectWikiPage'
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam) {
      const pageId = parseInt(pageParam, 10);
      if (!isNaN(pageId)) {
        setSelectedId(pageId);
      }
    }

    const handleCustomSelect = (e: any) => {
      if (e.detail) {
        setSelectedId(Number(e.detail));
        setIsEditing(false);
      }
    };
    window.addEventListener('selectWikiPage', handleCustomSelect);
    return () => window.removeEventListener('selectWikiPage', handleCustomSelect);
  }, []);

  // Auto-load Startseite if nothing is selected
  useEffect(() => {
      if (selectedId === null && bookmarks.length > 0) {
          const params = new URLSearchParams(window.location.search);
          if (!params.get("page")) {
              const startPage = pages.find(b => b.title.toLowerCase() === "startseite" || b.title.toLowerCase() === "home");
              if (startPage) {
                  setSelectedId(startPage.id);
                  window.history.replaceState({}, "", `?view=wiki&page=${startPage.id}`);
              }
          }
      }
  }, [bookmarks, pages, selectedId]);

  const handleAskAi = async () => {
      if (!aiPrompt.trim()) return;
      setIsAiLoading(true);
      setAiError('');

      try {
          const res = await fetch('/api/llm/chat', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(openRouterKey ? { 'x-openrouter-key': openRouterKey } : {}),
                ...(aiBaseUrl ? { 'x-ai-base-url': aiBaseUrl } : {})
            },
            body: JSON.stringify({
              model: defaultWikiModel,
              prompt: aiPrompt,
              customMessages: [
                  { 
                      role: "system", 
                      content: "You are an AI assistant helping a user write and organize a wiki page. Output ONLY the raw markdown text that should be inserted or used. Do not wrap in markdown code blocks unless the user asks for a code block." 
                  },
                  {
                      role: "user",
                      content: `Current page title: ${editTitle}\nCurrent content:\n${editNotes}\n\nUser request: ${aiPrompt}`
                  }
              ]
            })
          });
          
          let data;
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
              data = await res.json();
          } else {
              const text = await res.text();
              throw new Error(`Server returned a non-JSON response (Status ${res.status}): ${text.substring(0, 100)}...`);
          }

          if (!res.ok || data.error) throw new Error(data.error || `Server error: ${res.status}`);
          
          const responseText = data.choices[0].message.content;
          
          // Insert AI text at the end of the editor
          insertIntoEditor(`\n\n${responseText}\n\n`);
          setShowAiModal(false);
          setAiPrompt('');
      } catch (err: any) {
          setAiError(err.message || 'Error asking AI');
      } finally {
          setIsAiLoading(false);
      }
  };

  // Editor ref for formatting
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const applyFormatting = (prefix: string, suffix: string = '') => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = editNotes.substring(start, end);
      
      const newText = editNotes.substring(0, start) + prefix + selectedText + suffix + editNotes.substring(end);
      setEditNotes(newText);
      
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, end + prefix.length);
      }, 0);
  };

  // Filter pages by search term
  const displayedPages = pages.filter(p => 
      p.title.toLowerCase().includes(wikiSearchTerm.toLowerCase()) || 
      (p.notes && p.notes.toLowerCase().includes(wikiSearchTerm.toLowerCase()))
  ).sort((a, b) => {
      if (sortBy === 'recent') {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
      }
      return a.title.localeCompare(b.title);
  });

  const selectedPage = pages.find(p => p.id === selectedId);

  const handleSelectPage = (id: number) => {
      setSelectedId(id);
      setIsEditing(false);
  };

  const handleCreateNewPage = async (initialTitle: string = 'New Wiki Page') => {
      const newPage = await onAddBookmark({
          title: initialTitle,
          url: '',
          description: '',
          tags: ['wiki'],
          folders: [],
          to_read: false
      });
      setSelectedId(newPage.id);
      setIsEditing(true);
      setEditTitle(newPage.title);
      setEditNotes(newPage.notes || '');
      setWikiSearchTerm(''); // Clear search to see new page
  };

  const handleSavePage = async () => {
      if (!selectedPage) return;
      await onUpdateBookmark(selectedPage.id, {
          title: editTitle,
          notes: editNotes
      });
      setIsEditing(false);
  };

  const insertIntoEditor = (textToInsert: string) => {
      if (textareaRef.current) {
          const textarea = textareaRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          
          const newText = editNotes.substring(0, start) + textToInsert + editNotes.substring(end);
          setEditNotes(newText);
          
          setTimeout(() => {
              textarea.focus();
              textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
          }, 0);
      } else {
          setEditNotes(prev => prev + textToInsert);
      }
      setShowInsertModal(false);
  };

  const handleCreateAndInsertBookmark = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsCreating(true);
      try {
          const newBm = await onAddBookmark({
              title: newTitle || newUrl,
              url: newUrl,
              description: newDescription,
              tags: [],
              folders: [],
              to_read: false
          });
          
          insertIntoEditor(`\n\n[[bookmark:${newBm.id}]]\n\n`);
          
          setNewTitle('');
          setNewUrl('');
          setNewDescription('');
      } catch (err) {
          console.error(err);
      } finally {
          setIsCreating(false);
      }
  };

  const filteredExistingBookmarks = bookmarks.filter(b => 
      b.title.toLowerCase().includes(searchInsertQuery.toLowerCase()) || 
      (b.url && b.url.toLowerCase().includes(searchInsertQuery.toLowerCase()))
  ).slice(0, 10);

  // Custom renderer for embedded bookmarks
  const renderContent = (content: string) => {
      if (!content) return null;
      
      // We process regular wikilinks [[PageName]] into a special custom markdown link syntax
      let processed = content.replace(/\[\[(?!bookmark:)(.*?)\]\]/g, (match, p1) => `[${p1}](#wiki:${encodeURIComponent(p1)})`);
      
      // Split by our special [[bookmark:id]]
      const parts = processed.split(/\[\[bookmark:(\d+)\]\]/g);
      
      return parts.map((part, i) => {
          // Every odd index is a bookmark ID due to how split with capture groups works
          if (i % 2 === 1) {
              const bmId = parseInt(part, 10);
              const bm = bookmarks.find(b => b.id === bmId);
              
              if (!bm) return <span key={i} className="text-red-500">[Bookmark not found]</span>;
              
              return (
                  <div key={i} className="my-4 border border-gray-200 bg-white p-3 rounded-sm shadow-sm hover:border-del-blue transition-colors cursor-pointer" onClick={() => onViewDetail(bm.id)}>
                      <div className="font-bold text-del-blue">{bm.title}</div>
                      {bm.url && <div className="text-xs text-gray-500 truncate">{bm.url}</div>}
                      {bm.description && <div className="text-sm text-gray-700 mt-1">{bm.description}</div>}
                  </div>
              );
          }
          
          return (
              <ReactMarkdown 
                  key={i} 
                  remarkPlugins={[remarkGfm]}
                  components={{
                      a: ({node, href, children, ...props}) => {
                          if (href?.startsWith('#wiki:')) {
                              const title = decodeURIComponent(href.replace('#wiki:', ''));
                              const existingPage = pages.find(p => p.title.toLowerCase() === title.toLowerCase());
                              if (existingPage) {
                                  return (
                                      <a href="#" onClick={(e) => { e.preventDefault(); handleSelectPage(existingPage.id); }} className="text-del-blue hover:underline font-semibold bg-blue-50 px-1 rounded-sm">
                                          {children}
                                      </a>
                                  );
                              } else {
                                  return (
                                      <a href="#" onClick={(e) => { e.preventDefault(); handleCreateNewPage(title); }} className="text-red-500 hover:underline hover:text-red-700 font-semibold bg-red-50 px-1 rounded-sm border-b border-dashed border-red-300" title={`Create missing page: ${title}`}>
                                          {children}
                                      </a>
                                  );
                              }
                          }
                          return <a href={href} {...props} target="_blank" rel="noopener noreferrer">{children}</a>
                      }
                  }}
              >
                  {part}
              </ReactMarkdown>
          );
      });
  };

  // Extract TOC (Table of Contents) from current page notes
  const toc = (selectedPage?.notes || '').split('\n').filter(line => line.startsWith('#')).map(line => {
      const match = line.match(/^(#+)\s+(.*)/);
      if (match) {
          return { level: match[1].length, text: match[2] };
      }
      return null;
  }).filter(Boolean) as { level: number; text: string; }[];

  // Find backlinks (pages that link to the current page via [[Title]])
  const backlinks = selectedPage ? pages.filter(p => 
      p.id !== selectedPage.id && 
      p.notes && 
      (p.notes.includes(`[[${selectedPage.title}]]`) || p.notes.includes(`#wiki:${selectedPage.title}`))
  ) : [];

  // Find unlinked mentions (pages that contain the title of this page, but WITHOUT [[...]])
  const unlinkedMentions = selectedPage && selectedPage.title.trim().length > 2 ? pages.filter(p => {
      if (p.id === selectedPage.id || !p.notes) return false;
      const titleLower = selectedPage.title.toLowerCase();
      const notesLower = p.notes.toLowerCase();
      // Must contain title but not as a link [[Title]]
      return notesLower.includes(titleLower) && 
             !p.notes.includes(`[[${selectedPage.title}]]`) && 
             !p.notes.includes(`#wiki:${selectedPage.title}`);
  }) : [];

  const handleLinkUnlinkedMention = async (sourcePage: Bookmark) => {
      if (!selectedPage || !sourcePage.notes) return;
      const regex = new RegExp(`\\b(${selectedPage.title})\\b`, 'gi');
      const updatedNotes = sourcePage.notes.replace(regex, `[[$1]]`);
      await onUpdateBookmark(sourcePage.id, { notes: updatedNotes });
  };

  const handleOpenTodayNote = async () => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const title = `Daily Note: ${today}`;
      const existing = pages.find(p => p.title.toLowerCase() === title.toLowerCase());
      if (existing) {
          handleSelectPage(existing.id);
      } else {
          try {
              const newPage = await onAddBookmark({
                  title,
                  url: '',
                  description: '',
                  tags: ['wiki', 'daily-note'],
                  folders: [],
                  to_read: false
              });
              const initialContent = `# 📅 ${today}\n\n## Gedanken & Notizen\n- \n\n## Gelesene Links & Fundstücke\n- \n`;
              await onUpdateBookmark(newPage.id, { notes: initialContent });
              handleSelectPage(newPage.id);
              setIsEditing(true);
              setEditTitle(title);
              setEditNotes(initialContent);
          } catch (e) {
              console.error(e);
          }
      }
  };

  return (
      <div className="flex flex-col md:flex-row h-[75vh] border border-[#CCCCCC] rounded-sm overflow-hidden bg-white">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 border-r border-[#CCCCCC] bg-[#F9F9F9] flex flex-col">
              <div className="flex border-b border-[#CCCCCC] bg-[#F0F0F0]">
                  <button 
                      onClick={() => setActiveTab('pages')}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'pages' ? 'bg-white text-del-blue border-t-[3px] border-t-del-blue border-r border-[#CCCCCC]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t-[3px] border-t-transparent'}`}
                  >Pages</button>
                  <button 
                      onClick={() => setActiveTab('calendar')}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'calendar' ? 'bg-white text-del-blue border-t-[3px] border-t-del-blue border-r border-[#CCCCCC] border-l border-[#CCCCCC]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t-[3px] border-t-transparent border-l border-transparent border-r border-transparent'}`}
                  >Calendar</button>
                  <button 
                      onClick={() => setActiveTab('tasks')}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${activeTab === 'tasks' ? 'bg-white text-del-blue border-t-[3px] border-t-del-blue border-l border-[#CCCCCC]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t-[3px] border-t-transparent'}`}
                  >Tasks</button>
              </div>

              {activeTab === 'pages' && (
                  <>
                      <div className="p-2.5 bg-white border-b border-[#CCCCCC] flex justify-between items-center">
                          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700">Wiki Pages</h3>
                          <div className="flex items-center gap-1.5">
                              <button 
                                  onClick={handleOpenTodayNote}
                                  className="text-[11px] bg-white border border-[#CCCCCC] hover:border-gray-400 hover:text-del-blue px-2 py-0.5 rounded-sm font-bold flex items-center gap-1 cursor-pointer"
                                  title="Open or Create Today's Daily Note"
                              >
                                  <span>📅</span> Today
                              </button>
                              <button onClick={() => handleCreateNewPage()} className="bg-del-blue hover:bg-del-dark-blue text-white text-xs font-bold px-2 py-0.5 rounded-sm cursor-pointer" title="New Page">+</button>
                          </div>
                      </div>
                      <div className="p-2 border-b border-[#E5E5E5] bg-white flex flex-col gap-2">
                          <input 
                              type="text" 
                              placeholder="Search wiki..." 
                              value={wikiSearchTerm}
                              onChange={(e) => setWikiSearchTerm(e.target.value)}
                              className="w-full px-2.5 py-1 text-xs bg-white border border-[#CCCCCC] rounded-sm outline-none focus:border-del-blue"
                          />
                          <div className="flex gap-1">
                              <button 
                                  onClick={() => setSortBy('alpha')} 
                                  className={`flex-1 text-[10px] font-bold px-1 py-0.5 rounded-sm border ${sortBy === 'alpha' ? 'bg-del-blue text-white border-del-blue' : 'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100'}`}
                              >A-Z</button>
                              <button 
                                  onClick={() => setSortBy('recent')} 
                                  className={`flex-1 text-[10px] font-bold px-1 py-0.5 rounded-sm border ${sortBy === 'recent' ? 'bg-del-blue text-white border-del-blue' : 'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100'}`}
                              >Letzte</button>
                          </div>
                      </div>
                      <div className="flex-grow overflow-y-auto">
                          {displayedPages.length === 0 ? (
                              <div className="p-4 text-xs text-gray-500">No pages found.</div>
                          ) : (
                              displayedPages.map(page => (
                                  <div 
                                      key={page.id} 
                                      onClick={() => handleSelectPage(page.id)}
                                      className={`p-2.5 border-b border-gray-100 cursor-pointer text-xs flex items-center justify-between group/item ${selectedId === page.id ? 'bg-[#EEF4FD] border-l-4 border-l-del-blue font-bold text-black' : 'hover:bg-gray-100 text-gray-700'}`}
                                  >
                                      <span className="truncate flex-grow">📄 {page.title || 'Untitled'}</span>
                                      <button 
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePage(page.id, page.title);
                                          }} 
                                          className="opacity-0 group-hover/item:opacity-100 text-gray-400 hover:text-red-600 px-1 text-xs transition-opacity"
                                          title="Löschen"
                                      >
                                          🗑️
                                      </button>
                                  </div>
                              ))
                          )}
                      </div>
                  </>
              )}

              {activeTab === 'calendar' && (
                  <WikiCalendar 
                      pages={pages} 
                      onSelectPage={(id) => handleSelectPage(id)}
                      onCreateDailyNote={async (dateStr) => {
                          const title = `Daily Note: ${dateStr}`;
                          try {
                              const newPage = await onAddBookmark({
                                  title,
                                  url: '',
                                  description: '',
                                  tags: ['daily-note', 'wiki'],
                                  folders: [],
                                  to_read: false
                              });
                              const initialContent = `# 📅 ${dateStr}\n\n## Gedanken & Notizen\n- \n\n## Aufgaben\n- [ ] \n`;
                              await onUpdateBookmark(newPage.id, { notes: initialContent });
                              handleSelectPage(newPage.id);
                              setIsEditing(true);
                              setEditTitle(title);
                              setEditNotes(initialContent);
                          } catch (e) {
                              console.error(e);
                          }
                      }}
                      onCreatePageForDate={async (dateStr) => {
                          const title = `Note (${dateStr})`;
                          try {
                              const newPage = await onAddBookmark({
                                  title,
                                  url: '',
                                  description: '',
                                  tags: ['wiki'],
                                  folders: [],
                                  to_read: false
                              });
                              handleSelectPage(newPage.id);
                              setIsEditing(true);
                              setEditTitle(title);
                              setEditNotes(`# ${title}\n\n`);
                          } catch (e) {
                              console.error(e);
                          }
                      }}
                  />
              )}

              {activeTab === 'tasks' && (
                  <WikiTasks 
                      pages={pages}
                      onSelectPage={handleSelectPage}
                  />
              )}
          </div>

          {/* Main Content */}
          <div className="flex-grow flex flex-col relative bg-white">
              {selectedPage ? (
                  isEditing ? (
                      <div className="flex flex-col h-full bg-[#fffff8] relative">
                          {/* Toolbar */}
                          <div className="web2-panel-header flex items-center justify-between p-2 flex-wrap gap-2">
                              <div className="flex items-center gap-1">
                                  <button onClick={() => applyFormatting('**', '**')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 font-bold text-xs" title="Bold">B</button>
                                  <button onClick={() => applyFormatting('*', '*')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 italic font-serif text-xs" title="Italic">I</button>
                                  <button onClick={() => applyFormatting('## ', '')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 font-bold text-xs" title="Heading">H</button>
                                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                                  <button onClick={() => applyFormatting('- ', '')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 text-xs" title="Bullet List">•</button>
                                  <button onClick={() => applyFormatting('> ', '')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 text-xs" title="Quote">"</button>
                                  <button onClick={() => applyFormatting('`', '`')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 text-[11px] font-mono" title="Code">{"</>"}</button>
                                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                                  <button onClick={() => applyFormatting('[', '](url)')} className="web2-btn w-7 h-7 flex items-center justify-center rounded-sm text-gray-700 text-xs font-bold" title="Web Link">🔗</button>
                                  <button onClick={() => setShowInsertModal(true)} className="web2-btn flex items-center gap-1 px-2 h-7 rounded-sm text-gray-700 text-[11px] font-bold" title="Insert Bookmark">
                                      <span>🔖</span> Bookmark
                                  </button>
                                  <button onClick={() => { setPageLinkSearch(''); setShowPageLinkModal(true); }} className="web2-btn flex items-center gap-1 px-2 h-7 rounded-sm text-del-blue text-[11px] font-bold" title="Wikilink zu anderer Seite einfügen">
                                      <span>📄</span> [[Wikilink]]
                                  </button>
                              </div>
                              <div className="flex items-center gap-2 pr-2">
                                  <button onClick={() => setSplitScreen(!splitScreen)} className={`web2-btn text-xs font-bold px-2.5 py-1 rounded-sm flex items-center gap-1 ${splitScreen ? 'bg-gray-200' : ''}`}>
                                      Split View
                                  </button>
                                  {kmFeatures.ai && (
                                      <button onClick={() => setShowAiModal(true)} className="web2-btn text-purple-700 text-xs font-bold px-2.5 py-1 rounded-sm flex items-center gap-1">
                                          ✨ AI
                                      </button>
                                  )}
                                  <button onClick={() => setIsEditing(false)} className="web2-btn text-gray-700 text-xs font-bold uppercase px-3 py-1 rounded-sm">
                                      Cancel
                                  </button>
                                  <button onClick={handleSavePage} className="web2-btn-green text-white text-xs font-bold uppercase px-4 py-1 rounded-sm">
                                      Save
                                  </button>
                              </div>
                          </div>
                          <div className={`flex-grow p-4 md:p-6 flex h-full overflow-hidden ${splitScreen ? 'flex-row gap-6' : 'flex-col'}`}>
                              <div className="flex-1 flex flex-col h-full w-full">
                                  <input 
                                      className="text-2xl font-bold bg-transparent border-b border-gray-300 focus:border-del-blue outline-none w-full mb-4 pb-2"
                                      value={editTitle}
                                      onChange={e => setEditTitle(e.target.value)}
                                      placeholder="Page Title"
                                  />
                                  <textarea 
                                      ref={textareaRef}
                                      className="flex-grow w-full border-none p-0 outline-none resize-none font-serif text-sm bg-transparent leading-relaxed"
                                      value={editNotes}
                                      onChange={e => setEditNotes(e.target.value)}
                                      onKeyDown={e => {
                                          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                                              e.preventDefault();
                                              handleSavePage();
                                          }
                                      }}
                                      placeholder="Write your markdown here... Use [[Page Name]] to link pages."
                                  ></textarea>
                              </div>
                              {splitScreen && (
                                  <div className="flex-1 border-l border-gray-200 pl-6 h-full overflow-y-auto hidden md:block">
                                      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-6">{editTitle || 'Untitled Page'}</h2>
                                      <div className="markdown-body font-serif text-gray-800 text-sm md:text-base leading-relaxed">
                                          {renderContent(editNotes)}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col h-full p-4 md:p-8 overflow-y-auto relative group">
                          <div className="flex justify-between items-start mb-6 border-b border-[#CCCCCC] pb-4">
                              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{selectedPage.title}</h2>
                              <div className="flex items-center gap-2">
                                  <button onClick={() => {
                                      setEditTitle(selectedPage.title);
                                      setEditNotes(selectedPage.notes || '');
                                      setIsEditing(true);
                                  }} className="web2-btn text-del-blue hover:text-del-dark-blue text-xs font-bold px-3 py-1 rounded-sm cursor-pointer shadow-2xs">
                                      ✏️ Edit Page
                                  </button>
                                  <button 
                                      onClick={() => handleDeletePage(selectedPage.id, selectedPage.title)}
                                      className="web2-btn text-red-600 hover:text-red-800 text-xs font-bold px-3 py-1 rounded-sm cursor-pointer shadow-2xs"
                                  >
                                      Delete
                                  </button>
                              </div>
                          </div>
                          
                          <div className="flex flex-col lg:flex-row gap-8 items-start">
                              <div className="flex-grow prose prose-sm max-w-none font-serif text-gray-800 leading-relaxed text-[15px] prose-p:my-2 prose-a:text-del-blue">
                                  {renderContent(selectedPage.notes || '*No content yet.*')}
                              </div>
                              
                              <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
                                  {/* Table of Contents */}
                                  {toc.length > 0 && (
                                      <div className="bg-gray-50 p-4 border border-gray-100 rounded-sm">
                                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Contents</h4>
                                          <ul className="space-y-1">
                                              {toc.map((item, idx) => (
                                                  <li key={idx} style={{ marginLeft: `${(item.level - 1) * 0.75}rem` }} className="text-sm text-gray-700">
                                                      {item.text}
                                                  </li>
                                              ))}
                                          </ul>
                                      </div>
                                  )}
                                  
                                  {/* Backlinks */}
                                  <div className="bg-[#fffff8] p-4 border border-[#e5e5cc] rounded-sm">
                                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                          <span>🔗</span> Backlinks
                                      </h4>
                                      {backlinks.length === 0 ? (
                                          <p className="text-xs text-gray-400 italic">No pages link here yet.</p>
                                      ) : (
                                          <ul className="space-y-2">
                                              {backlinks.map(bl => (
                                                  <li key={bl.id}>
                                                      <button onClick={() => handleSelectPage(bl.id)} className="text-sm text-del-blue hover:underline text-left block w-full truncate">
                                                          {bl.title}
                                                      </button>
                                                  </li>
                                              ))}
                                          </ul>
                                      )}
                                  </div>

                                  {/* Unlinked Mentions */}
                                  {unlinkedMentions.length > 0 && (
                                      <div className="bg-amber-50/70 p-4 border border-amber-200 rounded-sm">
                                          <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                                              <span className="flex items-center gap-1"><span>💡</span> Unlinked Mentions</span>
                                              <span className="text-[10px] bg-amber-100 px-1.5 py-0.5 rounded text-amber-800 font-mono font-bold">{unlinkedMentions.length}</span>
                                          </h4>
                                          <p className="text-[11px] text-gray-600 mb-3">
                                              Erwähnt in folgenden Notizen, aber noch nicht verlinkt:
                                          </p>
                                          <ul className="space-y-2">
                                              {unlinkedMentions.map(um => (
                                                  <li key={um.id} className="text-xs flex items-center justify-between gap-2 border-b border-amber-100 pb-1.5 last:border-b-0">
                                                      <button onClick={() => handleSelectPage(um.id)} className="text-del-blue hover:underline text-left truncate flex-grow font-medium">
                                                          {um.title}
                                                      </button>
                                                      <button 
                                                          onClick={() => handleLinkUnlinkedMention(um)}
                                                          className="bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-sm whitespace-nowrap transition-colors"
                                                          title="Automatisch [[Link]] in dieser Notiz setzen"
                                                      >
                                                          + Link
                                                      </button>
                                                  </li>
                                              ))}
                                          </ul>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  )
              ) : (
                  <div className="flex-grow flex items-center justify-center text-gray-400 text-sm">
                      Select a page from the sidebar or create a new one.
                  </div>
              )}
          </div>

          {/* Insert Bookmark Modal */}
          {showInsertModal && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-sm shadow-lg w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                          <h3 className="font-bold text-lg text-gray-800">Insert Bookmark</h3>
                          <button onClick={() => setShowInsertModal(false)} className="text-gray-500 hover:text-black">✖</button>
                      </div>
                      
                      <div className="flex border-b border-gray-200 px-4 pt-2 bg-gray-50">
                          <button onClick={() => setInsertTab('existing')} className={`px-4 py-2 text-sm font-bold border-b-2 ${insertTab === 'existing' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Select Existing</button>
                          <button onClick={() => setInsertTab('new')} className={`px-4 py-2 text-sm font-bold border-b-2 ${insertTab === 'new' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Create New</button>
                      </div>

                      <div className="p-6 overflow-y-auto">
                          {insertTab === 'existing' && (
                              <div>
                                  <input 
                                      type="text" 
                                      className="w-full border border-gray-300 p-2 text-sm focus:border-del-blue outline-none rounded-sm mb-4" 
                                      placeholder="Search your bookmarks..." 
                                      value={searchInsertQuery}
                                      onChange={e => setSearchInsertQuery(e.target.value)}
                                  />
                                  <div className="space-y-2">
                                      {filteredExistingBookmarks.length === 0 ? (
                                          <div className="text-gray-500 text-sm">No bookmarks found.</div>
                                      ) : (
                                          filteredExistingBookmarks.map(bm => (
                                              <div key={bm.id} onClick={() => insertIntoEditor(`\n\n[[bookmark:${bm.id}]]\n\n`)} className="p-3 border border-gray-200 rounded-sm hover:border-del-blue cursor-pointer transition-colors bg-white group">
                                                  <div className="font-bold text-gray-800 group-hover:text-del-blue">{bm.title}</div>
                                                  {bm.url && <div className="text-xs text-gray-500 truncate">{bm.url}</div>}
                                              </div>
                                          ))
                                      )}
                                  </div>
                              </div>
                          )}

                          {insertTab === 'new' && (
                              <form onSubmit={handleCreateAndInsertBookmark} className="space-y-4">
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">URL (optional)</label>
                                      <input type="text" className="w-full border border-gray-300 p-2 text-sm focus:border-del-blue outline-none rounded-sm" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://" />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">Title</label>
                                      <input type="text" required className="w-full border border-gray-300 p-2 text-sm focus:border-del-blue outline-none rounded-sm" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-600 mb-1">Description (optional)</label>
                                      <textarea className="w-full border border-gray-300 p-2 text-sm focus:border-del-blue outline-none rounded-sm h-20" value={newDescription} onChange={e => setNewDescription(e.target.value)}></textarea>
                                  </div>
                                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                      <button type="button" onClick={() => setShowInsertModal(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-800">Cancel</button>
                                      <button type="submit" disabled={isCreating} className="px-4 py-2 bg-del-blue text-white text-sm font-bold rounded-sm hover:bg-del-dark-blue disabled:opacity-50">
                                          {isCreating ? 'Saving...' : 'Save & Insert'}
                                      </button>
                                  </div>
                              </form>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {/* Insert Wiki Page Link Modal */}
          {showPageLinkModal && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-sm shadow-lg w-full max-w-md border border-gray-200 flex flex-col max-h-[85vh]">
                      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                          <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                              <span>📄</span> Wikilink einfügen
                          </h3>
                          <button onClick={() => setShowPageLinkModal(false)} className="text-gray-500 hover:text-black">✖</button>
                      </div>
                      <div className="p-4 flex flex-col flex-grow overflow-hidden">
                          <input 
                              type="text" 
                              autoFocus
                              value={pageLinkSearch}
                              onChange={(e) => setPageLinkSearch(e.target.value)}
                              placeholder="Wikiseite suchen oder neu verlinken..."
                              className="w-full border border-gray-300 p-2 text-sm focus:border-del-blue outline-none rounded-sm mb-3"
                          />
                          <div className="flex-grow overflow-y-auto space-y-1 max-h-64">
                              {pages
                                  .filter(p => !pageLinkSearch || p.title.toLowerCase().includes(pageLinkSearch.toLowerCase()))
                                  .map(p => (
                                      <div 
                                          key={p.id}
                                          onClick={() => {
                                              insertIntoEditor(`[[${p.title}]]`);
                                              setShowPageLinkModal(false);
                                          }}
                                          className="p-2.5 rounded-sm border border-gray-100 hover:bg-blue-50 hover:border-del-blue cursor-pointer text-sm flex items-center justify-between group"
                                      >
                                          <span className="font-bold text-gray-800 group-hover:text-del-blue truncate">
                                              📄 {p.title}
                                          </span>
                                          <span className="text-[11px] text-gray-400 group-hover:text-del-blue font-mono">
                                              [[{p.title}]]
                                          </span>
                                      </div>
                                  ))
                              }
                              {pageLinkSearch.trim() && !pages.some(p => p.title.toLowerCase() === pageLinkSearch.trim().toLowerCase()) && (
                                  <div 
                                      onClick={() => {
                                          insertIntoEditor(`[[${pageLinkSearch.trim()}]]`);
                                          setShowPageLinkModal(false);
                                      }}
                                      className="p-2.5 rounded-sm border border-dashed border-del-blue/40 bg-blue-50/50 hover:bg-blue-100/70 cursor-pointer text-sm flex items-center justify-between"
                                  >
                                      <span className="text-del-blue font-bold truncate">
                                          + Neue Seite "[[{pageLinkSearch.trim()}]]" verlinken
                                      </span>
                                  </div>
                              )}
                          </div>
                          <div className="pt-3 border-t border-gray-100 flex justify-end">
                              <button 
                                  onClick={() => setShowPageLinkModal(false)}
                                  className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:text-black"
                              >
                                  Abbrechen
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* AI Assistant Modal */}
          {showAiModal && kmFeatures.ai && (
              <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-sm shadow-lg w-full max-w-lg border border-purple-200 flex flex-col">
                      <div className="p-4 border-b border-purple-100 flex justify-between items-center bg-purple-50">
                          <h3 className="font-bold text-lg text-purple-900 flex items-center gap-2"><span>✨</span> AI Writing Assistant</h3>
                          <button onClick={() => setShowAiModal(false)} className="text-purple-400 hover:text-purple-700">✖</button>
                      </div>
                      
                      <div className="p-6 space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-purple-800 mb-1">What should the AI do?</label>
                              <textarea 
                                  className="w-full border border-purple-200 p-3 text-sm rounded-sm focus:border-purple-500 outline-none min-h-[100px]"
                                  value={aiPrompt}
                                  onChange={e => setAiPrompt(e.target.value)}
                                  placeholder="E.g., Write a concise summary. Expand on the points I made above."
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAskAi();
                                  }}
                              ></textarea>
                          </div>
                          {aiError && <div className="text-red-500 text-xs">{aiError}</div>}
                          
                          <div className="flex justify-between items-center pt-2 border-t border-purple-50">
                              <span className="text-[10px] text-purple-400">Press Cmd/Ctrl+Enter to generate. Text will be inserted at cursor.</span>
                              <div className="flex gap-2">
                                  <button onClick={() => setShowAiModal(false)} className="px-4 py-2 text-sm font-bold text-purple-600 hover:text-purple-900">Cancel</button>
                                  <button 
                                      onClick={handleAskAi} 
                                      disabled={isAiLoading || !aiPrompt.trim()} 
                                      className="px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-sm hover:bg-purple-700 disabled:opacity-50"
                                  >
                                      {isAiLoading ? 'Generating...' : 'Generate & Insert'}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

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
