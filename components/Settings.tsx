import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Bookmark } from '../types';
import { normalizeUrl, escapeSqlString } from '../utils/helpers';
import { ModelSelect } from './ModelSelect';
import { EnabledTabsConfig } from './Layout';
import { autoParseBookmarkFile, ParsedBookmarkItem } from '../utils/importParsers';
import { ImportBookmarksModal } from './ImportBookmarksModal';

interface SettingsProps {
  session: Session;
  bookmarks?: Bookmark[];
  onBookmarksUpdated?: () => void;
  usePagination?: boolean;
  onTogglePagination?: (enabled: boolean) => void;
  showWikiInList?: boolean;
  onToggleShowWikiInList?: (enabled: boolean) => void;
  showNotesInList?: boolean;
  onToggleShowNotesInList?: (enabled: boolean) => void;
  showQuickCapture?: boolean;
  onToggleShowQuickCapture?: (enabled: boolean) => void;
  quickCaptureDefaultTag?: string;
  onChangeQuickCaptureDefaultTag?: (tag: string) => void;
  quickCaptureNotePrefix?: string;
  onChangeQuickCaptureNotePrefix?: (prefix: string) => void;
  quickCaptureAlwaysNote?: boolean;
  onToggleQuickCaptureAlwaysNote?: (enabled: boolean) => void;
  enabledTabs?: EnabledTabsConfig;
  onToggleTab?: (tabKey: keyof EnabledTabsConfig, enabled: boolean) => void;
  kmFeatures?: { wiki: boolean; ai: boolean };
  onToggleKmFeature?: (feature: 'wiki' | 'ai', enabled: boolean) => void;
  showSqlHelpInMenu?: boolean;
  onToggleShowSqlHelpInMenu?: (enabled: boolean) => void;
  openRouterKey?: string;
  setOpenRouterKey?: (key: string) => void;
  aiBaseUrl?: string;
  setAiBaseUrl?: (url: string) => void;
  defaultAiQueryModel?: string;
  setDefaultAiQueryModel?: (model: string) => void;
  defaultWikiModel?: string;
  setDefaultWikiModel?: (model: string) => void;
  clippingLanguage?: string;
  setClippingLanguage?: (lang: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
    session, 
    bookmarks = [],
    onBookmarksUpdated,
    usePagination, 
    onTogglePagination,
    showWikiInList,
    onToggleShowWikiInList, 
    showNotesInList,
    onToggleShowNotesInList,
    showQuickCapture,
    onToggleShowQuickCapture,
    quickCaptureDefaultTag = 'inbox',
    onChangeQuickCaptureDefaultTag,
    quickCaptureNotePrefix = 'Note:',
    onChangeQuickCaptureNotePrefix,
    quickCaptureAlwaysNote = false,
    onToggleQuickCaptureAlwaysNote,
    enabledTabs = {
      list: true,
      notes: true,
      wiki: true,
      unread: true,
      folders: true,
      tags: true,
      ai: true,
      add: true
    },
    onToggleTab,
    kmFeatures = { wiki: true, ai: true }, 
    onToggleKmFeature,
    showSqlHelpInMenu = true,
    onToggleShowSqlHelpInMenu,
    openRouterKey = '',
    setOpenRouterKey,
    aiBaseUrl = 'https://openrouter.ai/api/v1',
    setAiBaseUrl,
    defaultAiQueryModel = '',
    setDefaultAiQueryModel,
    defaultWikiModel = '',
    setDefaultWikiModel,
    clippingLanguage = '',
    setClippingLanguage
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'km' | 'ai' | 'shortcuts' | 'account'>('general');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: React.ReactNode; type: 'success' | 'error' } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [archiveDomain, setArchiveDomain] = useState('https://archive.is');

  // Local state for all settings to allow explicit saving
  const [localPagination, setLocalPagination] = useState(usePagination);
  const [localShowWiki, setLocalShowWiki] = useState(showWikiInList);
  const [localShowNotes, setLocalShowNotes] = useState(showNotesInList);
  
  const [localShowQuickCapture, setLocalShowQuickCapture] = useState(showQuickCapture);
  const [localQcTag, setLocalQcTag] = useState(quickCaptureDefaultTag);
  const [localQcPrefix, setLocalQcPrefix] = useState(quickCaptureNotePrefix);
  const [localQcAlwaysNote, setLocalQcAlwaysNote] = useState(quickCaptureAlwaysNote);
  
  const [localEnabledTabs, setLocalEnabledTabs] = useState(enabledTabs);
  const [localKmFeatures, setLocalKmFeatures] = useState(kmFeatures);
  const [localShowSqlHelp, setLocalShowSqlHelp] = useState(showSqlHelpInMenu);
  
  const [localOpenRouterKey, setLocalOpenRouterKey] = useState(openRouterKey);
  const [localAiBaseUrl, setLocalAiBaseUrl] = useState(aiBaseUrl);
  const [localQueryModel, setLocalQueryModel] = useState(defaultAiQueryModel);
  const [localWikiModel, setLocalWikiModel] = useState(defaultWikiModel);
  const [localClippingLang, setLocalClippingLang] = useState(clippingLanguage);

  const [qcUnsaved, setQcUnsaved] = useState(false);
  const [aiUnsaved, setAiUnsaved] = useState(false);
  const [isSavingQc, setIsSavingQc] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);

  // Sync incoming props to local state if they change externally
  useEffect(() => {
      setLocalPagination(usePagination);
      setLocalShowWiki(showWikiInList);
      setLocalShowNotes(showNotesInList);
      setLocalShowQuickCapture(showQuickCapture);
      setLocalQcTag(quickCaptureDefaultTag);
      setLocalQcPrefix(quickCaptureNotePrefix);
      setLocalQcAlwaysNote(quickCaptureAlwaysNote);
      setLocalEnabledTabs(enabledTabs);
      setLocalKmFeatures(kmFeatures);
      setLocalShowSqlHelp(showSqlHelpInMenu);
      setLocalOpenRouterKey(openRouterKey);
      setLocalAiBaseUrl(aiBaseUrl);
      setLocalQueryModel(defaultAiQueryModel);
      setLocalWikiModel(defaultWikiModel);
      setLocalClippingLang(clippingLanguage);
      setQcUnsaved(false);
      setAiUnsaved(false);
  }, [
      usePagination, showWikiInList, showNotesInList, showQuickCapture, quickCaptureDefaultTag, quickCaptureNotePrefix, quickCaptureAlwaysNote, enabledTabs, kmFeatures, showSqlHelpInMenu, openRouterKey, aiBaseUrl, defaultAiQueryModel, defaultWikiModel, clippingLanguage
  ]);

  const markQcChanged = () => setQcUnsaved(true);
  const markAiChanged = () => setAiUnsaved(true);

  const handleSaveQc = async () => {
      setIsSavingQc(true);
      if (onToggleShowQuickCapture) onToggleShowQuickCapture(localShowQuickCapture ?? false);
      if (onChangeQuickCaptureDefaultTag) onChangeQuickCaptureDefaultTag(localQcTag);
      if (onChangeQuickCaptureNotePrefix) onChangeQuickCaptureNotePrefix(localQcPrefix);
      if (onToggleQuickCaptureAlwaysNote) onToggleQuickCaptureAlwaysNote(localQcAlwaysNote);
      await new Promise(r => setTimeout(r, 400));
      setIsSavingQc(false);
      setQcUnsaved(false);
  };

  const handleSaveAi = async () => {
      setIsSavingAi(true);
      if (setOpenRouterKey) setOpenRouterKey(localOpenRouterKey);
      if (setAiBaseUrl) setAiBaseUrl(localAiBaseUrl);
      if (setDefaultAiQueryModel) setDefaultAiQueryModel(localQueryModel);
      if (setDefaultWikiModel) setDefaultWikiModel(localWikiModel);
      if (setClippingLanguage) setClippingLanguage(localClippingLang);
      await new Promise(r => setTimeout(r, 400));
      setIsSavingAi(false);
      setAiUnsaved(false);
  };

  const [checkingDupes, setCheckingDupes] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, Bookmark[]> | null>(null);

  // Bookmark Import State
  const [parsedImportItems, setParsedImportItems] = useState<ParsedBookmarkItem[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importFormatName, setImportFormatName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [importFileError, setImportFileError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const processImportFile = (file: File) => {
    setIsParsingFile(true);
    setImportFileError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        if (!content || !content.trim()) {
          throw new Error('Die ausgewählte Datei ist leer.');
        }
        const { items, formatName } = autoParseBookmarkFile(file.name, content);
        if (items.length === 0) {
          throw new Error('Keine gültigen Lesezeichen in der Datei gefunden. Unterstützt werden HTML-Exporte (Chrome, Raindrop, Safari), CSV und JSON.');
        }
        setParsedImportItems(items);
        setImportFileName(file.name);
        setImportFormatName(formatName);
        setShowImportModal(true);
      } catch (err: any) {
        setImportFileError(err.message || 'Fehler beim Analysieren der Datei.');
      } finally {
        setIsParsingFile(false);
      }
    };
    reader.onerror = () => {
      setImportFileError('Fehler beim Laden der Datei vom Datenträger.');
      setIsParsingFile(false);
    };
    reader.readAsText(file);
  };

  const handleImportSuccess = (importedCount: number, mode: 'append' | 'replace') => {
    setMessage({
      text: `Erfolgreich ${importedCount} Lesezeichen ${mode === 'replace' ? 'importiert (Sammlung ersetzt)' : 'hinzugefügt'}!`,
      type: 'success'
    });
    if (onBookmarksUpdated) {
      onBookmarksUpdated();
    }
  };

  // AI Models Fetching
  const [aiModels, setAiModels] = useState<{id: string, name: string, isFree: boolean}[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
      if (activeTab === 'ai') {
          fetchModels();
      }
  }, [activeTab]);

  const fetchModels = async () => {
      setFetchingModels(true);
      try {
          const res = await fetch('/api/llm/models', {
              headers: { ...(openRouterKey ? { 'x-openrouter-key': openRouterKey } : {}), ...(aiBaseUrl ? { 'x-ai-base-url': aiBaseUrl } : {}) }
          });
          const data = await res.json();
          if (data && data.data) {
              const fetchedModels = data.data.map((m: any) => ({ 
                  id: m.id, 
                  name: m.name,
                  isFree: m.pricing?.prompt === "0" || m.pricing?.prompt === 0
              }));
              setAiModels(fetchedModels);
          }
      } catch (err) {
          console.error('Failed to fetch models', err);
      } finally {
          setFetchingModels(false);
      }
  };

  // Extract project ID
  const projectUrl = (supabase as any).supabaseUrl || 'Unknown';
  const projectId = projectUrl.split('//')[1]?.split('.')[0] || 'Unknown';

  useEffect(() => {
    if (session.user.user_metadata?.avatar_url) {
      setAvatarUrl(session.user.user_metadata.avatar_url);
    }
    const storedBackup = localStorage.getItem('linkkiste_last_backup');
    if (storedBackup) setLastBackup(new Date(storedBackup));

    const storedArchive = localStorage.getItem('linkkiste_archive_base');
    if (storedArchive) setArchiveDomain(storedArchive);
  }, [session]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: password });
    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ text: 'Password updated successfully.', type: 'success' });
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  const saveArchiveDomain = () => {
      let domain = archiveDomain.trim();
      if(domain.endsWith('/')) domain = domain.slice(0, -1);
      if(!domain.startsWith('http')) domain = 'https://' + domain;
      localStorage.setItem('linkkiste_archive_base', domain);
      setArchiveDomain(domain);
      setMessage({ text: `Archive service updated to ${domain}`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
  };

  const checkForDuplicates = async () => {
      setCheckingDupes(true);
      setDuplicates(null);
      try {
          const { data, error } = await supabase.from('bookmarks').select('*').order('created_at', { ascending: false });
          if (error) throw error;
          if (!data) return;
          
          const groups: Record<string, Bookmark[]> = {};
          (data as Bookmark[]).forEach((b: Bookmark) => {
              const key = normalizeUrl(b.url);
              if (!groups[key]) groups[key] = [];
              groups[key].push(b);
          });

          const dupeGroups: Record<string, Bookmark[]> = {};
          let foundCount = 0;
          Object.entries(groups).forEach(([key, list]) => {
              if (list.length > 1) {
                  dupeGroups[key] = list;
                  foundCount++;
              }
          });

          if (foundCount === 0) {
              setMessage({ text: 'Great! No duplicates found.', type: 'success' });
              setTimeout(() => setMessage(null), 4000);
          } else {
              setDuplicates(dupeGroups);
          }
      } catch (err: any) {
          setMessage({ text: err.message, type: 'error' });
      } finally {
          setCheckingDupes(false);
      }
  };

  const deleteDuplicate = async (id: number, urlKey: string) => {
      if (!window.confirm('Delete this version?')) return;
      try {
          const { error } = await supabase.from('bookmarks').delete().eq('id', id);
          if (error) throw error;
          if (duplicates && duplicates[urlKey]) {
              const updatedList = duplicates[urlKey].filter(b => b.id !== id);
              if (updatedList.length <= 1) {
                  const newDupes = { ...duplicates };
                  delete newDupes[urlKey];
                  setDuplicates(Object.keys(newDupes).length > 0 ? newDupes : null);
                  if(Object.keys(newDupes).length === 0) setMessage({ text: 'All duplicates resolved!', type: 'success' });
              } else {
                  setDuplicates({ ...duplicates, [urlKey]: updatedList });
              }
          }
      } catch (err: any) {
          alert('Error deleting: ' + err.message);
      }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);
      if (!event.target.files || event.target.files.length === 0) throw new Error('No file selected');

      const file = event.target.files[0];
      if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') throw new Error('Only JPG allowed');

      // Validate dimensions
      const objectUrl = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              URL.revokeObjectURL(objectUrl); // Clean up memory
              if (img.width > 300 || img.height > 300) reject(new Error('Max 300x300 pixels'));
              else resolve(true);
          };
          img.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error('Invalid image'));
          };
          img.src = objectUrl;
      });

      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setMessage({ text: 'Avatar uploaded!', type: 'success' });
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xml' | 'sql' | 'markdown' | 'json') => {
    setExporting(true);
    try {
        const { data, error } = await supabase.from('bookmarks').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const bookmarks = data as Bookmark[];
        if (!bookmarks || bookmarks.length === 0) {
            alert('No bookmarks to export.');
            return;
        }

        let content = '';
        let mimeType = 'text/plain';
        let extension = 'txt';

        const escapeXml = (unsafe: string | null) => {
            if (!unsafe) return '';
            return unsafe.replace(/[<>&'"]/g, (c) => {
                const map: Record<string, string> = { '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' };
                return map[c];
            });
        };

        if (format === 'markdown') {
            mimeType = 'text/markdown';
            extension = 'md';
            content = `# LINKkiste Export - ${new Date().toISOString().slice(0, 10)}\n\n`;
            content += `Total Entries: ${bookmarks.length}\n\n---\n\n`;
            content += bookmarks.map((b, i) => {
                const isNote = !b.url || (b.tags && b.tags.includes('note'));
                const tags = b.tags && b.tags.length > 0 ? b.tags.map(t => `#${t}`).join(' ') : '';
                return `### ${i + 1}. ${b.title || 'Untitled'}\n` +
                    (b.url ? `- **URL:** [${b.url}](${b.url})\n` : `- **Type:** ${isNote ? 'Note / Scratchpad' : 'Wiki Page'}\n`) +
                    (tags ? `- **Tags:** ${tags}\n` : '') +
                    (b.description ? `\n> ${b.description}\n` : '') +
                    (b.notes ? `\n${b.notes}\n` : '') +
                    `\n*Created: ${b.created_at}*\n\n---`;
            }).join('\n\n');

        } else if (format === 'json') {
            mimeType = 'application/json';
            extension = 'json';
            content = JSON.stringify(bookmarks, null, 2);

        } else if (format === 'csv') {
            mimeType = 'text/csv';
            extension = 'csv';
            const headers = ['Title', 'URL', 'Tags', 'Folders', 'Description', 'Notes', 'To Read', 'Created At', 'Archive URL'];
            content = headers.join(',') + '\n';
            content += bookmarks.map((b) => {
                const escapeCsv = (field: any) => `"${String(field || '').replace(/"/g, '""')}"`;
                return [
                    escapeCsv(b.title),
                    escapeCsv(b.url),
                    escapeCsv(b.tags ? b.tags.join(' ') : ''),
                    escapeCsv(b.folders ? b.folders.join(' ') : ''),
                    escapeCsv(b.description),
                    escapeCsv(b.notes),
                    b.to_read ? 'true' : 'false',
                    escapeCsv(b.created_at),
                    escapeCsv(b.archive_url)
                ].join(',');
            }).join('\n');

        } else if (format === 'xml') {
            mimeType = 'application/xml';
            extension = 'xml';
            content = '<?xml version="1.0" encoding="UTF-8"?>\n<bookmarks>\n';
            content += bookmarks.map((b) => 
`  <bookmark>
    <title>${escapeXml(b.title)}</title>
    <url>${escapeXml(b.url)}</url>
    <tags>${escapeXml(b.tags ? b.tags.join(',') : '')}</tags>
    <folders>${escapeXml(b.folders ? b.folders.join(',') : '')}</folders>
    <description>${escapeXml(b.description)}</description>
    <toread>${b.to_read}</toread>
    <created>${b.created_at}</created>
    <archive>${escapeXml(b.archive_url)}</archive>
  </bookmark>`).join('\n');
            content += '\n</bookmarks>';

        } else if (format === 'sql') {
            mimeType = 'text/plain';
            extension = 'sql';
            content = '-- LINKkiste Backup\n-- Generated ' + new Date().toISOString() + '\n\n';
            content += bookmarks.map((b) => {
                const tagsList = b.tags || [];
                // Use escapeSqlString from utils (imported above) would be redundant here as we need custom array formatting,
                // but we check keys carefully.
                // Re-implementing specific safe logic for array literals:
                const tagsStr = tagsList.length > 0 ? `'{${tagsList.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}'` : "'{}'";
                const foldersList = b.folders || [];
                const foldersStr = foldersList.length > 0 ? `'{${foldersList.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}'` : "'{}'";
                
                return `INSERT INTO bookmarks (url, title, description, tags, folders, to_read, created_at, archive_url) VALUES (${escapeSqlString(b.url)}, ${escapeSqlString(b.title)}, ${escapeSqlString(b.description)}, ${tagsStr}, ${foldersStr}, ${b.to_read}, '${b.created_at}', ${escapeSqlString(b.archive_url)});`;
            }).join('\n');
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `linkkiste_export_${new Date().toISOString().slice(0,10)}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Fix Memory Leak
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        const now = new Date();
        localStorage.setItem('linkkiste_last_backup', now.toISOString());
        setLastBackup(now);

    } catch (err: any) {
        alert('Export failed: ' + err.message);
    } finally {
        setExporting(false);
    }
  };

  const getDaysDiff = () => {
      if (!lastBackup) return 999;
      const diffTime = Math.abs(new Date().getTime() - lastBackup.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const daysAgo = getDaysDiff();
  const isOverdue = !lastBackup || daysAgo > 5;

  // Function to snooze the backup reminder
  const handleSnooze = () => {
      // Set last backup date to today to reset the counter
      const now = new Date();
      localStorage.setItem('linkkiste_last_backup', now.toISOString());
      setLastBackup(now);
      setMessage({ text: 'Reminder snoozed for 5 days.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="max-w-xl pb-24">

      <h3 className="font-bold text-lg mb-6 border-b border-gray-200 pb-2">Profile Settings</h3>

      {message && (
        <div className={`mb-4 p-2 text-xs border ${message.type === 'success' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Privacy Tip */}
      <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 text-xs">
          <h4 className="font-bold text-yellow-800 mb-1 uppercase tracking-tighter">🔒 Privatsphäre-Tipp</h4>
          <p className="text-yellow-700 leading-relaxed">
              Um deine LINKkiste wirklich "nur für dich" zu machen, solltest du im Supabase Dashboard unter 
              <strong> Authentication &gt; Providers &gt; Email</strong> die Option <strong>"Allow new users to sign up"</strong> deaktivieren.
          </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 font-bold text-sm overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={`px-4 py-2 border-b-2 whitespace-nowrap ${activeTab === 'general' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>General</button>
          <button onClick={() => setActiveTab('km')} className={`px-4 py-2 border-b-2 whitespace-nowrap ${activeTab === 'km' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Features</button>
          <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 border-b-2 whitespace-nowrap ${activeTab === 'ai' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>AI Settings</button>
          <button onClick={() => setActiveTab('shortcuts')} className={`px-4 py-2 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'shortcuts' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <span>⌨️</span> Shortcuts
          </button>
          <button onClick={() => setActiveTab('account')} className={`px-4 py-2 border-b-2 whitespace-nowrap ${activeTab === 'account' ? 'border-del-blue text-del-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Account & Data</button>
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
      <div className="space-y-6">
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-4 text-purple-900">
              <span>🌍 Global Settings</span>
          </h3>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">App Language</label>
                    <select 
                        className="w-full web2-input p-2 rounded-sm text-sm outline-none"
                        value={(() => {
                            const match = document.cookie.match(/(^| )googtrans=([^;]+)/);
                            if (match) {
                                return match[2].split('/').pop() || 'en';
                            }
                            return 'en';
                        })()}
                        onChange={(e) => {
                            const lang = e.target.value;
                            const domain = window.location.hostname;
                            if (lang === 'en') {
                                document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`;
                                document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
                            } else {
                                document.cookie = `googtrans=/auto/${lang}; path=/; domain=${domain}`;
                                document.cookie = `googtrans=/auto/${lang}; path=/`;
                            }
                            window.location.reload();
                        }}
                    >
                        <option value="en">English (Default)</option>
                        <option value="de">Deutsch</option>
                        <option value="fr">Français</option>
                        <option value="ja">日本語 (Japanese)</option>
                        <option value="ko">한국어 (Korean)</option>
                        <option value="eo">Esperanto</option>
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1 mb-4">
                        Die gesamte Applikation wird automatisch in die gewählte Sprache übersetzt.
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-sm bg-gray-50 mt-4 mb-8">
                <div>
                    <strong className="text-sm text-gray-800 block">Show Database SQL Commands</strong>
                    <span className="text-xs text-gray-500">Zeigt den Link "Database Settings" am Ende der Link-Liste an.</span>
                </div>
                <button 
                    onClick={() => onToggleShowSqlHelpInMenu && onToggleShowSqlHelpInMenu(!showSqlHelpInMenu)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${showSqlHelpInMenu ? 'bg-del-green' : 'bg-gray-300'}`}
                >
                    <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-all ${showSqlHelpInMenu ? 'right-1' : 'left-1'}`}></div>
                </button>
            </div>
        </div>

        {/* Navigation & Tabs Manager */}
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <span>📑 Navigation & Tabs</span>
          </h4>
          <p className="text-xs text-gray-500 mb-4">
              Aktiviere oder deaktiviere einzelne Reiter in der oberen Navigationsleiste nach deinen Vorlieben:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'list', label: 'All Bookmarks', desc: 'Hauptübersicht aller Lesezeichen' },
              { key: 'notes', label: 'Notes', desc: 'Schnelle Notizen, Memos & Gedanken' },
              { key: 'wiki', label: 'Wiki Pages', desc: 'Vernetzte Wiki-Seiten & Dailies' },
              { key: 'unread', label: 'Unread', desc: 'Ungelesene Lesezeichen (Leseliste)' },
              { key: 'folders', label: 'Folders', desc: 'Ordner-Übersicht & Organisation' },
              { key: 'tags', label: 'Tags', desc: 'Tag-Cloud & Tag-Filterung' },
              { key: 'ai', label: 'AI Query', desc: 'KI-gestützte Wissenssuche' },
              { key: 'add', label: '+ Add', desc: 'Neues Lesezeichen manuell hinzufügen' },
            ].map(tab => {
              const isEnabled = enabledTabs[tab.key as keyof EnabledTabsConfig] !== false;
              return (
                <div key={tab.key} className="p-2.5 border border-gray-100 rounded-sm bg-gray-50 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">{tab.label}</span>
                    <span className="text-[10px] text-gray-500 leading-tight block">{tab.desc}</span>
                  </div>
                  {onToggleTab && (
                    <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 mt-0.5">
                      <div className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isEnabled ? 'bg-del-blue' : 'bg-gray-300'}`}>
                        <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transform transition-transform ${isEnabled ? 'translate-x-3.5' : 'translate-x-0'}`}></div>
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={isEnabled} 
                        onChange={(e) => {
                          const checked = e.target.checked;
                          onToggleTab(tab.key as keyof EnabledTabsConfig, checked);
                          if (onToggleKmFeature) {
                            if (tab.key === 'wiki') onToggleKmFeature('wiki', checked);
                            if (tab.key === 'ai') onToggleKmFeature('ai', checked);
                          }
                        }} 
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Capture & Notes Settings */}
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <span>⚡ Quick Capture & Notes</span>
          </h4>

          <div className="space-y-4">
            {/* Show Quick Capture Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Quick Capture Eingabeleiste</span>
                <span className="text-[10px] text-gray-500">Schnelleingabefeld am oberen Rand der Hauptlisten anzeigen.</span>
              </div>
              {onToggleShowQuickCapture && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showQuickCapture ? "bg-del-blue" : "bg-gray-300"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showQuickCapture ? "translate-x-4" : "translate-x-0"}`}></div>
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={localShowQuickCapture} 
                    onChange={(e) => { setLocalShowQuickCapture(e.target.checked); markQcChanged(); }} 
                  />
                </label>
              )}
            </div>

            {/* Default Tag */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Standard-Tag für Quick Captures</span>
                <span className="text-[10px] text-gray-500">Dieser Tag wird neuen Einträgen automatisch zugewiesen (z.B. <code>inbox</code>, <code>quick</code>, <code>capture</code>).</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 font-bold">#</span>
                <input 
                  type="text" 
                  value={localQcTag}
                  onChange={(e) => { setLocalQcTag(e.target.value.trim().toLowerCase()); markQcChanged(); }}
                  placeholder="inbox"
                  className="border border-gray-300 px-2 py-1 text-xs rounded-sm w-36 outline-none focus:border-del-blue font-bold text-gray-700 bg-white"
                />
              </div>
            </div>

            {/* Note Keyword Prefix */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Keyword für Notizen im Quick Capture</span>
                <span className="text-[10px] text-gray-500">Beginnt eine Eingabe mit diesem Keyword (z.B. <code>Note:</code>), wird sie direkt als reine Notiz gespeichert.</span>
              </div>
              <input 
                type="text" 
                value={localQcPrefix}
                onChange={(e) => { setLocalQcPrefix(e.target.value); markQcChanged(); }}
                placeholder="Note:"
                className="border border-gray-300 px-2 py-1 text-xs rounded-sm w-36 outline-none focus:border-del-blue font-mono font-bold text-gray-700 bg-white"
              />
            </div>

            {/* Always Save as Note Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Alle Quick Captures immer als Notiz speichern</span>
                <span className="text-[10px] text-gray-500">Falls aktiv, werden alle Quick Capture Eingaben unabhängig von URLs als Notizen gespeichert.</span>
              </div>
              {onToggleQuickCaptureAlwaysNote && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${quickCaptureAlwaysNote ? "bg-del-blue" : "bg-gray-300"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${quickCaptureAlwaysNote ? "translate-x-4" : "translate-x-0"}`}></div>
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={localQcAlwaysNote} 
                    onChange={(e) => { setLocalQcAlwaysNote(e.target.checked); markQcChanged(); }} 
                  />
                </label>
              )}
            </div>

            {/* Show Notes in All Bookmarks Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Notizen unter "All Bookmarks" anzeigen</span>
                <span className="text-[10px] text-gray-500">Wenn deaktiviert, erscheinen reine Notizen nur im "Notes"-Reiter und nicht in der Hauptliste.</span>
              </div>
              {onToggleShowNotesInList && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showNotesInList ? "bg-del-blue" : "bg-gray-300"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showNotesInList ? "translate-x-4" : "translate-x-0"}`}></div>
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={showNotesInList} 
                    onChange={(e) => onToggleShowNotesInList && onToggleShowNotesInList(e.target.checked)} 
                  />
                </label>
              )}
            </div>

            {/* Show Wiki in All Bookmarks Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Wiki-Seiten unter "All Bookmarks" anzeigen</span>
                <span className="text-[10px] text-gray-500">Wenn deaktiviert, erscheinen Wiki-Seiten nur im "Wiki Pages"-Reiter.</span>
              </div>
              {onToggleShowWikiInList && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${showWikiInList ? "bg-del-blue" : "bg-gray-300"}`}>
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${showWikiInList ? "translate-x-4" : "translate-x-0"}`}></div>
                  </div>
                  <input 
                    type="checkbox" 
                    className="hidden" 
                    checked={showWikiInList} 
                    onChange={(e) => onToggleShowWikiInList && onToggleShowWikiInList(e.target.checked)} 
                  />
                </label>
              )}
            </div>
            
            <div className="pt-2 flex justify-end">
                    <button 
                        onClick={handleSaveQc}
                        disabled={isSavingQc || !qcUnsaved}
                        className="bg-del-blue text-white px-4 py-1.5 rounded-sm text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                        {isSavingQc ? 'Speichern...' : 'Speichern'}
                    </button>
                </div>
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <span>⚙️ View & Display</span>
          </h4>
          
          <div className="mb-4 pb-4 border-b border-gray-100">
               <label className="block text-xs font-bold text-gray-600 mb-2">Pagination Präferenz</label>
               <div className="flex items-center gap-2">
                   {onTogglePagination && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                          <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${usePagination ? 'bg-del-blue' : 'bg-gray-300'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${usePagination ? 'translate-x-4' : 'translate-x-0'}`}></div>
                          </div>
                          <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={usePagination} 
                              onChange={(e) => onTogglePagination && onTogglePagination(e.target.checked)} 
                          />
                          <span className="text-xs text-gray-700 font-bold">
                              {usePagination ? 'Pages (Pagination - 20 items per page)' : 'Endless List (Show All)'}
                          </span>
                      </label>
                   )}
               </div>
               <p className="text-[10px] text-gray-400 mt-1">
                   "Pages" splits your list into 20 items per page. "Endless List" shows everything at once.
               </p>
          </div>
          <div className="mb-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Archive Service Domain</label>
              <div className="flex gap-2">
                  <input 
                      type="text" 
                      value={archiveDomain}
                      onChange={(e) => setArchiveDomain(e.target.value)}
                      className="border border-gray-300 p-1.5 text-xs rounded-sm w-64 outline-none focus:border-del-blue"
                      placeholder="https://archive.is"
                  />
                  <button 
                      onClick={saveArchiveDomain}
                      className="bg-gray-100 border border-gray-300 hover:bg-gray-200 text-xs px-3 rounded-sm font-bold"
                  >
                      Save
                  </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                  The domain used for the single-click archive shortcut.
              </p>
          </div>
        </div>

        {/* Browser Bookmarklet */}
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <span>🔖 Browser Bookmarklet</span>
          </h4>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Mit dem Bookmarklet kannst du jede beliebige Webseite während des Surfens mit einem Klick in LINKkiste speichern.
          </p>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                      <div className="text-xs font-bold text-gray-800 mb-1.5">1. Per Drag & Drop:</div>
                      <a 
                          href={`javascript:(function(){var url=encodeURIComponent(window.location.href);var title=encodeURIComponent(document.title);var sel=encodeURIComponent(window.getSelection().toString());var w=window.open('${window.location.origin}/?mode=popup&url='+url+'&title='+title+(sel?'&description='+sel:''),'linkkiste_popup','width=520,height=550,location=no,toolbar=no,menubar=no');if(w)w.focus();})();`}
                          className="inline-flex items-center gap-2 bg-del-blue hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-sm shadow cursor-grab active:cursor-grabbing select-none"
                          title="In die Lesezeichenleiste ziehen"
                      >
                          <span>📥 +LINKkiste</span>
                      </a>
                      <span className="text-[11px] text-gray-500 ml-2">← Diesen Button in deine Lesezeichenleiste ziehen</span>
                  </div>
                  <div className="text-[11px] text-gray-600 max-w-sm bg-white p-2.5 rounded border border-blue-100 shadow-2xs">
                      💡 <strong>Highlight-Funktion:</strong> Wenn du vor dem Klick auf das Bookmarklet Text auf einer Website markierst, wird dieser automatisch als Zitat/Beschreibung übernommen!
                  </div>
              </div>

              <div className="border-t border-blue-100 pt-3">
                  <div className="text-xs font-bold text-gray-800 mb-1">2. Oder als Lesezeichen-URL manuell kopieren:</div>
                  <div className="flex items-center gap-2">
                      <input 
                          type="text" 
                          readOnly 
                          value={`javascript:(function(){var url=encodeURIComponent(window.location.href);var title=encodeURIComponent(document.title);var sel=encodeURIComponent(window.getSelection().toString());var w=window.open('${window.location.origin}/?mode=popup&url='+url+'&title='+title+(sel?'&description='+sel:''),'linkkiste_popup','width=520,height=550,location=no,toolbar=no,menubar=no');if(w)w.focus();})();`}
                          className="w-full text-[10px] font-mono bg-white border border-gray-300 p-1.5 rounded-sm select-all text-gray-600 outline-none"
                      />
                      <button 
                          type="button"
                          onClick={() => {
                              const code = `javascript:(function(){var url=encodeURIComponent(window.location.href);var title=encodeURIComponent(document.title);var sel=encodeURIComponent(window.getSelection().toString());var w=window.open('${window.location.origin}/?mode=popup&url='+url+'&title='+title+(sel?'&description='+sel:''),'linkkiste_popup','width=520,height=550,location=no,toolbar=no,menubar=no');if(w)w.focus();})();`;
                              navigator.clipboard.writeText(code);
                              setMessage({ text: 'Bookmarklet-Code in die Zwischenablage kopiert!', type: 'success' });
                          }}
                          className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-sm whitespace-nowrap shadow-2xs"
                      >
                          📋 Code kopieren
                      </button>
                  </div>
              </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab: Features (Knowledge Management) */}
      {activeTab === 'km' && (
      <div className="space-y-6">
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <span>🧠 Knowledge Management Modules</span>
          </h4>
          
           <div className="space-y-4">
              {onToggleKmFeature && kmFeatures && (
                  <>
                     <div className="p-3 border border-gray-100 rounded-sm hover:bg-gray-50 flex items-start justify-between gap-4">
                         <div>
                             <span className="text-xs text-gray-800 font-bold block">Wiki Pages & Notes</span>
                             <span className="text-[10px] text-gray-500">Markdown-Wiki-System mit Zwei-Wege-Backlinks, Tagesnotizen (Daily Notes) und Querverlinkungen.</span>
                         </div>
                         <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                             <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${kmFeatures.wiki ? 'bg-del-blue' : 'bg-gray-300'}`}>
                                 <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${kmFeatures.wiki ? 'translate-x-4' : 'translate-x-0'}`}></div>
                             </div>
                             <input 
                                 type="checkbox" 
                                 className="hidden" 
                                 checked={kmFeatures.wiki} 
                                 onChange={(e) => onToggleKmFeature && onToggleKmFeature('wiki', e.target.checked)} 
                             />
                         </label>
                     </div>

                     <div className="p-3 border border-gray-100 rounded-sm hover:bg-gray-50 flex items-start justify-between gap-4">
                         <div>
                             <span className="text-xs text-gray-800 font-bold block">AI Query & Assistent</span>
                             <span className="text-[10px] text-gray-500">Aktiviert KI-gestützte Wissenssuche ("Chat with Knowledge Base") und KI-Schreibunterstützung im Wiki.</span>
                         </div>
                         <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                             <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${kmFeatures.ai ? 'bg-del-blue' : 'bg-gray-300'}`}>
                                 <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${kmFeatures.ai ? 'translate-x-4' : 'translate-x-0'}`}></div>
                             </div>
                             <input 
                                 type="checkbox" 
                                 className="hidden" 
                                 checked={kmFeatures.ai} 
                                 onChange={(e) => onToggleKmFeature && onToggleKmFeature('ai', e.target.checked)} 
                             />
                         </label>
                     </div>
                  </>
              )}
          </div>
          <p className="text-[10px] text-gray-400 mt-4 leading-relaxed border-t border-gray-100 pt-2">
              Deactivate modules if you prefer a classic, distraction-free link-saving tool.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 shadow-sm rounded-sm">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-600 mb-2">
              💡 PKM & Wissensmanagement Power-Features
          </h4>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li><strong>Quick Capture Bar:</strong> In der Lesezeichenliste oben direkt URLs oder spontane Gedanken/Notizen abkippen.</li>
              <li><strong>Spotlight Quick Search (⌘K / Strg+K):</strong> Jederzeit per Tastatur aufrufen, um Bookmarks, Notizen oder Wiki-Seiten blitzschnell zu finden oder anzulegen.</li>
              <li><strong>Daily Notes (Tagesnotizen):</strong> In der Wiki-Ansicht auf <em>"📅 Today"</em> klicken, um automatisch eine formatierte Tagesnotiz anzulegen oder zu öffnen.</li>
              <li><strong>Unlinked Mentions (Automatische Link-Erkennung):</strong> Zeigt in Wiki-Seiten an, wo der Seitentitel in anderen Notizen erwähnt wird, und erlaubt Verlinkung per 1-Klick (+ Link).</li>
              <li><strong>Bi-direktionale Wikilinks:</strong> <code>[[Seitenname]]</code> in beliebigen Notizen verwenden oder über die Editor-Symbolleiste <em>[[Wikilink]]</em> suchen.</li>
              <li><strong>AI Query Wissens-Chat:</strong> Konversation mit deiner Wissensbasis führen mit vorgeschlagenen Fragen und Unterstützung benutzerdefinierter OpenRouter-Modelle.</li>
          </ul>
        </div>
      </div>
      )}

      {/* Tab: AI Settings */}
      {activeTab === 'ai' && (
      <div className="space-y-6">
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-2 flex items-center gap-2 mb-4">
              <span>✨ AI API & Models</span>
          </h3>
          
          <div className="mb-6 pb-4 border-b border-gray-100">
              <label className="block text-xs font-bold text-gray-700 mb-1 mt-4">Clipping Language</label>
              <input 
                  type="text" 
                  className="w-full web2-input p-2 rounded-sm text-sm outline-none" 
                  placeholder="e.g. German, English, Spanish (leave empty for auto)" 
                  value={localClippingLang} 
                  onChange={(e) => { setLocalClippingLang(e.target.value); markAiChanged(); }} 
              />
              <p className="text-[10px] text-gray-500 mt-1 mb-4">
                  Die KI wird versuchen, die Zusammenfassung in dieser Sprache zu schreiben, unabhängig von der Originalsprache des Artikels.
              </p>

              <label className="block text-xs font-bold text-gray-700 mb-1 mt-4">AI Base URL (Provider Endpoint)</label>
              <input 
                  type="text" 
                  className="w-full web2-input p-2 rounded-sm text-sm outline-none font-mono" 
                  placeholder="https://openrouter.ai/api/v1" 
                  value={localAiBaseUrl} 
                  onChange={(e) => { setLocalAiBaseUrl(e.target.value); markAiChanged(); }} 
              />
              <p className="text-[10px] text-gray-500 mt-1 mb-4">
                  Standard: <strong>https://openrouter.ai/api/v1</strong><br/>
                  Beispiele: <strong>https://api.openai.com/v1</strong> (OpenAI), <strong>https://api.groq.com/openai/v1</strong> (Groq), <strong>http://localhost:11434/v1</strong> (Ollama).
              </p>

              <label className="block text-xs font-bold text-gray-700 mb-1">AI API Key</label>
              <div className="flex gap-2 mb-1">
                  <input 
                      type="password" 
                      value={localOpenRouterKey}
                      onChange={(e) => { setLocalOpenRouterKey(e.target.value); markAiChanged(); }}
                      className="border border-gray-300 p-2 text-sm rounded-sm w-full outline-none focus:border-purple-500 font-mono"
                      placeholder="sk-or-v1-... (optional: uses server key if empty)"
                  />
                  <button 
                      onClick={fetchModels}
                      disabled={fetchingModels}
                      className="bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs px-3 rounded-sm font-bold whitespace-nowrap"
                  >
                      {fetchingModels ? 'Lade...' : 'Modelle laden'}
                  </button>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                  Dein Key wird sicher lokal in deinem Browser vorgehalten. Wenn du keinen Key einträgst, wird der Standard-Key des Servers verwendet.
              </p>
          </div>

          <div className="space-y-4">
              <ModelSelect
                  label='Standard-Modell für "AI Query" (Wissensbasis-Chat)'
                  value={localQueryModel}
                  onChange={(modelId) => { setLocalQueryModel(modelId); markAiChanged(); }}
                  models={aiModels}
                  placeholder="-- Standard (Server-Empfehlung) --"
                  helpText='Dieses Modell wird verwendet, wenn du im Reiter "AI Query" Fragen zu deiner Wissensbasis stellst.'
              />

              <ModelSelect
                  label='Standard-Modell für "Wiki Assist" (Text-Schreibassistent)'
                  value={localWikiModel}
                  onChange={(modelId) => { setLocalWikiModel(modelId); markAiChanged(); }}
                  models={aiModels}
                  placeholder="-- Standard (Server-Empfehlung) --"
                  helpText="Dieses Modell generiert Textentwürfe und Zusammenfassungen direkt im Wiki-Editor."
              />
              
              <div className="pt-4 flex justify-end">
                    <button 
                        onClick={handleSaveAi}
                        disabled={isSavingAi || !aiUnsaved}
                        className="bg-del-blue text-white px-4 py-1.5 rounded-sm text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                        {isSavingAi ? 'Speichern...' : 'Speichern'}
                    </button>
                </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab: Account & Data */}
      {activeTab === 'account' && (
      <div className="space-y-6">
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
            <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <span>🧹 Maintenance & Deduplication</span>
            </h4>
            <div className="flex items-center gap-4">
                <button 
                  onClick={checkForDuplicates}
                  disabled={checkingDupes}
                  className="bg-gray-100 hover:bg-gray-200 text-black border border-gray-300 text-xs font-bold px-4 py-2 rounded-sm disabled:opacity-50"
                >
                    {checkingDupes ? 'Scanning...' : 'Check for Duplicates'}
                </button>
                <span className="text-xs text-gray-500">Scan your library for identical URLs.</span>
            </div>

            {duplicates && (
                <div className="mt-4 p-4 bg-[#f0fdf4] border border-green-200 rounded-sm">
                    <h5 className="text-del-blue font-bold text-xs uppercase mb-3 border-b border-green-200 pb-2">
                        Found {Object.keys(duplicates).length} Duplicate Groups
                    </h5>
                    <div className="space-y-6">
                        {Object.entries(duplicates).map(([key, list]: [string, Bookmark[]]) => (
                            <div key={key} className="text-xs">
                                <p className="font-bold text-gray-700 mb-1 break-all bg-white/50 p-1 rounded-sm">{key}</p>
                                <ul className="space-y-1 pl-1">
                                    {list.map(bm => (
                                        <li key={bm.id} className="flex items-center justify-between border-b border-green-100 last:border-0 py-1">
                                            <div>
                                              <span className="font-bold text-gray-800">{bm.title}</span>
                                              <span className="text-gray-400 mx-1">-</span>
                                              <span className="text-gray-500">{new Date(bm.created_at).toLocaleDateString()}</span>
                                              {bm.tags && bm.tags.length > 0 && <span className="ml-2 text-[10px] text-gray-400">[{bm.tags.join(', ')}]</span>}
                                            </div>
                                            <button onClick={() => deleteDuplicate(bm.id, key)} className="text-red-500 hover:text-red-700 hover:underline font-bold px-2 uppercase text-[10px]">Delete</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Import Section */}
        <div className="p-4 bg-white border border-gray-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <span>📥 Bookmarks importieren</span>
              </h4>
              <div className="flex flex-wrap gap-1 text-[10px]">
                <span className="bg-blue-50 text-del-blue border border-blue-200 font-bold px-1.5 py-0.5 rounded-2xs">Pinboard</span>
                <span className="bg-blue-50 text-del-blue border border-blue-200 font-bold px-1.5 py-0.5 rounded-2xs">Raindrop.io</span>
                <span className="bg-blue-50 text-del-blue border border-blue-200 font-bold px-1.5 py-0.5 rounded-2xs">Pocket</span>
                <span className="bg-blue-50 text-del-blue border border-blue-200 font-bold px-1.5 py-0.5 rounded-2xs">Instapaper</span>
                <span className="bg-blue-50 text-del-blue border border-blue-200 font-bold px-1.5 py-0.5 rounded-2xs">Delicious</span>
                <span className="bg-blue-50 text-del-blue border border-blue-200 font-bold px-1.5 py-0.5 rounded-2xs">Browser HTML</span>
              </div>
          </div>
          <p className="text-xs text-gray-600">
            Importiere deine Lesezeichen nahtlos aus <strong>Pinboard</strong> (JSON/XML/HTML), <strong>Raindrop.io</strong>, <strong>Pocket</strong>, <strong>Instapaper</strong>, <strong>Readwise</strong>, <strong>Delicious</strong> oder beliebigen Browsern (Chrome, Firefox, Safari, Edge, Brave) sowie aus CSV-, HTML-, JSON- und XML-Dateien.
          </p>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const file = e.dataTransfer.files?.[0];
              if (file) processImportFile(file);
            }}
            className={`border-2 border-dashed rounded-xs p-5 text-center transition-colors ${
              isDraggingFile 
                ? 'border-del-blue bg-blue-50/60 ring-2 ring-del-blue/30' 
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl">{isParsingFile ? '⏳' : '📂'}</span>
              <div className="text-xs text-gray-700">
                <span className="font-bold">Datei hierher ziehen</span> oder vom Computer auswählen
              </div>
              <div className="text-[11px] text-gray-400">
                Unterstützte Formate: <span className="font-mono text-gray-600">.html / .htm</span> (Browser & Netscape), <span className="font-mono text-gray-600">.json</span> (Pinboard, Raindrop, Backups), <span className="font-mono text-gray-600">.csv</span> (Raindrop, Instapaper, Tabellen), <span className="font-mono text-gray-600">.xml</span> (Pinboard / Delicious)
              </div>
              <label className="mt-2 inline-flex items-center gap-1.5 bg-del-blue hover:bg-blue-700 border border-blue-800 text-white text-xs font-bold py-1.5 px-4 rounded-xs cursor-pointer shadow-2xs">
                <span>Datei auswählen</span>
                <input
                  type="file"
                  accept=".html,.htm,.csv,.json,.xml,text/html,text/csv,application/json,application/xml,text/xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processImportFile(file);
                    e.target.value = '';
                  }}
                  disabled={isParsingFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {importFileError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{importFileError}</span>
            </div>
          )}
        </div>

        {/* Export Section */}
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-sm flex items-center gap-2"><span>💾 Data Export & Backup</span></h4>
          </div>
          {isOverdue && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-sm flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                          <h5 className="font-bold text-red-800 text-sm">Backup überfällig!</h5>
                          <p className="text-xs text-red-700 mt-1">Dein letztes lokales Backup ist {lastBackup ? `${daysAgo} Tage` : 'sehr lange'} her.</p>
                      </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1 ml-0 sm:ml-9">
                      <button onClick={() => handleExport('sql')} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-sm shadow-sm transition-colors text-center">Jetzt Backup herunterladen (SQL)</button>
                      <button onClick={handleSnooze} className="bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold py-2 px-4 rounded-sm transition-colors text-center">Erinnere mich nochmal in fünf Tagen</button>
                  </div>
              </div>
          )}
          <p className="text-xs text-gray-600 mb-4">
              Manuelle Downloads für deine Datensicherung.
              {!isOverdue && lastBackup && (<span className="text-green-600 block mt-1 font-bold">✓ Alles okay. Letztes Backup: {lastBackup.toLocaleDateString('de-DE')}</span>)}
          </p>
          <div className="flex flex-wrap gap-2.5">
              <button onClick={() => handleExport('markdown')} disabled={exporting} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                <span>📝</span> {exporting ? '...' : 'Download Markdown (.md)'}
              </button>
              <button onClick={() => handleExport('json')} disabled={exporting} className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50 flex items-center gap-1 cursor-pointer">
                <span>📦</span> {exporting ? '...' : 'Download JSON'}
              </button>
              <button onClick={() => handleExport('csv')} disabled={exporting} className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-black text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50 cursor-pointer">{exporting ? '...' : 'Download CSV'}</button>
              <button onClick={() => handleExport('xml')} disabled={exporting} className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-black text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50 cursor-pointer">{exporting ? '...' : 'Download XML'}</button>
              <button onClick={() => handleExport('sql')} disabled={exporting} className="bg-del-blue hover:bg-blue-700 border border-blue-800 text-white text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50 cursor-pointer">{exporting ? '...' : 'Download SQL (Restore File)'}</button>
          </div>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 text-xs">
            <h4 className="font-bold text-del-dark-blue mb-1">System Status</h4>
            <div className="flex flex-col gap-1 text-gray-600">
               <div><span className="font-bold">Connected Project ID:</span> {projectId}</div>
               <div><span className="font-bold">URL:</span> {projectUrl}</div>
            </div>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200">
          <h4 className="font-bold text-sm mb-2">User Photo</h4>
          <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gray-200 border border-gray-300 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xs">No img</span>}
              </div>
              <div>
                  <label className="block text-xs font-bold mb-1">Upload new photo (JPG, max 300x300)</label>
                  <input type="file" accept="image/jpeg" onChange={uploadAvatar} disabled={uploading} className="text-xs text-gray-500" />
                  {uploading && <span className="text-xs text-blue-600 ml-2">Uploading...</span>}
              </div>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="p-4 bg-gray-50 border border-gray-200">
          <h4 className="font-bold text-sm mb-4">Change Password</h4>
          <div className="mb-4">
              <label className="block text-xs font-bold mb-1">New Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full md:w-64 border border-gray-400 p-1.5 text-sm focus:border-retro-blue outline-none mb-3" placeholder="Enter new password" minLength={6} required />
              
              <label className="block text-xs font-bold mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full md:w-64 border border-gray-400 p-1.5 text-sm focus:border-retro-blue outline-none" placeholder="Confirm new password" minLength={6} required />
          </div>
          <button type="submit" disabled={loading || !password || password !== confirmPassword} className="bg-retro-blue text-white px-4 py-1 text-sm font-bold hover:bg-blue-800 disabled:opacity-50">{loading ? 'Updating...' : 'Update Password'}</button>
        </form>
      </div>
      )}

      {/* Tab: Shortcuts */}
      {activeTab === 'shortcuts' && (
      <div className="space-y-6">
        <div className="p-4 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
            <span className="text-base">⌨️</span>
            <h4 className="font-bold text-sm text-gray-800">Tastaturkürzel (Keyboard Shortcuts)</h4>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Bedientaste drücken, um blitzschnell ohne Maus durch LINKkiste zu navigieren. Wenn ein Textfeld aktiv ist, sind die Navigationskürzel automatisch deaktiviert.
          </p>

          <div className="space-y-4">
            {/* Group: Navigation */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Navigation</h5>
              <div className="border border-gray-200 divide-y divide-gray-100 text-xs rounded-xs overflow-hidden">
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                  <span className="text-gray-700">Zu allen Lesezeichen (All Bookmarks)</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">B</kbd>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <span className="text-gray-700">Zu Notizen & Scratchpad (Notes)</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">N</kbd>
                </div>
                {enabledTabs?.wiki !== false && (
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                    <span className="text-gray-700">Zu Wiki-Seiten & Kalender (Wiki)</span>
                    <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">W</kbd>
                  </div>
                )}
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <span className="text-gray-700">Zu Ungelesen / Leseliste (Unread)</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">U</kbd>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                  <span className="text-gray-700">Zu Ordnern (Folders)</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">F</kbd>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <span className="text-gray-700">Zu Schlagwörtern / Tag Cloud (Tags)</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">T</kbd>
                </div>
                {enabledTabs?.ai !== false && (
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                    <span className="text-gray-700">Zu AI Knowledge Query</span>
                    <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">A</kbd>
                  </div>
                )}
              </div>
            </div>

            {/* Group: Suche & Aktionen */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Suche & Aktionen</h5>
              <div className="border border-gray-200 divide-y divide-gray-100 text-xs rounded-xs overflow-hidden">
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                  <span className="text-gray-700">Globale Suchleiste fokussieren</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">/</kbd>
                    <span className="text-gray-400 text-[10px]">oder</span>
                    <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">S</kbd>
                  </div>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <span className="text-gray-700">Neues Lesezeichen / Eintrag anlegen</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">+</kbd>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                  <span className="text-gray-700">Shortcuts-Overlay öffnen / schließen</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">?</kbd>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <span className="text-gray-700">Fokus entfernen / Modal schließen</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">Esc</kbd>
                </div>
              </div>
            </div>

            {/* Group: Notizen & Markdown Shortcuts */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Notiz- & Wiki-Syntax</h5>
              <div className="border border-gray-200 divide-y divide-gray-100 text-xs rounded-xs overflow-hidden">
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                  <span className="text-gray-700">Wikilink Autovervollständigung (im Editor)</span>
                  <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded font-mono font-bold text-gray-800 shadow-2xs">[[</kbd>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-white">
                  <span className="text-gray-700">Interaktive Aufgabenliste / Checkbox</span>
                  <code className="px-2 py-0.5 bg-gray-100 text-gray-700 font-mono text-[11px] rounded">- [ ] Aufgabe</code>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50/50">
                  <span className="text-gray-700">Erledigte Aufgabe abhaken</span>
                  <span className="text-gray-500 italic">Direkt per Klick auf die Checkbox</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Import Modal with Safety Confirmation Dialog */}
      <ImportBookmarksModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        session={session}
        parsedItems={parsedImportItems}
        fileName={importFileName}
        formatName={importFormatName}
        currentCount={bookmarks.length}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};