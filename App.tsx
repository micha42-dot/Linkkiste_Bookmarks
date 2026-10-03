import React, { useEffect, useState, Suspense, lazy } from 'react';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { BookmarkList } from './components/BookmarkList';
import { BookmarkDetail } from './components/BookmarkDetail';
import { AddBookmark } from './components/AddBookmark';






import { QuickCapture } from './components/QuickCapture';

import { EnabledTabsConfig } from './components/Layout';

import { NewBookmark, ViewMode } from './types';
import { Session } from '@supabase/supabase-js';
import { useBookmarks } from './hooks/useBookmarks';
import { sanitizeUrl, sanitizeInput, isWikiBookmark, isNoteBookmark } from './utils/helpers';

// Lazy-loaded heavy components for faster initial load
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const AIAsk = lazy(() => import('./components/AIAsk').then(m => ({ default: m.AIAsk })));
const WikiView = lazy(() => import('./components/WikiView').then(m => ({ default: m.WikiView })));
const SqlHelp = lazy(() => import('./components/SqlHelp').then(m => ({ default: m.SqlHelp })));
const About = lazy(() => import('./components/StaticPages').then(m => ({ default: m.About })));
const Terms = lazy(() => import('./components/StaticPages').then(m => ({ default: m.Terms })));
const Privacy = lazy(() => import('./components/StaticPages').then(m => ({ default: m.Privacy })));
const NotesView = lazy(() => import('./components/NotesView').then(m => ({ default: m.NotesView })));
const KeyboardShortcutsModal = lazy(() => import('./components/KeyboardShortcutsModal').then(m => ({ default: m.KeyboardShortcutsModal })));

const MemoBookmarkList = React.memo(BookmarkList);
const MemoAIAsk = React.memo(AIAsk);
const MemoWikiView = React.memo(WikiView);
const MemoNotesView = React.memo(NotesView);



const KeepMounted: React.FC<{ show: boolean; children: React.ReactNode }> = ({ show, children }) => {
  const [mounted, setMounted] = React.useState(show);
  React.useEffect(() => {
    if (show && !mounted) setMounted(true);
  }, [show, mounted]);
  if (!mounted) return null;
  return <div style={{ display: show ? 'block' : 'none', height: '100%' }}>{children}</div>;
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterFolder, setFilterFolder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [showSqlHelpInMenu, setShowSqlHelpInMenu] = useState(() => localStorage.getItem('hk_show_sql_help') !== 'false');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<number | null>(null);
  // UI Preferences
  const [usePagination, setUsePagination] = useState(() => {
      const stored = localStorage.getItem('hk_use_pagination');
      return stored !== null ? stored === 'true' : true;
  });
  const [showWikiInList, setShowWikiInList] = useState(() => {
      const stored = localStorage.getItem('hk_show_wiki_in_list');
      return stored !== null ? stored === 'true' : true;
  });
  const [showNotesInList, setShowNotesInList] = useState(() => {
      const stored = localStorage.getItem('hk_show_notes_in_list');
      return stored !== null ? stored === 'true' : true;
  });
  const [showQuickCapture, setShowQuickCapture] = useState(() => {
      const stored = localStorage.getItem('hk_show_quick_capture');
      return stored !== null ? stored === 'true' : true;
  });
  const [quickCaptureDefaultTag, setQuickCaptureDefaultTag] = useState(() => {
      return localStorage.getItem('hk_qc_default_tag') || 'inbox';
  });
  const [quickCaptureNotePrefix, setQuickCaptureNotePrefix] = useState(() => {
      return localStorage.getItem('hk_qc_note_prefix') || 'Note:';
  });
  const [quickCaptureAlwaysNote, setQuickCaptureAlwaysNote] = useState(() => {
      return localStorage.getItem('hk_qc_always_note') === 'true';
  });
  const [enabledTabs, setEnabledTabs] = useState<EnabledTabsConfig>(() => {
      const stored = localStorage.getItem('hk_enabled_tabs');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // ignore
        }
      }
      return {
        list: true,
        notes: true,
        wiki: true,
        unread: true,
        folders: true,
        tags: true,
        ai: true,
        add: true
      };
  });
  const [paginationResetTrigger, setPaginationResetTrigger] = useState(0);
  const [kmFeatures, setKmFeatures] = useState(() => {
      const stored = localStorage.getItem('hk_km_features');
      return stored ? JSON.parse(stored) : { wiki: true, ai: true };
  });
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [defaultAiQueryModel, setDefaultAiQueryModel] = useState('');
  const [defaultWikiModel, setDefaultWikiModel] = useState('');
  const [clippingLanguage, setClippingLanguage] = useState(() => localStorage.getItem('hk_clipping_language') || '');
  // Extension / Popup State
  const [isPopupMode, setIsPopupMode] = useState(false);
  const [initialBookmarkData, setInitialBookmarkData] = useState<{url: string, title: string} | null>(null);
  
  // Fetch AI settings from Supabase
  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.user) return;
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (data) {
        if (data.ai_api_key) setOpenRouterKey(data.ai_api_key);
        if (data.ai_base_url) setAiBaseUrl(data.ai_base_url);
        if (data.ai_query_model) setDefaultAiQueryModel(data.ai_query_model);
        if (data.wiki_model) setDefaultWikiModel(data.wiki_model);
      }
    };
    fetchSettings();
  }, [session]);

  const updateSettingInDB = async (updates: any) => {
    if (!session?.user) return;
    try {
      const { data } = await supabase.from('user_settings').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (data) {
        await supabase.from('user_settings').update(updates).eq('user_id', session.user.id);
      } else {
        await supabase.from('user_settings').insert([{ user_id: session.user.id, ...updates }]);
      }
    } catch (err) {
      console.error("Failed to save setting to Supabase", err);
    }
  };

  // Custom Hook for Data Logic
  const { 
      bookmarks, 
      loading, 
      isRefreshing, 
      fetchBookmarks, 
      addBookmark, 
      updateBookmark, 
      deleteBookmark, 
      toggleReadStatus, 
      saveNotes,
      addFolder,
      removeFolder,
      deleteEntireFolder,
      addTag,
      removeTag,
      allFolders,
      existingUrls
  } = useBookmarks(session);
  // --------------------------------------------------------------------------
  // URL ROUTING & NAVIGATION
  // --------------------------------------------------------------------------
  // Central handler for view changes that also updates URL
  const handleNavigate = (newView: ViewMode) => {
    React.startTransition(() => {
        setView(newView);
        setFilterTag(null);
        setFilterFolder(null);
        setInitialBookmarkData(null);
        setSelectedBookmarkId(null); // Clear detail view if active
    });
    // Calculate new URL
    let newUrl = window.location.pathname;
    const params = new URLSearchParams();
    if (newView !== 'list') {
        params.set('view', newView);
    }
    const queryString = params.toString();
    if (queryString) newUrl += `?${queryString}`;
    // Only push if URL is different to avoid duplicate history entries
    const currentSearch = window.location.search;
    const targetSearch = queryString ? `?${queryString}` : '';
    if (currentSearch !== targetSearch) {
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Central function to parse URL and set state accordingly
  const syncStateWithUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      const urlParam = params.get('url');
      const titleParam = params.get('title');
      const idParam = params.get('id');
      const tagParam = params.get('tag');
      const folderParam = params.get('folder');
      const viewParam = params.get('view');
      const searchParam = params.get('q');
      if (searchParam) {
          setSearchTerm(searchParam);
          setView('list');
          return;
      } else {
          setSearchTerm('');
      }
      // 1. Popup / Extension Mode
      if (modeParam === 'popup') {
          setIsPopupMode(true);
          document.body.classList.add('popup-mode');
      }
      // 2. Add New Bookmark (via Share Target or Extension)
      if (urlParam) {
          const cleanUrl = sanitizeUrl(urlParam);
          const cleanTitle = sanitizeInput(titleParam || urlParam);
          setInitialBookmarkData({ url: cleanUrl, title: cleanTitle });
          setView('add');
          // We don't clean URL in add mode to allow refresh
          return; 
      }
      // 3. Detail View (Permalink)
      if (idParam) {
          const id = parseInt(idParam, 10);
          if (!isNaN(id)) {
              setSelectedBookmarkId(id);
              setView('detail');
              return;
          }
      } else {
          // If we were in detail view but ID is gone, assume list
          if (view === 'detail') setSelectedBookmarkId(null);
      }
      // 4. Filters (Tags & Folders)
      if (tagParam) {
          setFilterTag(tagParam);
          setFilterFolder(null);
          setView('list');
          return;
      } 
      if (folderParam) {
          setFilterFolder(folderParam);
          setFilterTag(null);
          setView('list');
          return;
      }
      // 5. Explicit View (Permalink pages)
      if (viewParam) {
         if (['list', 'notes', 'add', 'tags', 'folders', 'settings', 'unread', 'about', 'terms', 'privacy', 'ai', 'wiki'].includes(viewParam)) {
             setView(viewParam as ViewMode);
             setFilterTag(null);
             setFilterFolder(null);
             return;
         }
      }
      // Default
      setFilterTag(null);
      setFilterFolder(null);
      // Default to list view if we are at root and not in specific UI states
      if (window.location.pathname === '/' && !urlParam && !idParam && !viewParam) {
          setView('list');
      }
  };
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Load Preferences
    const storedPagination = localStorage.getItem('linkkiste_use_pagination');
    if (storedPagination !== null) {
        setUsePagination(storedPagination === 'true');
    }
    const storedWiki = localStorage.getItem('linkkiste_enable_wiki');
    const storedAI = localStorage.getItem('linkkiste_enable_ai');
    setKmFeatures({
        wiki: storedWiki !== 'false', // Default to true if not set explicitly to false
        ai: storedAI !== 'false'
    });
    // Initial Sync
    syncStateWithUrl();
    // Listen for PopState (Back/Forward buttons)
    window.addEventListener('popstate', syncStateWithUrl);
    // Auth Listeners
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    // Custom Event Listener for View Changes (Internal)
    // Now calls handleNavigate to ensure URL updates
    const handleViewChange = (e: any) => handleNavigate(e.detail);
    window.addEventListener('changeView', handleViewChange);
    return () => {
        subscription.unsubscribe();
        window.removeEventListener('changeView', handleViewChange);
        window.removeEventListener('popstate', syncStateWithUrl);
    };
  }, [isSupabaseConfigured]);
  // Tab Navigation Fallback when an active tab gets disabled
  useEffect(() => {
    if (enabledTabs && enabledTabs[view as keyof EnabledTabsConfig] === false) {
      const tabOrder: (keyof EnabledTabsConfig)[] = ['list', 'notes', 'wiki', 'unread', 'folders', 'tags', 'ai', 'add'];
      const fallback = tabOrder.find(t => enabledTabs[t] !== false) || 'list';
      handleNavigate(fallback);
    }
  }, [enabledTabs, view]);
  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is focused inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }
      // Ignore when meta/ctrl/alt are held, except for specific combos
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if (e.key === '/' || key === 's') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
          searchInput.focus();
          (searchInput as HTMLInputElement).select();
        }
      } else if (key === 'n') {
        e.preventDefault();
        handleNavigate('notes');
      } else if (key === 'w' && enabledTabs?.wiki !== false && kmFeatures.wiki) {
        e.preventDefault();
        handleNavigate('wiki');
      } else if (key === 'b') {
        e.preventDefault();
        handleNavigate('list');
      } else if (key === 'u') {
        e.preventDefault();
        handleNavigate('unread');
      } else if (key === 'f') {
        e.preventDefault();
        handleNavigate('folders');
      } else if (key === 't') {
        e.preventDefault();
        handleNavigate('tags');
      } else if (key === 'a' && enabledTabs?.ai !== false && kmFeatures.ai) {
        e.preventDefault();
        handleNavigate('ai');
      } else if (e.key === '+') {
        e.preventDefault();
        handleNavigate('add');
      } else if (e.key === 'Escape') {
        setShowShortcutsModal(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [kmFeatures, handleNavigate]);
  // PWA/Mobile Lifecycle
  useEffect(() => {
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && session?.user) {
              fetchBookmarks(true);
          }
      };
      const handleWindowFocus = () => session?.user && fetchBookmarks(true);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleWindowFocus);
      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', handleWindowFocus);
      };
  }, [session, fetchBookmarks]);
  const handleSetPagination = (enabled: boolean) => {
      setUsePagination(enabled);
      localStorage.setItem('linkkiste_use_pagination', String(enabled));
  };
  const handleLogoClick = () => {
      // Logo click always goes to clean root
      setView('list');
      setFilterTag(null);
      setFilterFolder(null);
      setSearchTerm('');
      setPaginationResetTrigger(prev => prev + 1);
      window.history.pushState({}, '', window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  const handleSaveWrapper = async (newBm: NewBookmark) => {
      try {
          await addBookmark(newBm);
          if (isPopupMode) {
            setInitialBookmarkData(null);
            setView('list'); 
          } else {
            // Go back to list and clean URL
            setView('list');
            window.history.pushState({}, '', window.location.pathname);
          }
      } catch(e: any) {
          alert(`Error saving: ${e.message}`);
      }
  };
  const handleArchiveBookmark = async (id: number, url: string) => {
      const baseUrl = localStorage.getItem('linkkiste_archive_base') || 'https://archive.is';
      const archiveUrl = `${baseUrl}/newest/${url}`;
      window.open(`${baseUrl}/?run=1&url=${encodeURIComponent(url)}`, '_blank');
      await updateBookmark(id, { archive_url: archiveUrl });
  };
  const handleSetFilterTag = (tag: string | null) => {
    setFilterTag(tag);
    if (tag) {
        setFilterFolder(null);
        if (['tags','unread','folders','detail'].includes(view)) setView('list');
        // Push State
        const newUrl = `?tag=${encodeURIComponent(tag)}`;
        window.history.pushState({path: newUrl}, '', newUrl);
        window.scrollTo(0, 0);
    } else {
        // Clearing tag usually means going back to root list
        window.history.pushState({}, '', window.location.pathname);
    }
  };
  const handleSetFilterFolder = (folder: string | null) => {
      setFilterFolder(folder);
      if (folder) {
          setFilterTag(null);
          setView('list');
          // Push State
          const newUrl = `?folder=${encodeURIComponent(folder)}`;
          window.history.pushState({path: newUrl}, '', newUrl);
          window.scrollTo(0, 0);
      } else {
          window.history.pushState({}, '', window.location.pathname);
      }
  };
  const handleViewDetail = (id: number, forceDetail?: boolean) => {
      const bm = bookmarks.find(b => b.id === id);
      // If user explicitly clicked "permalink", always show the single bookmark detail view
      if (!forceDetail && bm && isWikiBookmark(bm)) {
          setView('wiki');
          window.scrollTo(0, 0);
          window.history.pushState({}, '', `?view=wiki&page=${id}`);
          window.dispatchEvent(new CustomEvent('selectWikiPage', { detail: id }));
          return;
      }
      setSelectedBookmarkId(id);
      setView('detail');
      window.scrollTo(0, 0);
      // Update URL
      const newUrl = `?id=${id}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
  };
  const handleCloseDetail = () => {
      setView('list');
      setSelectedBookmarkId(null);
      // Clean URL back to root
      window.history.pushState({}, '', window.location.pathname);
  };
  const handleUpdateFolderDelete = async (folder: string) => {
      await deleteEntireFolder(folder);
      if (filterFolder === folder) {
          setFilterFolder(null);
          window.history.pushState({}, '', window.location.pathname);
      }
  }
  // Filtering Logic
  const wikiTitles = React.useMemo(() => Array.from(
    new Set(bookmarks.map(b => b.title).filter(t => t && t.trim().length > 0))
  ).sort(), [bookmarks]);

  const displayedBookmarks = React.useMemo(() => {
    const isUnread = view === 'unread';
    const term = searchTerm.trim().toLowerCase();
    const isWithoutTagFilter = filterTag === '___WITHOUT_TAG___' || filterTag?.toLowerCase() === 'without tag' || filterTag?.toLowerCase() === 'without-tag' || filterTag?.toLowerCase() === 'ohne tag';
    
    return bookmarks.filter(b => {
      const isWiki = isWikiBookmark(b);
      const isNote = isNoteBookmark(b);
      // We apply list-specific filters (like hiding wikis) ALWAYS for the list view components, regardless of the global view state
      const matchesShowWiki = !showWikiInList ? !isWiki : true;
      const matchesShowNotes = !showNotesInList ? !isNote : true;
      
      const matchesView = isUnread ? b.to_read : true;
      const matchesTag = filterTag 
        ? (isWithoutTagFilter ? (!b.tags || b.tags.length === 0) : (b.tags && b.tags.includes(filterTag))) 
        : true;
      const matchesFolder = filterFolder ? (b.folders && b.folders.includes(filterFolder)) : true;
      const matchesSearch = !term || 
        b.title.toLowerCase().includes(term) || 
        (b.url && b.url.toLowerCase().includes(term)) ||
        (b.description && b.description.toLowerCase().includes(term)) ||
        (b.notes && b.notes.toLowerCase().includes(term)) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(term))) ||
        (b.folders && b.folders.some(f => f.toLowerCase().includes(term)));
      return matchesShowWiki && matchesShowNotes && matchesView && matchesTag && matchesFolder && matchesSearch;
  });
}, [bookmarks, view, showWikiInList, showNotesInList, filterTag, filterFolder, searchTerm]);
  const selectedBookmark = bookmarks.find(b => b.id === selectedBookmarkId);
  // --------------------------------------------------------------------------
  // DB CONFIG CHECK
  // --------------------------------------------------------------------------
  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans p-8 text-center">
          <div className="max-w-xl bg-white p-8 border border-gray-200 shadow-sm rounded">
            <h1 className="text-xl font-bold text-red-600 mb-4">Connect your Database</h1>
            <p className="mb-6 text-sm text-gray-700">Missing credentials.</p>
          </div>
      </div>
    );
  }
  // --------------------------------------------------------------------------
  // POPUP UI
  // --------------------------------------------------------------------------
  if (isPopupMode) {
      if (!session) return <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4"><Auth isPopup={true} /></div>;
      if (view === 'list' && !initialBookmarkData) {
          return (
              <div className="h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 p-6 text-center">
                  <div className="text-5xl mb-4 text-green-600">✓</div>
                  <h2 className="font-bold text-xl mb-1">Saved</h2>
                  <div className="mt-8"><button onClick={() => window.close()} className="text-xs underline hover:no-underline">Close window</button></div>
              </div>
          );
      }
      return (
          <div className="min-h-screen bg-white px-5 py-4">
               <AddBookmark 
                  onSave={handleSaveWrapper}
                  onCancel={() => window.close()}
                  initialUrl={initialBookmarkData?.url}
                  initialTitle={initialBookmarkData?.title}
                   
                  existingUrls={existingUrls}
                  isPopup={true}
                />
          </div>
      );
  }
  if (!session) return <Auth />;
  
  return (
    <Layout 
      userEmail={session.user.email} 
      onLogout={handleLogout}
      currentView={view}
      setView={handleNavigate}
      
      
      setSearchTerm={setSearchTerm}
      onLogoClick={handleLogoClick}
      kmFeatures={kmFeatures}
      enabledTabs={enabledTabs}
      onOpenShortcuts={() => setShowShortcutsModal(true)}
    >
      <Suspense fallback={
        <div className="flex justify-center items-center p-24">
            <svg className="animate-spin h-8 w-8 text-del-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>
      }>
      {/* Quick Capture Box on List / Dashboard Views */}
      {(view === 'list' || view === 'unread') && showQuickCapture && (
        <div className="mb-6">
          <QuickCapture 
            onAddBookmark={addBookmark}
            onCreateWikiPage={async (title, notes) => {
              const newPage = await addBookmark({
                title,
                url: '',
                description: '',
                tags: [quickCaptureDefaultTag || 'quick-note'],
                folders: [],
                to_read: false
              });
              if (notes) {
                await updateBookmark(newPage.id, { notes });
              }
              return newPage;
            }}
            defaultTag={quickCaptureDefaultTag}
            notePrefix={quickCaptureNotePrefix}
            alwaysNote={quickCaptureAlwaysNote}
            wikiTitles={wikiTitles}
          />
        </div>
      )}
      <KeepMounted show={view === 'list' || view === 'tags' || view === 'folders' || view === 'unread'}>
          <MemoBookmarkList 
            bookmarks={displayedBookmarks}
            loading={loading}
            
            onDelete={deleteBookmark}
            onToggleRead={toggleReadStatus}
            filterTag={filterTag}
            setFilterTag={handleSetFilterTag}
            filterFolder={filterFolder}
            setFilterFolder={handleSetFilterFolder}
            onAddFolder={addFolder}
            
            onDeleteFolder={deleteEntireFolder}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            
            viewMode={view}
            searchTerm={searchTerm}
            isRefreshing={isRefreshing}
            onRefresh={() => fetchBookmarks(true)}
            onSelectBookmark={(id) => {
                setSelectedBookmarkId(id);
                setView('detail');
            }}
            usePagination={usePagination}
            paginationResetTrigger={paginationResetTrigger}
            showWikiInList={showWikiInList}
            showNotesInList={showNotesInList}
            kmFeatures={kmFeatures}
            enabledTabs={enabledTabs}
          />
      </KeepMounted>
      <KeepMounted show={view === 'ai' && kmFeatures.ai && enabledTabs?.ai !== false}>
        <MemoAIAsk 
            bookmarks={bookmarks} 
            openRouterKey={openRouterKey}
            aiBaseUrl={aiBaseUrl}
            defaultAiQueryModel={defaultAiQueryModel}
            onNodeClick={(id) => {
                setSelectedBookmarkId(id);
                setView('detail');
            }}
        />
      </KeepMounted>
      <KeepMounted show={view === 'wiki' && kmFeatures.wiki && enabledTabs?.wiki !== false}>
        <MemoWikiView
            bookmarks={bookmarks}
            onAddBookmark={addBookmark}
            onUpdateBookmark={updateBookmark}
            onViewDetail={handleViewDetail}
            /*onCreateWikiPage={async (title, content) => {
                const newPage = await addBookmark({
                    title: title,
                    url: '',
                    description: '',
                    notes: content || '',
                    tags: ['wiki'],
                    folders: [],
                    to_read: false
                });
                return newPage;
            }}*/
            openRouterKey={openRouterKey}
            aiBaseUrl={aiBaseUrl}
            defaultWikiModel={defaultWikiModel}
        />
      </KeepMounted>
      <KeepMounted show={view === 'notes' && !!enabledTabs.notes}>
        <MemoNotesView
            bookmarks={bookmarks}
            onAddBookmark={addBookmark}
            onUpdateBookmark={updateBookmark}
            onDeleteBookmark={deleteBookmark}
         />
      </KeepMounted>
      {(view as string) === 'sql' && showSqlHelp && (
          <SqlHelp isOpen={true} onToggle={() => {}} />
      )}
      {view === 'detail' && (
          selectedBookmark ? (() => {
              const backlinks = bookmarks.filter(b => {
                 if (b.id === selectedBookmark.id) return false;
                 if (isWikiBookmark(selectedBookmark) && b.notes && b.notes.includes(`[[${selectedBookmark.title}]]`)) return true;
                 if (b.notes && selectedBookmark.url && b.notes.includes(selectedBookmark.url)) return true;
                 return false;
              });
              return (
                <BookmarkDetail 
                    bookmark={selectedBookmark}
                    backlinks={backlinks}
                    onSaveNotes={saveNotes}
                    onUpdate={(id, data) => updateBookmark(id, data)}
                    onArchive={handleArchiveBookmark}
                    allFolders={allFolders}
                    onClose={handleCloseDetail}
                    onDelete={deleteBookmark}
                    onToggleRead={toggleReadStatus}
                    onFilterTag={handleSetFilterTag}
                    onFilterFolder={handleSetFilterFolder}
                />
              );
          })() : (
            <div className="flex flex-col items-center justify-center py-20">
                {loading ? (
                    <div className="animate-spin text-yellow-500 text-4xl mb-4" style={{ lineHeight: '0.7' }}>*</div>
                ) : (
                    <>
                        <h2 className="text-xl font-bold text-gray-400 mb-2">Bookmark not found</h2>
                        <button onClick={handleCloseDetail} className="text-del-blue hover:underline">Return to list</button>
                    </>
                )}
            </div>
          )
      )}
      {view === 'add' && (
        <AddBookmark 
          onSave={handleSaveWrapper}
          onCancel={() => {
              setView('list');
              setInitialBookmarkData(null);
              window.history.pushState({}, '', window.location.pathname);
          }}
          initialUrl={initialBookmarkData?.url}
          initialTitle={initialBookmarkData?.title}
          allFolders={allFolders}
          existingUrls={existingUrls} 
        />
      )}
      {view === 'settings' && (
        <Settings 
            session={session} 
            bookmarks={bookmarks}
            onBookmarksUpdated={() => fetchBookmarks(true)}
            usePagination={usePagination}
            onTogglePagination={handleSetPagination}
            showWikiInList={showWikiInList}
            onToggleShowWikiInList={(enabled) => {
                setShowWikiInList(enabled);
                localStorage.setItem('hk_show_wiki_in_list', enabled ? 'true' : 'false');
            }}
            showNotesInList={showNotesInList}
            onToggleShowNotesInList={(enabled) => {
                setShowNotesInList(enabled);
                localStorage.setItem('hk_show_notes_in_list', enabled ? 'true' : 'false');
            }}
            showQuickCapture={showQuickCapture}
            onToggleShowQuickCapture={(enabled) => {
                setShowQuickCapture(enabled);
                localStorage.setItem('hk_show_quick_capture', enabled ? 'true' : 'false');
            }}
            quickCaptureDefaultTag={quickCaptureDefaultTag}
            onChangeQuickCaptureDefaultTag={(tag) => {
                setQuickCaptureDefaultTag(tag);
                localStorage.setItem('hk_qc_default_tag', tag);
            }}
            quickCaptureNotePrefix={quickCaptureNotePrefix}
            onChangeQuickCaptureNotePrefix={(prefix) => {
                setQuickCaptureNotePrefix(prefix);
                localStorage.setItem('hk_qc_note_prefix', prefix);
            }}
            quickCaptureAlwaysNote={quickCaptureAlwaysNote}
            onToggleQuickCaptureAlwaysNote={(always) => {
                setQuickCaptureAlwaysNote(always);
                localStorage.setItem('hk_qc_always_note', always ? 'true' : 'false');
            }}
            enabledTabs={enabledTabs}
            onToggleTab={(tab, isEnabled) => {
                const updated = { ...enabledTabs, [tab]: isEnabled };
                setEnabledTabs(updated);
                localStorage.setItem('hk_enabled_tabs', JSON.stringify(updated));
                if (tab === 'wiki' || tab === 'ai') {
                    const updatedKm = { ...kmFeatures, [tab]: isEnabled };
                    setKmFeatures(updatedKm);
                    localStorage.setItem('hk_km_features', JSON.stringify(updatedKm));
                }
            }}
            kmFeatures={kmFeatures}
            onToggleKmFeature={(feature, isEnabled) => {
                const updated = { ...kmFeatures, [feature]: isEnabled };
                setKmFeatures(updated);
                localStorage.setItem('hk_km_features', JSON.stringify(updated));
                const updatedTabs = { ...enabledTabs, [feature]: isEnabled };
                setEnabledTabs(updatedTabs);
                localStorage.setItem('hk_enabled_tabs', JSON.stringify(updatedTabs));
            }}
            showSqlHelpInMenu={showSqlHelpInMenu}
            onToggleShowSqlHelpInMenu={(enabled) => {
                setShowSqlHelpInMenu(enabled);
                localStorage.setItem('hk_show_sql_help', enabled ? 'true' : 'false');
            }}
            openRouterKey={openRouterKey}
            setOpenRouterKey={(key) => {
                setOpenRouterKey(key);
                if (key) localStorage.setItem('hk_openrouter_key', key);
                else localStorage.removeItem('hk_openrouter_key');
            }}
            aiBaseUrl={aiBaseUrl}
            setAiBaseUrl={(url) => {
                setAiBaseUrl(url);
                if (url) localStorage.setItem('hk_ai_base_url', url);
                else localStorage.removeItem('hk_ai_base_url');
            }}
            defaultAiQueryModel={defaultAiQueryModel}
            setDefaultAiQueryModel={(model) => {
                setDefaultAiQueryModel(model);
                if (model) localStorage.setItem('hk_ai_query_model', model);
                else localStorage.removeItem('hk_ai_query_model');
            }}
            defaultWikiModel={defaultWikiModel}
            setDefaultWikiModel={(model) => {
                setDefaultWikiModel(model);
                if (model) localStorage.setItem('hk_wiki_model', model);
                else localStorage.removeItem('hk_wiki_model');
            }}
            clippingLanguage={clippingLanguage}
            setClippingLanguage={(lang) => {
                setClippingLanguage(lang);
                if (lang) localStorage.setItem('hk_clipping_lang', lang);
                else localStorage.removeItem('hk_clipping_lang');
            }}
        />
      )}
      {view === 'about' && <About />}
      {view === 'terms' && <Terms />}
      {view === 'privacy' && <Privacy />}
      
      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
      </Suspense>
    </Layout>
  );
};

export default App;