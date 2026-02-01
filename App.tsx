import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { BookmarkList } from './components/BookmarkList';
import { BookmarkDetail } from './components/BookmarkDetail';
import { AddBookmark } from './components/AddBookmark';
import { Settings } from './components/Settings';
import { SqlHelp } from './components/SqlHelp';
import { About, Terms, Privacy } from './components/StaticPages';
import { NewBookmark, ViewMode } from './types';
import { Session } from '@supabase/supabase-js';
import { useBookmarks } from './hooks/useBookmarks';
import { sanitizeUrl, sanitizeInput } from './utils/helpers';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterFolder, setFilterFolder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<number | null>(null);
  
  // UI Preferences
  const [usePagination, setUsePagination] = useState(true);
  // Pagination State (Lifted from BookmarkList for permalinks)
  const [currentPage, setCurrentPage] = useState(1);

  // Extension / Popup State
  const [isPopupMode, setIsPopupMode] = useState(false);
  const [initialBookmarkData, setInitialBookmarkData] = useState<{url: string, title: string} | null>(null);

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
      allFolders,
      existingUrls
  } = useBookmarks(session);

  // Helper to sync URL with State (Permalinks)
  // resetOthers: if true, clears 'mutually exclusive' view params (like switching from tag to folder)
  const syncUrl = (params: Record<string, string | null>, resetOthers: boolean = true) => {
      if (isPopupMode) return; 
      
      const url = new URL(window.location.href);
      
      if (resetOthers) {
          // Reset main view params, but also 'p' because new view usually starts at page 1
          ['id', 'tag', 'folder', 'page', 'p'].forEach(k => url.searchParams.delete(k));
      }

      // Set new params
      Object.entries(params).forEach(([key, value]) => {
          if (value) url.searchParams.set(key, value);
          else url.searchParams.delete(key);
      });
      
      window.history.pushState({}, '', url);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Load Preferences
    const storedPagination = localStorage.getItem('linkkiste_use_pagination');
    if (storedPagination !== null) {
        setUsePagination(storedPagination === 'true');
    }

    // 1. Check URL params
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const urlParam = params.get('url');
    const titleParam = params.get('title');
    
    // Permalink Params
    const idParam = params.get('id');
    const tagParam = params.get('tag');
    const folderParam = params.get('folder');
    const pageParam = params.get('page'); // View page (about, etc)
    const pParam = params.get('p');       // Pagination page

    if (modeParam === 'popup') {
        setIsPopupMode(true);
        document.body.classList.add('popup-mode');
    }

    if (urlParam) {
      const cleanUrl = sanitizeUrl(urlParam);
      const cleanTitle = sanitizeInput(titleParam || urlParam);
      setInitialBookmarkData({ url: cleanUrl, title: cleanTitle });
      setView('add');
      
      if (modeParam !== 'popup') {
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({path: newUrl}, '', newUrl);
      }
    } else if (idParam) {
        setSelectedBookmarkId(Number(idParam));
        setView('detail');
    } else if (tagParam) {
        setFilterTag(sanitizeInput(tagParam));
        setView('list');
    } else if (folderParam) {
        setFilterFolder(sanitizeInput(folderParam));
        setView('list');
    } else if (pageParam && ['about', 'terms', 'privacy', 'settings'].includes(pageParam)) {
        setView(pageParam as ViewMode);
    }
    
    // Pagination (modifier for list view)
    if (pParam) {
        setCurrentPage(Number(pParam));
    }

    // Auth Listeners
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));

    // Custom Event Listener
    const handleViewChange = (e: any) => setView(e.detail);
    window.addEventListener('changeView', handleViewChange);
    
    // Browser Back Button Listener (Popstate)
    const handlePopState = () => {
        const p = new URLSearchParams(window.location.search);
        const pId = p.get('id');
        const pTag = p.get('tag');
        const pFolder = p.get('folder');
        const pPage = p.get('page');
        const pPageNum = p.get('p');

        // Restore Pagination
        setCurrentPage(pPageNum ? Number(pPageNum) : 1);

        if (pId) {
            setSelectedBookmarkId(Number(pId));
            setView('detail');
        } else if (pTag) {
            setFilterTag(pTag);
            setFilterFolder(null);
            setView('list');
        } else if (pFolder) {
            setFilterFolder(pFolder);
            setFilterTag(null);
            setView('list');
        } else if (pPage) {
            setView(pPage as ViewMode);
            setFilterTag(null);
            setFilterFolder(null);
            setSelectedBookmarkId(null);
        } else {
            // Reset to root
            setFilterTag(null);
            setFilterFolder(null);
            setSelectedBookmarkId(null);
            if (view === 'detail') setView('list');
            else setView('list');
        }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
        subscription.unsubscribe();
        window.removeEventListener('changeView', handleViewChange);
        window.removeEventListener('popstate', handlePopState);
    };
  }, [isSupabaseConfigured]);

  // Reset pagination when filters or data significantly change
  // (Mimics the previous useEffect behavior inside BookmarkList)
  useEffect(() => {
    // Only reset if we are not reading from URL initially (handled by mount effect)
    // But this runs on updates. If user clicks a tag, filterTag changes -> reset to page 1.
    // If user clicks page 2, only currentPage changes -> this effect doesn't run.
    setCurrentPage(1);
  }, [filterTag, filterFolder, searchTerm, view, bookmarks.length]);

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
      setView('list');
      setFilterTag(null);
      setFilterFolder(null);
      setSearchTerm('');
      setCurrentPage(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      syncUrl({}); // Clear permalinks
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
            setView('list');
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
        syncUrl({ tag }); // resetOthers=true by default, clears page/folder
    } else {
        syncUrl({});
    }
  };

  const handleSetFilterFolder = (folder: string | null) => {
      setFilterFolder(folder);
      if (folder) {
          setFilterTag(null);
          setView('list');
          syncUrl({ folder }); // resetOthers=true, clears tag/page
      } else {
          syncUrl({});
      }
  };

  const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
      // Update URL without clearing other params (like tag/folder)
      syncUrl({ p: String(newPage) }, false);
  };

  const handleViewDetail = (id: number) => {
      setSelectedBookmarkId(id);
      setView('detail');
      window.scrollTo(0, 0);
      syncUrl({ id: String(id) });
  };

  const handleUpdateFolderDelete = async (folder: string) => {
      await deleteEntireFolder(folder);
      if (filterFolder === folder) {
          setFilterFolder(null);
          syncUrl({});
      }
  }

  // Filtering Logic
  const displayedBookmarks = bookmarks.filter(b => {
      const matchesView = view === 'unread' ? b.to_read : true;
      const matchesTag = filterTag ? (b.tags && b.tags.includes(filterTag)) : true;
      const matchesFolder = filterFolder ? (b.folders && b.folders.includes(filterFolder)) : true;
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        b.title.toLowerCase().includes(term) || 
        b.url.toLowerCase().includes(term) ||
        (b.description && b.description.toLowerCase().includes(term)) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(term))) ||
        (b.folders && b.folders.some(f => f.toLowerCase().includes(term)));
      
      return matchesView && matchesTag && matchesFolder && matchesSearch;
  });

  const selectedBookmark = bookmarks.find(b => b.id === selectedBookmarkId);

  // --------------------------------------------------------------------------
  // DB CONFIG CHECK
  // --------------------------------------------------------------------------
  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans p-8 text-center">
          <div className="max-w-xl bg-white p-8 border border-gray-200 shadow-sm rounded">
            <h1 className="text-xl font-bold text-red-600 mb-4">Connect your Database</h1>
            <p className="mb-6 text-sm text-gray-700">
                The application is ready, but it is missing the credentials for your Supabase database.
            </p>
            
            <div className="text-left bg-gray-50 p-6 border border-gray-200 rounded text-sm mb-6">
                <h3 className="font-bold text-gray-900 mb-2">How to fix this:</h3>
                <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                    <li>Create a file named <code>.env</code> in the root directory (for local dev).</li>
                    <li>Add the following content (replace values with your Supabase keys):</li>
                </ol>
                <div className="mt-4 p-3 bg-gray-800 text-gray-100 font-mono text-xs rounded overflow-x-auto">
                    VITE_SUPABASE_URL=https://your-project.supabase.co<br/>
                    VITE_SUPABASE_ANON_KEY=your-long-anon-key-string
                </div>
            </div>

            <div className="text-left bg-blue-50 p-4 border border-blue-100 rounded text-xs text-blue-800 mb-4">
                <p><strong>Deployment (Vercel/Cloudflare):</strong></p>
                <p>Add these variables in your project settings under "Environment Variables".</p>
            </div>

            <div className="text-left bg-yellow-50 p-4 border border-yellow-200 rounded text-xs text-yellow-800">
                <p><strong>⚠️ Important for Cloudflare Pages:</strong></p>
                <p className="mt-1">
                    Vite "bakes" the variables into the code during the build process. If you added the secrets <em>after</em> the first deployment failed:
                </p>
                <ol className="list-decimal pl-4 mt-1 space-y-1">
                    <li>Go to <strong>Deployments</strong> in the Cloudflare Dashboard.</li>
                    <li>Click the <strong>... (Menu)</strong> on the latest entry.</li>
                    <li>Select <strong>Retry deployment</strong>.</li>
                </ol>
            </div>
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
                  <p className="text-xs text-green-700 opacity-80">to LinkKiste</p>
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
                  allFolders={allFolders} 
                  existingUrls={existingUrls}
                  isPopup={true}
                />
          </div>
      );
  }

  // --------------------------------------------------------------------------
  // MAIN UI
  // --------------------------------------------------------------------------
  if (!session) return <Auth />;

  return (
    <Layout 
      userEmail={session.user.email} 
      onLogout={handleLogout}
      currentView={view}
      setView={(v) => {
          setView(v);
          setFilterTag(null);
          setFilterFolder(null);
          setInitialBookmarkData(null);
          
          if (['about', 'terms', 'privacy', 'settings'].includes(v)) {
              syncUrl({ page: v });
          } else {
              syncUrl({});
          }
      }}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      onLogoClick={handleLogoClick}
    >
      {(view === 'list' || view === 'tags' || view === 'folders' || view === 'unread') && (
        <>
          <BookmarkList 
            bookmarks={displayedBookmarks}
            onDelete={deleteBookmark}
            onToggleRead={toggleReadStatus}
            onArchive={handleArchiveBookmark}
            filterTag={filterTag}
            setFilterTag={handleSetFilterTag}
            filterFolder={filterFolder}
            setFilterFolder={handleSetFilterFolder}
            onAddFolder={addFolder}
            onRemoveFolderFromBookmark={removeFolder}
            onDeleteFolder={handleUpdateFolderDelete}
            onViewDetail={handleViewDetail}
            loading={loading}
            viewMode={view}
            userEmail={session.user.email}
            onAddClick={() => setView('add')}
            onRefresh={() => fetchBookmarks(true)}
            isRefreshing={isRefreshing}
            usePagination={usePagination}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
          <div className="mt-12 text-center">
              <button 
                onClick={() => setShowSqlHelp(!showSqlHelp)} 
                className="text-[10px] text-gray-300 hover:text-gray-500 underline"
              >
                  {showSqlHelp ? 'Hide Database Help' : 'Database Settings'}
              </button>
          </div>
          <SqlHelp isOpen={showSqlHelp} onToggle={setShowSqlHelp} />
        </>
      )}

      {view === 'detail' && selectedBookmark && (
          <BookmarkDetail 
            bookmark={selectedBookmark}
            onSaveNotes={saveNotes}
            onUpdate={(id, data) => updateBookmark(id, data)}
            onArchive={handleArchiveBookmark}
            allFolders={allFolders}
            onClose={() => {
                setView('list');
                syncUrl({});
            }}
            onDelete={deleteBookmark}
            onToggleRead={toggleReadStatus}
          />
      )}

      {view === 'add' && (
        <AddBookmark 
          onSave={handleSaveWrapper}
          onCancel={() => {
              setView('list');
              setInitialBookmarkData(null);
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
            usePagination={usePagination}
            onTogglePagination={handleSetPagination}
        />
      )}
      
      {view === 'about' && <About />}
      {view === 'terms' && <Terms />}
      {view === 'privacy' && <Privacy />}
    </Layout>
  );
};

export default App;