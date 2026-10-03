import React, { useState } from 'react';
import { ParsedBookmarkItem } from '../utils/importParsers';
import { supabase } from '../services/supabaseClient';
import { Session } from '@supabase/supabase-js';

interface ImportBookmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  parsedItems: ParsedBookmarkItem[];
  fileName: string;
  formatName: string;
  currentCount: number;
  onSuccess: (importedCount: number, mode: 'append' | 'replace') => void;
}

export const ImportBookmarksModal: React.FC<ImportBookmarksModalProps> = ({
  isOpen,
  onClose,
  session,
  parsedItems,
  fileName,
  formatName,
  currentCount,
  onSuccess
}) => {
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartImport = async () => {
    if (!session?.user?.id) {
      setErrorMsg('Nicht eingeloggt. Bitte neu anmelden.');
      return;
    }

    if (parsedItems.length === 0) {
      setErrorMsg('Keine gültigen Lesezeichen zum Importieren gefunden.');
      return;
    }

    if (mode === 'replace' && !confirmReplaceChecked) {
      setErrorMsg('Bitte bestätige die Checkbox, um das Ersetzen deiner aktuellen Sammlung zu autorisieren.');
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);
    setProgress({ current: 0, total: parsedItems.length });

    try {
      // 1. If replace mode: Delete all existing user bookmarks
      if (mode === 'replace') {
        const { error: deleteError } = await supabase
          .from('bookmarks')
          .delete()
          .eq('user_id', session.user.id);

        if (deleteError) {
          throw new Error('Fehler beim Löschen der bisherigen Bookmarks: ' + deleteError.message);
        }
      }

      // 2. Batch insert parsed items in chunks of 50
      const CHUNK_SIZE = 50;
      let insertedSoFar = 0;

      for (let i = 0; i < parsedItems.length; i += CHUNK_SIZE) {
        const chunk = parsedItems.slice(i, i + CHUNK_SIZE);
        const rowsToInsert = chunk.map(item => ({
          user_id: session.user.id,
          title: item.title,
          url: item.url || null,
          description: item.description || null,
          notes: item.notes || null,
          tags: item.tags || [],
          folders: item.folders || [],
          to_read: Boolean(item.to_read),
          created_at: item.created_at || new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('bookmarks')
          .insert(rowsToInsert);

        if (insertError) {
          throw new Error(`Fehler bei Batch-Eintrag (${i + 1}-${i + chunk.length}): ` + insertError.message);
        }

        insertedSoFar += chunk.length;
        setProgress({ current: insertedSoFar, total: parsedItems.length });
      }

      // Success
      onSuccess(insertedSoFar, mode);
      onClose();
    } catch (err: any) {
      console.error('Import failed:', err);
      setErrorMsg(err.message || 'Ein unerwarteter Fehler ist beim Import aufgetreten.');
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs font-arial animate-in fade-in duration-150">
      <div className="bg-white border-2 border-del-blue shadow-2xl max-w-lg w-full rounded-sm overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#3274D1] text-white px-4 py-3 flex justify-between items-center select-none">
          <div className="flex items-center gap-2">
            <span className="text-lg">📥</span>
            <h3 className="font-bold text-sm">Bookmarks importieren & überprüfen</h3>
          </div>
          {!isImporting && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white font-bold text-base px-1.5 leading-none"
              title="Schließen"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* File summary */}
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-xs space-y-1">
            <div className="flex justify-between items-center text-gray-700">
              <span className="text-gray-500">Datei:</span>
              <span className="font-bold truncate max-w-[260px]" title={fileName}>{fileName}</span>
            </div>
            <div className="flex justify-between items-center text-gray-700">
              <span className="text-gray-500">Erkanntes Format:</span>
              <span className="font-medium text-del-dark-blue">{formatName}</span>
            </div>
            <div className="flex justify-between items-center text-gray-700 pt-1 border-t border-gray-200">
              <span className="text-gray-500">Gefundene Lesezeichen:</span>
              <span className="font-bold text-green-700 text-sm">{parsedItems.length} Einträge</span>
            </div>
            <div className="flex justify-between items-center text-gray-700">
              <span className="text-gray-500">Aktuelle Sammlung:</span>
              <span className="font-bold text-gray-800">{currentCount} Einträge</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div>
            <label className="font-bold text-gray-800 block mb-2 text-xs">
              Wähle die Import-Methode:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Option: Append */}
              <label 
                className={`flex flex-col p-3 border rounded-xs cursor-pointer transition-colors ${
                  mode === 'append' 
                    ? 'border-del-blue bg-blue-50/50 shadow-2xs ring-1 ring-del-blue' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-gray-800">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={mode === 'append'}
                    onChange={() => { setMode('append'); setConfirmReplaceChecked(false); }}
                    disabled={isImporting}
                    className="accent-del-blue cursor-pointer"
                  />
                  <span>Hinzufügen</span>
                </div>
                <span className="text-gray-500 mt-1 pl-5 text-[11px] leading-tight">
                  Behält alle aktuellen {currentCount} Bookmarks und fügt {parsedItems.length} neue hinzu.
                </span>
              </label>

              {/* Option: Replace */}
              <label 
                className={`flex flex-col p-3 border rounded-xs cursor-pointer transition-colors ${
                  mode === 'replace' 
                    ? 'border-red-500 bg-red-50/50 shadow-2xs ring-1 ring-red-500' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-red-800">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                    disabled={isImporting}
                    className="accent-red-600 cursor-pointer"
                  />
                  <span>Ersetzen (Clean Slate)</span>
                </div>
                <span className="text-red-700/80 mt-1 pl-5 text-[11px] leading-tight">
                  Löscht alle bisherigen {currentCount} Bookmarks und ersetzt sie durch die {parsedItems.length} importierten.
                </span>
              </label>
            </div>
          </div>

          {/* Double-Check Box for "Replace" */}
          {mode === 'replace' && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xs space-y-2 animate-in fade-in duration-150">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <h4 className="font-bold text-xs">Achtung: Unwiderruflicher Schritt</h4>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    Deine aktuellen <strong>{currentCount} Lesezeichen</strong> werden vollständig aus der Datenbank gelöscht. Dies kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 border-t border-red-200 cursor-pointer font-bold text-[11px] text-red-900">
                <input
                  type="checkbox"
                  checked={confirmReplaceChecked}
                  onChange={(e) => setConfirmReplaceChecked(e.target.checked)}
                  disabled={isImporting}
                  className="accent-red-600 h-4 w-4 cursor-pointer"
                />
                <span>Ja, ich möchte meine bisherigen Daten unwiderruflich ersetzen.</span>
              </label>
            </div>
          )}

          {/* Preview of first 3-4 items */}
          <div>
            <h4 className="font-bold text-gray-700 mb-1 text-[11px] uppercase tracking-wider">
              Vorschau ({Math.min(3, parsedItems.length)} von {parsedItems.length}):
            </h4>
            <div className="border border-gray-200 rounded-xs max-h-32 overflow-y-auto divide-y divide-gray-100 bg-gray-50/50">
              {parsedItems.slice(0, 4).map((item, idx) => (
                <div key={idx} className="p-2 text-[11px]">
                  <div className="font-bold text-gray-800 truncate">{item.title}</div>
                  {item.url && <div className="text-del-blue truncate font-mono text-[10px]">{item.url}</div>}
                  <div className="flex flex-wrap gap-1 mt-1 text-[9px] text-gray-500">
                    {item.folders.length > 0 && <span className="bg-amber-100 text-amber-800 px-1 rounded">📁 {item.folders.join('/')}</span>}
                    {item.tags.length > 0 && <span className="bg-blue-100 text-blue-800 px-1 rounded">🏷️ {item.tags.join(', ')}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error display */}
          {errorMsg && (
            <div className="p-2.5 bg-red-100 border border-red-300 text-red-800 text-xs font-bold rounded-xs flex items-center gap-2">
              <span>❌</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Progress bar */}
          {progress && (
            <div className="space-y-1 py-1">
              <div className="flex justify-between text-xs font-bold text-gray-700">
                <span>Importiere Lesezeichen...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-del-blue h-full transition-all duration-200" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-gray-100 border-t border-gray-200 px-4 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-3 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xs disabled:opacity-50 cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleStartImport}
            disabled={isImporting || (mode === 'replace' && !confirmReplaceChecked)}
            className={`px-4 py-1.5 font-bold text-xs text-white rounded-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer ${
              mode === 'replace' 
                ? 'bg-red-600 hover:bg-red-700 border border-red-800' 
                : 'bg-del-blue hover:bg-blue-700 border border-blue-800'
            }`}
          >
            {isImporting ? (
              <span>Importiere...</span>
            ) : mode === 'replace' ? (
              <span>Sammlung jetzt ersetzen</span>
            ) : (
              <span>{parsedItems.length} Bookmarks hinzufügen</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
