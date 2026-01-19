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
import { Bookmark, NewBookmark, ViewMode } from './types';
import { Session } from '@supabase/supabase-js';

// Extend window definition for our global flag
declare global {
  interface Window {
    isPopupModeDetected?: boolean;
  }
}

const App: React.FC = () => {
  // 1. SYNCHRONOUS INITIALIZATION
  const [isPopupMode] = useState(() => {
    // Check our global flag from index.html head script
    if (window.isPopupModeDetected) return true;

    const params = new URLSearchParams(window.location.search);
    const paramMode = params.get('mode') === 'popup';
    
    // Check Pathname (in case SPA fallback served index.html for popup.html)
    const isPopupPath = window.location.pathname.includes('popup.html');

    // Safety Fallback: If we are inside an iframe
    const inIframe = (() => {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    })();
    
    // Heuristic: If window is very narrow (extension popup width), assume popup
    const isNarrow = window.innerWidth < 500 && inIframe;

    return paramMode || isPopupPath || inIframe || isNarrow;
  });

  const [initialBookmarkData, setInitialBookmarkData] = useState<{url: string, title: string} | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const title = params.get('title');
    if (url) return { url, title: title || url };
    return null;
  });

  const [view, setView] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    // In popup mode, default to ADD unless explicitly listing
    if (isPopupMode && !params.get('view')) return 'add';
    // If incoming URL present, go to add
    return params.get('url') ? 'add' : 'list';
  });

  const [session, setSession] = useState<Session | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterFolder, setFilterFolder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Styling helpers
    if (isPopupMode) {
        document.documentElement.classList.add('is-popup'); // Ensure global class
        document.body.classList.add('popup-mode');
        document.body.style.backgroundColor = 'white';
        // Force add view if we have data
        if (initialBookmarkData) setView('add');
    } else {
        const params = new URLSearchParams(window.location.search);
        if (params.get('url')) {
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({path: newUrl}, '', newUrl);
        }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const handleViewChange = (e: any) => setView(e.detail);
    window.addEventListener('changeView', handleViewChange);

    return () => {
        subscription.unsubscribe();
        window.removeEventListener('changeView', handleViewChange);
    };
  }, [isPopupMode]);

  const fetchBookmarks = async (isBackgroundUpdate = false) => {
    if (!session || !isSupabaseConfigured) return;
    
    if (!isBackgroundUpdate && bookmarks.length === 0) {
        setLoading(true);
    }
    
    let query = supabase
      .from('bookmarks')
      .select('*')
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bookmarks:', error);
    } else {
      setBookmarks(data as Bookmark[] || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session?.user?.id) {
      const hasData = bookmarks.length > 0;
      fetchBookmarks(hasData);
    }
  }, [session?.user?.id]); 

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setBookmarks([]);
  };

  const handleSaveBookmark = async (newBm: NewBookmark) => {
    if (!session?.user) return;

    const { error } = await supabase.from('bookmarks').insert([
      {
        url: newBm.url,
        title: newBm.title,
        description: newBm.description,
        tags: newBm.tags,
        folders: newBm.folders,
        to_read: newBm.to_read,
        user_id: session.user.id
      }
    ]);

    if (error) {
        alert(`Error saving bookmark: ${error.message}`);
    } else {
      if (isPopupMode) {
          setInitialBookmarkData(null);
          setView('list'); // This triggers Success Screen in Popup Mode render block
      } else {
          await fetchBookmarks(true);
          setView('list');
      }
    }
  };

  const handleDeleteBookmark = async (id: number) => {
    const { error } = await supabase.from('bookmarks').delete().eq('id', id);
    if (error) {
      alert('Error deleting: ' + error.message);
    } else {
      setBookmarks(bookmarks.filter(b => b.id !== id));
      if (view === 'detail' && selectedBookmarkId === id) {
          setView('list');
          setSelectedBookmarkId(null);
      }
    }
  };

  const handleToggleRead = async (id: number, currentStatus: boolean) => {
      setBookmarks(bookmarks.map(b => b.id === id ? { ...b, to_read: !currentStatus } : b));
      const { error } = await supabase.from('bookmarks').update({ to_read: !currentStatus }).eq('id', id);
      if (error) { alert('Error updating: ' + error.message); fetchBookmarks(true); } 
  };

  const handleSaveNotes = async (id: number, notes: string) => {
      setBookmarks(bookmarks.map(b => b.id === id ? { ...b, notes: notes } : b));
      const { error } = await supabase.from('bookmarks').update({ notes: notes }).eq('id', id);
      if (error) alert('Error saving notes: ' + error.message);
  };

  const handleAddFolderToBookmark = async (bookmarkId: number, folderName: string) => {
      const bm = bookmarks.find(b => b.id === bookmarkId);
      if (!bm) return;
      const cleanFolder = folderName.trim();
      if (!cleanFolder) return;
      const currentFolders = bm.folders || [];
      if (currentFolders.includes(cleanFolder)) return;
      const newFolders = [...currentFolders, cleanFolder];
      setBookmarks(bookmarks.map(b => b.id === bookmarkId ? { ...b, folders: newFolders } : b));
      const { error } = await supabase.from('bookmarks').update({ folders: newFolders }).eq('id', bookmarkId);
      if (error) { alert('Error adding folder: ' + error.message); fetchBookmarks(true); }
  };

  const handleRemoveFolderFromBookmark = async (bookmarkId: number, folderName: string) => {
      const bm = bookmarks.find(b => b.id === bookmarkId);
      if (!bm) return;
      const newFolders = bm.folders?.filter(f => f !== folderName) || [];
      setBookmarks(bookmarks.map(b => b.id === bookmarkId ? { ...b, folders: newFolders } : b));
      const { error } = await supabase.from('bookmarks').update({ folders: newFolders }).eq('id', bookmarkId);
      if (error) { alert('Error updating bookmark: ' + error.message); fetchBookmarks(true); }
  };

  const handleDeleteEntireFolder = async (folderName: string) => {
      if (!window.confirm(`Delete folder "${folderName}"?`)) return;
      const affectedBookmarks = bookmarks.filter(b => b.folders?.includes(folderName));
      if (affectedBookmarks.length === 0) return;
      setLoading(true);
      try {
          const updates = affectedBookmarks.map(b => {
             const newFolders = b.folders?.filter(f => f !== folderName) || [];
             return supabase.from('bookmarks').update({ folders: newFolders }).eq('id', b.id);
          });
          await Promise.all(updates);
          await fetchBookmarks(true);
          if (filterFolder === folderName) setFilterFolder(null);
      } catch (err: any) { alert('Error deleting folder: ' + err.message); } finally { setLoading(false); }
  };

  const handleSetFilterTag = (tag: string | null) => {
    setFilterTag(tag);
    if (tag) { setFilterFolder(null); if (['tags', 'unread', 'folders', 'detail'].includes(view)) setView('list'); }
  };

  const handleSetFilterFolder = (folder: string | null) => {
      setFilterFolder(folder);
      if (folder) { setFilterTag(null); setView('list'); }
  };

  const handleViewDetail = (id: number) => { setSelectedBookmarkId(id); setView('detail'); window.scrollTo(0, 0); };

  const displayedBookmarks = bookmarks.filter(b => {
      const matchesView = view === 'unread' ? b.to_read : true;
      const matchesTag = filterTag ? (b.tags && b.tags.includes(filterTag)) : true;
      const matchesFolder = filterFolder ? (b.folders && b.folders.includes(filterFolder)) : true;
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        b.title.toLowerCase().includes(term) || 
        b.url.toLowerCase().includes(term) ||
        (b.description && b.description.toLowerCase().includes(term));
      return matchesView && matchesTag && matchesFolder && matchesSearch;
  });

  const selectedBookmark = bookmarks.find(b => b.id === selectedBookmarkId);

  // --------------------------------------------------------------------------
  // RENDER LOGIC
  // --------------------------------------------------------------------------

  // Config Screen (Responsive for Popup)
  if (!isSupabaseConfigured) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans text-center ${isPopupMode ? 'p-2' : 'p-8'}`}>
          <div className={`bg-white border border-gray-200 shadow-sm rounded ${isPopupMode ? 'p-4 w-full' : 'max-w-xl p-8'}`}>
            <h1 className="text-xl font-bold text-red-600 mb-4">Setup Required</h1>
            <p className="mb-4 text-sm text-gray-700">
                Missing database credentials.
            </p>
            
            <div className="text-left bg-gray-50 p-4 border border-gray-200 rounded text-sm mb-4">
                <p className="font-bold text-gray-900 mb-2">Create .env file:</p>
                <div className="p-2 bg-gray-800 text-gray-100 font-mono text-[10px] rounded overflow-x-auto">
                    VITE_SUPABASE_URL=...<br/>
                    VITE_SUPABASE_ANON_KEY=...
                </div>
            </div>
            
            {isPopupMode && (
                <p className="text-xs text-blue-600 mt-2">
                    Open the main app to see full setup instructions.
                </p>
            )}
          </div>
      </div>
    );
  }

  // POPUP MODE (Extension)
  if (isPopupMode) {
      if (!session) {
          return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
                <Auth isPopup={true} />
            </div>
          );
      }

      // Success Screen logic
      if (view === 'list') {
          return (
              <div className="h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 p-6 text-center">
                  <div className="text-5xl mb-4 text-green-600">✓</div>
                  <h2 className="font-bold text-xl mb-1">Saved</h2>
                  <p className="text-xs text-green-700 opacity-80">to LinkKiste</p>
                  <div className="mt-8">
                     <button onClick={() => window.close()} className="text-xs underline hover:no-underline">Close window</button>
                  </div>
              </div>
          );
      }

      // Add Bookmark Form
      return (
          <div className="min-h-screen bg-white px-5 py-4">
               <AddBookmark 
                  onSave={handleSaveBookmark}
                  onCancel={() => window.close()}
                  initialUrl={initialBookmarkData?.url}
                  initialTitle={initialBookmarkData?.title}
                  isPopup={true}
                />
          </div>
      );
  }

  // STANDARD APP MODE
  if (!session) {
    return <Auth />;
  }

  return (
    <Layout 
      userEmail={session.user.email} 
      onLogout={handleLogout}
      currentView={view}
      setView={(v) => { setView(v); setFilterTag(null); setFilterFolder(null); setInitialBookmarkData(null); }}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
    >
      {(view === 'list' || view === 'tags' || view === 'folders' || view === 'unread') && (
        <>
          <BookmarkList 
            bookmarks={displayedBookmarks}
            onDelete={handleDeleteBookmark}
            onToggleRead={handleToggleRead}
            filterTag={filterTag}
            setFilterTag={handleSetFilterTag}
            filterFolder={filterFolder}
            setFilterFolder={handleSetFilterFolder}
            onAddFolder={handleAddFolderToBookmark}
            onRemoveFolderFromBookmark={handleRemoveFolderFromBookmark}
            onDeleteFolder={handleDeleteEntireFolder}
            onViewDetail={handleViewDetail}
            loading={loading}
            viewMode={view}
            userEmail={session.user.email}
            onAddClick={() => setView('add')}
          />
          <div className="mt-12 text-center">
              <button onClick={() => setShowSqlHelp(!showSqlHelp)} className="text-[10px] text-gray-300 hover:text-gray-500 underline">
                  {showSqlHelp ? 'Hide Database Help' : 'Database Settings'}
              </button>
          </div>
          <SqlHelp isOpen={showSqlHelp} onToggle={setShowSqlHelp} />
        </>
      )}

      {view === 'detail' && selectedBookmark && (
          <BookmarkDetail 
            bookmark={selectedBookmark}
            onSaveNotes={handleSaveNotes}
            onClose={() => setView('list')}
            onDelete={handleDeleteBookmark}
            onToggleRead={handleToggleRead}
          />
      )}

      {view === 'add' && (
        <AddBookmark 
          onSave={handleSaveBookmark}
          onCancel={() => { setView('list'); setInitialBookmarkData(null); }}
          initialUrl={initialBookmarkData?.url}
          initialTitle={initialBookmarkData?.title}
        />
      )}

      {view === 'settings' && <Settings session={session} />}
      {view === 'about' && <About />}
      {view === 'terms' && <Terms />}
      {view === 'privacy' && <Privacy />}
    </Layout>
  );
};

export default App;