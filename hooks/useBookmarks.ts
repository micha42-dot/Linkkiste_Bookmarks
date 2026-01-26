
import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Bookmark, NewBookmark } from '../types';
import { Session } from '@supabase/supabase-js';

export const useBookmarks = (session: Session | null) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Logic
  const fetchBookmarks = async (isBackgroundUpdate = false) => {
    if (!session || !isSupabaseConfigured) return;
    
    if (!isBackgroundUpdate && bookmarks.length === 0) {
        setLoading(true);
    }
    
    if (isBackgroundUpdate) {
        setIsRefreshing(true);
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
    setIsRefreshing(false);
  };

  // Initial Fetch on Session Change
  useEffect(() => {
    if (session?.user?.id) {
      const hasData = bookmarks.length > 0;
      fetchBookmarks(hasData); 
    }
  }, [session?.user?.id]);

  // CRUD Operations
  const addBookmark = async (newBm: NewBookmark) => {
    if (!session?.user) throw new Error('No user');

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

    if (error) throw error;
    await fetchBookmarks(true);
  };

  const updateBookmark = async (id: number, updates: Partial<Bookmark>) => {
      // Optimistic update
      setBookmarks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      
      const { error } = await supabase.from('bookmarks').update(updates).eq('id', id);
      if (error) {
          alert('Error updating bookmark: ' + error.message);
          fetchBookmarks(true); // Revert
      }
  };

  const deleteBookmark = async (id: number) => {
    const { error } = await supabase.from('bookmarks').delete().eq('id', id);
    if (error) {
      alert('Error deleting: ' + error.message);
    } else {
      setBookmarks(prev => prev.filter(b => b.id !== id));
    }
  };

  const toggleReadStatus = async (id: number, currentStatus: boolean) => {
     await updateBookmark(id, { to_read: !currentStatus });
  };

  const saveNotes = async (id: number, notes: string) => {
     await updateBookmark(id, { notes });
  };

  const addFolder = async (id: number, folder: string) => {
      const bm = bookmarks.find(b => b.id === id);
      if (!bm) return;
      const currentFolders = bm.folders || [];
      if (currentFolders.includes(folder)) return;
      await updateBookmark(id, { folders: [...currentFolders, folder] });
  };

  const removeFolder = async (id: number, folder: string) => {
      const bm = bookmarks.find(b => b.id === id);
      if (!bm) return;
      const newFolders = bm.folders?.filter(f => f !== folder) || [];
      await updateBookmark(id, { folders: newFolders });
  };

  const deleteEntireFolder = async (folderName: string) => {
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
      } catch (err: any) {
          alert('Error deleting folder: ' + err.message);
      } finally {
          setLoading(false);
      }
  };

  // Derived State (Memoized)
  const allFolders = useMemo(() => {
    const folders = new Set<string>();
    bookmarks.forEach(b => b.folders?.forEach(f => folders.add(f)));
    return Array.from(folders).sort();
  }, [bookmarks]);

  const existingUrls = useMemo(() => {
      return bookmarks.map(b => b.url);
  }, [bookmarks]);

  return {
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
  };
};
