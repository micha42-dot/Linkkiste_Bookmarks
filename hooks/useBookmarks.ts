
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { Bookmark, NewBookmark } from '../types';
import { Session } from '@supabase/supabase-js';

export const useBookmarks = (session: Session | null) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchRef = useRef<number>(0);

  // Fetch Logic
  const fetchBookmarks = useCallback(async (isBackgroundUpdate = false) => {
    if (!session || !isSupabaseConfigured) return;
    
    const now = Date.now();
    // Prevent spamming background queries if fetched less than 30s ago
    if (isBackgroundUpdate && now - lastFetchRef.current < 30000) {
      return;
    }

    if (!isBackgroundUpdate && bookmarks.length === 0) {
        setLoading(true);
    }
    
    if (isBackgroundUpdate) {
        setIsRefreshing(true);
    }
    
    try {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookmarks:', error);
      } else {
        setBookmarks(data as Bookmark[] || []);
        lastFetchRef.current = Date.now();
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [session]);

  // Initial Fetch on Session Change
  useEffect(() => {
    if (session?.user?.id) {
      const hasData = bookmarks.length > 0;
      fetchBookmarks(hasData); 
    }
  }, [session?.user?.id, fetchBookmarks]);

  // CRUD Operations
  const addBookmark = async (newBm: NewBookmark) => {
    if (!session?.user) throw new Error('No user');

    const { data, error } = await supabase.from('bookmarks').insert([
      {
        url: newBm.url,
        title: newBm.title,
        description: newBm.description,
        notes: newBm.notes || null,
        tags: newBm.tags,
        folders: newBm.folders,
        to_read: newBm.to_read,
        user_id: session.user.id
      }
    ]).select().single();

    if (error) throw error;
    if (data) {
      const savedBookmark = data as Bookmark;
      // Optimistically add to top of list immediately without full network refetch
      setBookmarks(prev => [savedBookmark, ...prev.filter(b => b.id !== savedBookmark.id)]);
      lastFetchRef.current = Date.now();
      return savedBookmark;
    }
    return data as Bookmark;
  };

  const updateBookmark = async (id: number, updates: Partial<Bookmark>) => {
      // Optimistic update
      setBookmarks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      
      const { error } = await supabase.from('bookmarks').update(updates).eq('id', id);
      if (error) {
          console.error('Error updating bookmark:', error);
          fetchBookmarks(true); // Revert
      }
  };

  const deleteBookmark = async (id: number) => {
    // Optimistic delete
    setBookmarks(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('bookmarks').delete().eq('id', id);
    if (error) {
      console.error('Error deleting bookmark:', error);
      fetchBookmarks(true); // Revert
    }
  };

  const toggleReadStatus = async (id: number, currentStatus: boolean) => {
     await updateBookmark(id, { to_read: !currentStatus });
  };

  const saveNotes = async (id: number, notes: string) => {
     await updateBookmark(id, { notes });
  };

  // --- FOLDER LOGIC ---

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

  // --- TAG LOGIC ---

  const addTag = async (id: number, tag: string) => {
      const bm = bookmarks.find(b => b.id === id);
      if (!bm) return;
      const cleanTag = tag.trim().toLowerCase();
      if (!cleanTag) return;
      
      const currentTags = bm.tags || [];
      if (currentTags.includes(cleanTag)) return;

      await updateBookmark(id, { tags: [...currentTags, cleanTag] });
  };

  const removeTag = async (id: number, tag: string) => {
      const bm = bookmarks.find(b => b.id === id);
      if (!bm) return;
      const newTags = bm.tags?.filter(t => t !== tag) || [];
      await updateBookmark(id, { tags: newTags });
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
      addTag,
      removeTag,
      allFolders,
      existingUrls
  };
};
