import React, { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: '/', desc: 'Fokus auf Suchleiste' },
    { key: 'N', desc: 'Zu Notizen / Neue Notiz anlegen' },
    { key: 'W', desc: 'Zu Wiki Pages wechseln' },
    { key: 'B', desc: 'Zu All Bookmarks wechseln' },
    { key: 'U', desc: 'Zu Unread / To-Read wechseln' },
    { key: 'F', desc: 'Zu Folders wechseln' },
    { key: 'T', desc: 'Zu Tags wechseln' },
    { key: 'A', desc: 'Zu AI Query wechseln' },
    { key: '+', desc: 'Neues Lesezeichen hinzufügen (+ Add)' },
    { key: '?', desc: 'Diese Tastaturkürzel anzeigen' },
    { key: 'Esc', desc: 'Dialoge / Suche schließen' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white border border-[#3274D1] shadow-2xl rounded-sm max-w-md w-full p-5 relative font-sans">
        <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">⌨️</span>
            <h3 className="text-sm font-bold text-gray-800">Tastaturkürzel (Shortcuts)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black text-sm font-bold px-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map(s => (
            <div
              key={s.key}
              className="flex items-center justify-between py-1.5 px-2 bg-gray-50 hover:bg-blue-50/50 rounded-sm text-xs border border-gray-100"
            >
              <span className="text-gray-700">{s.desc}</span>
              <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded shadow-2xs font-mono font-bold text-gray-800 text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-del-blue hover:bg-del-dark-blue text-white text-xs font-bold px-4 py-1.5 rounded-sm"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
