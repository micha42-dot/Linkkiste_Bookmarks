import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Bookmark } from '../types';
import { normalizeUrl, escapeSqlString } from '../utils/helpers';

interface SettingsProps {
  session: Session;
  usePagination?: boolean;
  onTogglePagination?: (enabled: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ session, usePagination, onTogglePagination }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: React.ReactNode; type: 'success' | 'error' } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [archiveDomain, setArchiveDomain] = useState('https://archive.is');
  const [checkingDupes, setCheckingDupes] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, Bookmark[]> | null>(null);

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
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: password });
    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ text: 'Password updated successfully.', type: 'success' });
      setPassword('');
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

  const handleExport = async (format: 'csv' | 'xml' | 'sql') => {
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

        if (format === 'csv') {
            mimeType = 'text/csv';
            extension = 'csv';
            const headers = ['Title', 'URL', 'Tags', 'Folders', 'Description', 'To Read', 'Created At', 'Archive URL'];
            content = headers.join(',') + '\n';
            content += bookmarks.map((b) => {
                const escapeCsv = (field: any) => `"${String(field || '').replace(/"/g, '""')}"`;
                return [
                    escapeCsv(b.title),
                    escapeCsv(b.url),
                    escapeCsv(b.tags ? b.tags.join(' ') : ''),
                    escapeCsv(b.folders ? b.folders.join(' ') : ''),
                    escapeCsv(b.description),
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
    <div className="max-w-xl">
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

      {/* Configuration */}
      <div className="mb-8 p-4 bg-white border border-gray-200 shadow-sm">
        <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
            <span>⚙️ Configuration</span>
        </h4>
        
        <div className="mb-4 pb-4 border-b border-gray-100">
             <label className="block text-xs font-bold text-gray-600 mb-2">View Preference</label>
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
                            onChange={(e) => onTogglePagination(e.target.checked)} 
                        />
                        <span className="text-xs text-gray-700">
                            {usePagination ? 'Pages (Pagination)' : 'Endless List (Show All)'}
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
        </div>
      </div>

      {/* Maintenance / Duplicates */}
      <div className="mb-8 p-4 bg-white border border-gray-200 shadow-sm">
          <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
            <span>🧹 Maintenance</span>
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

      {/* Export Section */}
      <div className="mb-8 p-4 bg-white border border-gray-200 shadow-sm">
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
        <div className="flex gap-3">
            <button onClick={() => handleExport('csv')} disabled={exporting} className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-black text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50">{exporting ? '...' : 'Download CSV'}</button>
            <button onClick={() => handleExport('xml')} disabled={exporting} className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-black text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50">{exporting ? '...' : 'Download XML'}</button>
            <button onClick={() => handleExport('sql')} disabled={exporting} className="bg-del-blue hover:bg-blue-700 border border-blue-800 text-white text-xs font-bold py-1.5 px-3 rounded-sm disabled:opacity-50">{exporting ? '...' : 'Download SQL (Restore File)'}</button>
        </div>
      </div>

      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 text-xs">
          <h4 className="font-bold text-del-dark-blue mb-1">System Status</h4>
          <div className="flex flex-col gap-1 text-gray-600">
             <div><span className="font-bold">Connected Project ID:</span> {projectId}</div>
             <div><span className="font-bold">URL:</span> {projectUrl}</div>
          </div>
      </div>

      <div className="mb-8 p-4 bg-gray-50 border border-gray-200">
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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full md:w-64 border border-gray-400 p-1.5 text-sm focus:border-retro-blue outline-none" placeholder="Enter new password" minLength={6} required />
        </div>
        <button type="submit" disabled={loading || !password} className="bg-retro-blue text-white px-4 py-1 text-sm font-bold hover:bg-blue-800 disabled:opacity-50">{loading ? 'Updating...' : 'Update Password'}</button>
      </form>
    </div>
  );
};