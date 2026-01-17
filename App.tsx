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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
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
      await fetchBookmarks(true); // Silent update
      setView('list');
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

  if (!isSupabaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans p-8 text-center">
          <div className="max-w-xl bg-white p-8 border border-gray-200 shadow-sm rounded">
            <h1 className="text-xl font-bold text-red-600 mb-4">Connect your Database</h1>
            <p className="mb-6 text-sm text-gray-700">
                Die Anwendung ist bereit, aber es fehlen die Zugangsdaten für deine Supabase-Datenbank.
            </p>
            
            <div className="text-left bg-gray-50 p-6 border border-gray-200 rounded text-sm mb-6">
                <h3 className="font-bold text-gray-900 mb-2">So geht's:</h3>
                <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                    <li>Erstelle eine Datei namens <code>.env</code> im Hauptverzeichnis.</li>
                    <li>Füge den folgenden Inhalt ein (ersetze die Werte mit deinen Daten aus Supabase):</li>
                </ol>
                <div className="mt-4 p-3 bg-gray-800 text-gray-100 font-mono text-xs rounded overflow-x-auto">
                    VITE_SUPABASE_URL=https://dein-projekt.supabase.co<br/>
                    VITE_SUPABASE_ANON_KEY=dein-langer-anon-key-string
                </div>
            </div>

            <div className="text-left bg-blue-50 p-4 border border-blue-100 rounded text-xs text-blue-800">
                <p><strong>Deployment (Vercel/Cloudflare):</strong></p>
                <p>Füge diese Variablen in den Projekteinstellungen unter "Environment Variables" hinzu.</p>
            </div>
          </div>
      </div>
    );
  }

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
            onClose={() => setView('list')}
            onDelete={handleDeleteBookmark}
            onToggleRead={handleToggleRead}
          />
      )}

      {view === 'add' && (
        <AddBookmark 
          onSave={handleSaveBookmark}
          onCancel={() => setView('list')}
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