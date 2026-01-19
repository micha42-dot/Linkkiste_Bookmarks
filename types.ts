
export interface Bookmark {
  id: number;
  created_at: string;
  url: string;
  title: string;
  description: string | null;
  notes: string | null;
  tags: string[] | null;
  folders: string[] | null;
  archive_url: string | null;
  user_id: string;
  to_read: boolean;
}

export interface NewBookmark {
  url: string;
  title: string;
  description: string;
  tags: string[];
  folders: string[];
  to_read: boolean;
}

export type ViewMode = 'list' | 'add' | 'tags' | 'folders' | 'settings' | 'unread' | 'detail' | 'about' | 'terms' | 'privacy';
