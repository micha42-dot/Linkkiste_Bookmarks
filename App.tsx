import React, { useEffect, useState, useMemo } from 'react';
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

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<ViewMode>('list');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterFolder, setFilterFolder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<number | null>(null);
  
  // Extension / Popup State
  const [isPopupMode, setIsPopupMode] = useState(false);
  const [initialBookmarkData, setInitialBookmarkData] = useState<{url: string, title: string} | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Check URL params (Extension support)
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const urlParam = params.get('url');
    const titleParam = params.get('title');

    if (modeParam === 'popup') {
        setIsPopupMode(true);
        document.body.classList.add('popup-mode'); // Helper for global CSS if needed
    }

    if (urlParam) {
      setInitialBookmarkData({
        url: urlParam,
        title: titleParam || urlParam 
      });
      // In popup mode, we force the 'add' view instantly
      setView('add');
      
      // Clean URL only if NOT in popup mode (iframe needs the params to persist across re-renders if state updates)
      if (modeParam !== 'popup') {
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({path: newUrl}, '', newUrl);
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Custom event listener for view changes from components
    const handleViewChange = (e: any) => setView(e.detail);
    window.addEventListener('changeView', handleViewChange);

    return () => {
        subscription.unsubscribe();
        window.removeEventListener('changeView', handleViewChange);
    };
  }, []);

  const fetchBookmarks = async (isBackgroundUpdate = false) => {
    if (!session || !isSupabaseConfigured) return;
    
    // Only show full loading spinner if we don't have data yet and it's not a background update
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

  // Only re-fetch if the USER changes (login/logout), not on every token refresh
  useEffect(() => {
    if (session?.user?.id) {
      const hasData = bookmarks.length > 0;
      fetchBookmarks(hasData); // Pass true if we already have data (silent update)
    }
  }, [session?.user?.id]); 

  // Compute all unique folders for the dropdown in Edit View
  const allFolders = useMemo(() => {
    const folders = new Set<string>();
    bookmarks.forEach(b => b.folders?.forEach(f => folders.add(f)));
    return Array.from(folders).sort();
  }, [bookmarks]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setBookmarks([]); // Clear data on logout
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
          // In popup mode, show success state instead of list
          setInitialBookmarkData(null); // Clear form data
          setView('list'); // Re-use 'list' view state to trigger success UI in render below
      } else {
          await fetchBookmarks(true); // Silent update
          setView('list');
      }
    }
  };

  const handleUpdateBookmark = async (id: number, updates: { title: string, url: string, description: string, tags: string[], folders: string[] }) => {
      // Optimistic update
      setBookmarks(bookmarks.map(b => b.id === id ? { ...b, ...updates } : b));
      
      const { error } = await supabase.from('bookmarks').update(updates).eq('id', id);
      if (error) {
          alert('Error updating bookmark: ' + error.message);
          fetchBookmarks(true); // Revert on error
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
      // Optimistic update
      setBookmarks(bookmarks.map(b => b.id === id ? { ...b, to_read: !currentStatus } : b));

      const { error } = await supabase
        .from('bookmarks')
        .update({ to_read: !currentStatus })
        .eq('id', id);
      
      if (error) {
          alert('Error updating: ' + error.message);
          fetchBookmarks(true); // Revert
      } 
  };

  const handleSaveNotes = async (id: number, notes: string) => {
      // Optimistic update local state
      setBookmarks(bookmarks.map(b => b.id === id ? { ...b, notes: notes } : b));

      const { error } = await supabase
        .from('bookmarks')
        .update({ notes: notes })
        .eq('id', id);
      
      if (error) {
          alert('Error saving notes: ' + error.message + '\n\nMake sure you have run the migration SQL from "Database Settings".');
      }
  };

  const handleAddFolderToBookmark = async (bookmarkId: number, folderName: string) => {
      const bm = bookmarks.find(b => b.id === bookmarkId);
      if (!bm) return;

      // Clean folder name
      const cleanFolder = folderName.trim();
      if (!cleanFolder) return;

      const currentFolders = bm.folders || [];
      if (currentFolders.includes(cleanFolder)) return; // Already exists

      const newFolders = [...currentFolders, cleanFolder];

      // Optimistic update
      setBookmarks(bookmarks.map(b => b.id === bookmarkId ? { ...b, folders: newFolders } : b));

      const { error } = await supabase
        .from('bookmarks')
        .update({ folders: newFolders })
        .eq('id', bookmarkId);

      if (error) {
          alert('Error adding folder: ' + error.message);
          fetchBookmarks(true); // Revert
      }
  };

  const handleRemoveFolderFromBookmark = async (bookmarkId: number, folderName: string) => {
      const bm = bookmarks.find(b => b.id === bookmarkId);
      if (!bm) return;

      const newFolders = bm.folders?.filter(f => f !== folderName) || [];
      
      // Optimistic update
      setBookmarks(bookmarks.map(b => b.id === bookmarkId ? { ...b, folders: newFolders } : b));

      const { error } = await supabase
        .from('bookmarks')
        .update({ folders: newFolders })
        .eq('id', bookmarkId);

      if (error) {
          alert('Error updating bookmark: ' + error.message);
          fetchBookmarks(true); // Revert on error
      }
  };

  const handleDeleteEntireFolder = async (folderName: string) => {
      if (!window.confirm(`Are you sure you want to delete the folder "${folderName}"? This will remove it from all bookmarks containing it.`)) {
          return;
      }

      // Find all affected bookmarks
      const affectedBookmarks = bookmarks.filter(b => b.folders?.includes(folderName));
      if (affectedBookmarks.length === 0) return;

      setLoading(true);
      try {
          // Process updates in parallel
          const updates = affectedBookmarks.map(b => {
             const newFolders = b.folders?.filter(f => f !== folderName) || [];
             return supabase.from('bookmarks').update({ folders: newFolders }).eq('id', b.id);
          });

          await Promise.all(updates);
          await fetchBookmarks(true); // Refetch to ensure state is clean
          if (filterFolder === folderName) {
              setFilterFolder(null); // Clear filter if we deleted the current folder
          }
      } catch (err: any) {
          alert('Error deleting folder: ' + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleSetFilterTag = (tag: string | null) => {
    setFilterTag(tag);
    if (tag) {
        setFilterFolder(null); // Clear folder filter if selecting a tag
        if (view === 'tags' || view === 'unread' || view === 'folders' || view === 'detail') {
            setView('list');
        }
    }
  };

  const handleSetFilterFolder = (folder: string | null) => {
      setFilterFolder(folder);
      if (folder) {
          setFilterTag(null); // Clear tag filter if selecting a folder
          setView('list');
      }
  };

  const handleViewDetail = (id: number) => {
      setSelectedBookmarkId(id);
      setView('detail');
      window.scrollTo(0, 0);
  };

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
  // MISSING CONFIGURATION SCREEN (PRESERVED VERBATIM)
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
  // POPUP MODE RENDERING
  // --------------------------------------------------------------------------
  if (isPopupMode) {
      // Small login screen if not authenticated
      if (!session) {
          return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
                <Auth isPopup={true} />
            </div>
          );
      }

      // Success Screen
      if (view === 'list' && !initialBookmarkData) {
          return (
              <div className="h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 p-6 text-center">
                  <div className="text-5xl mb-4 text-green-600">✓</div>
                  <h2 className="font-bold text-xl mb-1">Saved</h2>
                  <p className="text-xs text-green-700 opacity-80">to LinkKiste</p>
                  {/* Optional: Close button if window.close() is blocked */}
                  <div className="mt-8">
                     <button onClick={() => window.close()} className="text-xs underline hover:no-underline">Close window</button>
                  </div>
              </div>
          );
      }

      // The minimal ADD Screen
      return (
          <div className="min-h-screen bg-white px-5 py-4">
               <AddBookmark 
                  onSave={handleSaveBookmark}
                  onCancel={() => window.close()}
                  initialUrl={initialBookmarkData?.url}
                  initialTitle={initialBookmarkData?.title}
                  allFolders={allFolders} // Added folders to popup
                  isPopup={true}
                />
          </div>
      );
  }

  // --------------------------------------------------------------------------
  // STANDARD APP MODE (Full Layout)
  // --------------------------------------------------------------------------
  if (!session) {
    return <Auth />;
  }

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
      }}
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
            onSaveNotes={handleSaveNotes}
            onUpdate={handleUpdateBookmark}
            allFolders={allFolders}
            onClose={() => setView('list')}
            onDelete={handleDeleteBookmark}
            onToggleRead={handleToggleRead}
          />
      )}

      {view === 'add' && (
        <AddBookmark 
          onSave={handleSaveBookmark}
          onCancel={() => {
              setView('list');
              setInitialBookmarkData(null);
          }}
          initialUrl={initialBookmarkData?.url}
          initialTitle={initialBookmarkData?.title}
          allFolders={allFolders} // Added folders to standard add
        />
      )}

      {view === 'settings' && (
        <Settings session={session} />
      )}
      
      {view === 'about' && <About />}
      {view === 'terms' && <Terms />}
      {view === 'privacy' && <Privacy />}
    </Layout>
  );
};

export default App;