import React, { useState, useRef } from 'react';
import { NewBookmark } from '../types';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';

interface QuickCaptureProps {
  onAddBookmark: (bm: NewBookmark) => Promise<any>;
  onCreateWikiPage: (title: string, notes?: string) => Promise<any>;
  defaultTag?: string;
  notePrefix?: string;
  alwaysNote?: boolean;
  wikiTitles?: string[];
}

export const QuickCapture: React.FC<QuickCaptureProps> = ({
  onAddBookmark,
  onCreateWikiPage,
  defaultTag = 'inbox',
  notePrefix = 'Note:',
  alwaysNote = false,
  wikiTitles = []
}) => {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [wikiQuery, setWikiQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isUrl = (text: string) => {
    const trimmed = text.trim();
    return /^https?:\/\//i.test(trimmed) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    const match = val.match(/\[\[([^\]]*)$/);
    if (match) {
      setWikiQuery(match[1]);
    } else {
      setWikiQuery(null);
    }
  };

  const insertWikiLink = (title: string) => {
    const match = input.match(/^(.*)\[\[([^\]]*)$/s);
    if (match) {
      setInput(`${match[1]}[[${title}]] `);
    } else {
      setInput(`${input}[[${title}]] `);
    }
    setWikiQuery(null);
    textareaRef.current?.focus();
  };

  const handleCapture = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    setSubmitting(true);
    setStatusMsg(null);

    try {
      const cleanPrefix = notePrefix.trim().toLowerCase();
      const startsWithPrefix = cleanPrefix && raw.toLowerCase().startsWith(cleanPrefix);

      if (startsWithPrefix || alwaysNote) {
        // Strip prefix if present
        let noteBody = raw;
        if (startsWithPrefix) {
          noteBody = raw.substring(notePrefix.trim().length).trim();
        }

        const lines = noteBody.split('\n');
        const firstLine = lines[0].replace(/^[#\-*]\s*/, '').trim();
        const titleSnippet = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;

        await onAddBookmark({
          url: '',
          title: titleSnippet || 'Note',
          description: '',
          notes: noteBody,
          tags: Array.from(new Set([defaultTag, 'note'])),
          folders: [],
          to_read: false
        });

        setStatusMsg(`📝 Notiz gespeichert (#${defaultTag})!`);
      } else if (isUrl(raw)) {
        // Handle as link
        let formattedUrl = raw;
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = 'https://' + formattedUrl;
        }
        await onAddBookmark({
          url: formattedUrl,
          title: formattedUrl,
          description: '',
          tags: [defaultTag],
          folders: [],
          to_read: true
        });
        setStatusMsg(`🔗 Link in Inbox gespeichert (#${defaultTag})!`);
      } else {
        // Text Note
        const lines = raw.split('\n');
        const firstLine = lines[0].replace(/^[#\-*]\s*/, '').trim();
        const titleSnippet = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
        
        await onAddBookmark({
          url: '',
          title: titleSnippet || 'Note',
          description: '',
          notes: raw,
          tags: Array.from(new Set([defaultTag, 'note'])),
          folders: [],
          to_read: false
        });
        setStatusMsg(`💡 Notiz gespeichert (#${defaultTag})!`);
      }

      setInput('');
      setIsExpanded(false);
      setWikiQuery(null);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg('Fehler: ' + (err.message || 'Konnte nicht gespeichert werden'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F8F9FA] border border-[#D8D8D8] rounded-sm p-2.5 mb-6 relative">
      <form onSubmit={handleCapture} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                placeholder={`Paste URL, Gedanken, Zitate, [[WikiLink]] oder tippe "${notePrefix} ..." (Cmd+Enter zum Speichern)`}
                rows={3}
                className="web2-input w-full text-xs p-2 rounded-sm outline-none resize-y font-sans bg-white"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleCapture();
                  }
                }}
              />
              {wikiQuery !== null && wikiTitles.length > 0 && (
                <WikiLinkAutocomplete
                  query={wikiQuery}
                  options={wikiTitles}
                  onSelect={insertWikiLink}
                  onClose={() => setWikiQuery(null)}
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              placeholder={`⚡ Quick Capture: URL oder "${notePrefix} Notiz..." tippen...`}
              className="web2-input w-full text-xs px-3 py-1.5 rounded-sm outline-none bg-white"
            />
          )}

          <button
            type="submit"
            disabled={submitting || !input.trim()}
            className="bg-del-blue hover:bg-del-dark-blue text-white disabled:opacity-50 text-xs font-bold px-4 py-1.5 rounded-sm whitespace-nowrap cursor-pointer transition-colors"
          >
            {submitting ? '...' : '+ Speichern'}
          </button>
        </div>

        {isExpanded && (
          <div className="flex justify-between items-center text-[11px] text-gray-500 px-1 pt-1 border-t border-gray-200">
            <span>
              Wird mit Tag <code className="bg-white border border-gray-200 px-1 py-0.5 rounded-sm text-gray-700 font-mono font-bold">#{defaultTag}</code> gespeichert. 
              {alwaysNote ? (
                <span className="text-del-blue font-bold ml-1">(Modus: Immer als Notiz)</span>
              ) : (
                <span className="ml-1">Tipp: Beginne mit <code className="bg-white border border-gray-200 px-1 py-0.5 rounded-sm text-gray-700 font-mono font-bold">{notePrefix}</code> für reine Notizen.</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setInput('');
                setWikiQuery(null);
              }}
              className="hover:underline text-gray-600 font-bold cursor-pointer"
            >
              Abbrechen
            </button>
          </div>
        )}
      </form>
      {statusMsg && (
        <div className="text-xs text-green-700 font-bold mt-1 px-1">{statusMsg}</div>
      )}
    </div>
  );
};
