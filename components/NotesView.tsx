import React, { useState, useRef } from 'react';
import { Bookmark, NewBookmark } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConfirmModal } from './ConfirmModal';
import { formatDateTime, parseTags, toggleMarkdownCheckbox, isNoteBookmark, isWikiBookmark } from '../utils/helpers';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';

interface NotesViewProps {
  bookmarks: Bookmark[];
  onAddBookmark: (bm: NewBookmark) => Promise<Bookmark>;
  onUpdateBookmark: (id: number, data: Partial<Bookmark>) => Promise<void>;
  onDeleteBookmark: (id: number) => Promise<void>;
  defaultTag?: string;
  onOpenPermalink?: (id: number) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  bookmarks,
  onAddBookmark,
  onUpdateBookmark,
  onDeleteBookmark,
  defaultTag = 'inbox',
  onOpenPermalink
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<'grid' | 'stream'>('stream');
  
  // New Note State (Continuous text only, no headings!)
  const [newContent, setNewContent] = useState('');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Autocomplete state for new note
  const [newWikiQuery, setNewWikiQuery] = useState<string | null>(null);
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Inline Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTagsStr, setEditTagsStr] = useState('');
  const [editWikiQuery, setEditWikiQuery] = useState<string | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Copy status
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Filter notes (items with empty URL and not pure wiki pages, or explicitly tagged with 'note' or 'scratchpad')
  const notes = bookmarks.filter(b => isNoteBookmark(b));

  // Wiki options for autocompletion (strictly wiki pages)
  const wikiTitles = Array.from(
    new Set(bookmarks.filter(isWikiBookmark).map(b => b.title).filter(t => t && t.trim().length > 0))
  ).sort();

  // Extract all tags across notes
  const allNoteTags = Array.from(
    new Set(notes.flatMap(n => n.tags || []).filter(t => t && t !== 'note' && t !== 'notes' && t !== 'scratchpad'))
  ).sort();

  // Search and tag filtering
  const filteredNotes = notes.filter(note => {
    const noteText = (note.notes || note.title || '').toLowerCase();
    const matchesTag = selectedTag ? (note.tags && note.tags.includes(selectedTag)) : true;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      noteText.includes(term) ||
      (note.tags && note.tags.some(t => t.toLowerCase().includes(term)));
    return matchesTag && matchesSearch;
  });

  // Handle autocomplete query detection on input change
  const handleNewContentChange = (val: string) => {
    setNewContent(val);
    const match = val.match(/\[\[([^\]]*)$/);
    if (match) {
      setNewWikiQuery(match[1]);
    } else {
      setNewWikiQuery(null);
    }
  };

  const handleEditContentChange = (val: string) => {
    setEditContent(val);
    const match = val.match(/\[\[([^\]]*)$/);
    if (match) {
      setEditWikiQuery(match[1]);
    } else {
      setEditWikiQuery(null);
    }
  };

  const insertNewWikiLink = (title: string) => {
    const match = newContent.match(/^(.*)\[\[([^\]]*)$/s);
    if (match) {
      setNewContent(`${match[1]}[[${title}]] `);
    } else {
      setNewContent(`${newContent}[[${title}]] `);
    }
    setNewWikiQuery(null);
    newTextareaRef.current?.focus();
  };

  const insertEditWikiLink = (title: string) => {
    const match = editContent.match(/^(.*)\[\[([^\]]*)$/s);
    if (match) {
      setEditContent(`${match[1]}[[${title}]] `);
    } else {
      setEditContent(`${editContent}[[${title}]] `);
    }
    setEditWikiQuery(null);
    editTextareaRef.current?.focus();
  };

  const handleCreateNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newContent.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      const parsedCustomTags = parseTags(newTagsStr);
      const combinedTags = Array.from(new Set([defaultTag, 'note', ...parsedCustomTags]));

      // For DB compatibility where title column is non-null, store a short snippet
      const firstLine = trimmed.split('\n')[0].replace(/^[#\-*]\s*/, '').trim();
      const titleSnippet = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : (firstLine || 'Note');

      await onAddBookmark({
        url: '',
        title: titleSnippet,
        description: '',
        notes: trimmed,
        tags: combinedTags,
        folders: [],
        to_read: false
      });

      setNewContent('');
      setNewTagsStr('');
      setNewWikiQuery(null);
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (note: Bookmark) => {
    setEditingId(note.id);
    setEditContent(note.notes || note.title || '');
    setEditTagsStr(note.tags ? note.tags.filter(t => t !== 'note').join(', ') : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditTagsStr('');
    setEditWikiQuery(null);
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const trimmed = editContent.trim();
      const firstLine = trimmed.split('\n')[0].replace(/^[#\-*]\s*/, '').trim();
      const titleSnippet = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : (firstLine || 'Note');

      const parsedTags = parseTags(editTagsStr);
      const guaranteedTags = Array.from(new Set(['note', ...parsedTags]));

      await onUpdateBookmark(id, {
        title: titleSnippet,
        notes: trimmed,
        tags: guaranteedTags
      });
      cancelEdit();
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleDelete = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Notiz löschen',
      message: 'Möchtest du diese Notiz wirklich unwiderruflich löschen?',
      onConfirm: async () => {
        await onDeleteBookmark(id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const copyToClipboard = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export all notes as a combined Markdown file
  const handleExportMarkdown = () => {
    if (notes.length === 0) return;
    const header = `# Notizen Export - ${new Date().toISOString().split('T')[0]}\n\nTotal: ${notes.length} Notizen\n\n---\n\n`;
    const body = notes.map((n, idx) => {
      const date = n.created_at ? formatDateTime(n.created_at) : '';
      const tags = n.tags && n.tags.length > 0 ? n.tags.map(t => `#${t}`).join(' ') : '';
      const text = n.notes || n.title || '';
      return `### Notiz ${idx + 1} (${date})\n${tags ? `**Tags:** ${tags}\n\n` : ''}${text}\n\n---`;
    }).join('\n\n');

    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-export-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render markdown with clickable checkboxes
  const renderInteractiveMarkdown = (rawText: string, noteId: number) => {
    let checkboxIdx = 0;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          input: ({ node, ...props }) => {
            if (props.type === 'checkbox') {
              const currentIdx = checkboxIdx++;
              return (
                <input
                  type="checkbox"
                  checked={props.checked}
                  onChange={async (e) => {
                    e.stopPropagation();
                    const updated = toggleMarkdownCheckbox(rawText, currentIdx);
                    const firstLine = updated.split('\n')[0].replace(/^[#\-*]\s*/, '').trim();
                    const titleSnippet = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : (firstLine || 'Note');
                    await onUpdateBookmark(noteId, {
                      notes: updated,
                      title: titleSnippet
                    });
                  }}
                  className="mr-1.5 align-middle cursor-pointer accent-del-blue h-3.5 w-3.5 rounded"
                />
              );
            }
            return <input {...props} />;
          }
        }}
      >
        {rawText}
      </ReactMarkdown>
    );
  };

  return (
    <div className="space-y-6">
      {/* Continuous Note Quick Creator */}
      <div className="bg-white border border-[#D5D5D5] rounded-sm p-4 shadow-sm relative">
        <form onSubmit={handleCreateNote} className="space-y-2.5">
          <div className="relative">
            <textarea
              ref={newTextareaRef}
              placeholder="Schreibe eine Notiz... (durchgehender Text, Gedanken, To-Do Listen [- [ ]], [[WikiLinks]]...)"
              rows={3}
              value={newContent}
              onChange={e => handleNewContentChange(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateNote();
                }
              }}
              className="w-full text-xs p-3 bg-[#FFFDF5] border border-[#E0D8C0] rounded-sm outline-none resize-y focus:border-del-blue font-sans text-gray-800 placeholder-gray-400 focus:bg-white transition-colors"
            />
            {newWikiQuery !== null && (
              <WikiLinkAutocomplete
                query={newWikiQuery}
                options={wikiTitles}
                onSelect={insertNewWikiLink}
                onClose={() => setNewWikiQuery(null)}
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-grow max-w-md">
              <span className="text-[11px] text-gray-400 font-bold">#</span>
              <input
                type="text"
                placeholder={`Tags (z.B. idee, memo) - Standard: #${defaultTag}`}
                value={newTagsStr}
                onChange={e => setNewTagsStr(e.target.value)}
                className="text-xs px-2 py-1 bg-white border border-gray-300 rounded-sm outline-none focus:border-del-blue w-full"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              {newContent.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setNewContent('');
                    setNewTagsStr('');
                    setNewWikiQuery(null);
                  }}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:text-black font-bold"
                >
                  Verwerfen
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !newContent.trim()}
                className="bg-del-blue hover:bg-del-dark-blue text-white text-xs font-bold px-4 py-1.5 rounded-sm disabled:opacity-40 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>📝</span> {isSubmitting ? 'Speichert...' : 'Notiz anheften'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Filter, Search and Layout Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#F8F8F8] border border-[#E5E5E5] p-2.5 rounded-sm">
        {/* Search */}
        <div className="flex items-center gap-2 flex-grow max-w-sm">
          <input
            type="text"
            placeholder="Notizen durchsuchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs px-2.5 py-1 bg-white border border-gray-300 rounded-sm outline-none focus:border-del-blue"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-gray-500 hover:text-black font-bold px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tag Pills */}
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto text-xs">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-2 py-0.5 rounded-sm font-bold text-[11px] cursor-pointer transition-colors ${
              selectedTag === null ? 'bg-del-blue text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Alle ({notes.length})
          </button>
          {allNoteTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-2 py-0.5 rounded-sm font-bold text-[11px] cursor-pointer transition-colors ${
                selectedTag === tag ? 'bg-del-blue text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-del-blue hover:text-del-blue'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>

        {/* Actions (Export & Layout Toggle) */}
        <div className="flex items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-gray-200 justify-end flex-shrink-0">
          <button
            onClick={handleExportMarkdown}
            disabled={notes.length === 0}
            className="px-2 py-1 text-xs rounded-sm font-bold border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1 cursor-pointer disabled:opacity-40"
            title="Alle Notizen als Markdown (.md) exportieren"
          >
            <span>📥</span> Export (.md)
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewLayout('stream')}
              className={`px-2 py-1 text-xs rounded-sm font-bold flex items-center gap-1 ${
                viewLayout === 'stream' ? 'bg-white border border-gray-300 shadow-xs text-del-blue' : 'text-gray-500 hover:text-black'
              }`}
              title="Durchgehender Stream (Fließtext-Ansicht)"
            >
              <span>📜</span> Stream
            </button>
            <button
              onClick={() => setViewLayout('grid')}
              className={`px-2 py-1 text-xs rounded-sm font-bold flex items-center gap-1 ${
                viewLayout === 'grid' ? 'bg-white border border-gray-300 shadow-xs text-del-blue' : 'text-gray-500 hover:text-black'
              }`}
              title="Kartenansicht"
            >
              <span>🗂️</span> Raster
            </button>
          </div>
        </div>
      </div>

      {/* Notes Stream / Grid */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-sm p-6">
          <div className="text-3xl mb-2">📝</div>
          <h3 className="text-sm font-bold text-gray-700 mb-1">Keine Notizen vorhanden</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {searchTerm || selectedTag
              ? 'Keine Notizen entsprechen deinen Filterkriterien.'
              : 'Schreibe oben deine ersten Gedanken oder nutze das QuickCapture-Feld mit dem Stichwort "Note:".'}
          </p>
        </div>
      ) : (
        <div className={viewLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4 max-w-3xl'}>
          {filteredNotes.map(note => {
            const rawText = note.notes || note.title || '';
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                className="bg-[#FFFEFC] border border-[#DDD5C5] hover:border-[#B5A890] rounded-sm p-4 transition-all shadow-2xs group relative"
              >
                {isEditing ? (
                  <div className="space-y-2.5 relative">
                    <div className="relative">
                      <textarea
                        ref={editTextareaRef}
                        value={editContent}
                        onChange={e => handleEditContentChange(e.target.value)}
                        rows={5}
                        className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-sm outline-none font-sans resize-y focus:border-del-blue"
                        placeholder="Notiz..."
                        autoFocus
                      />
                      {editWikiQuery !== null && (
                        <WikiLinkAutocomplete
                          query={editWikiQuery}
                          options={wikiTitles}
                          onSelect={insertEditWikiLink}
                          onClose={() => setEditWikiQuery(null)}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400 font-bold">#</span>
                      <input
                        type="text"
                        value={editTagsStr}
                        onChange={e => setEditTagsStr(e.target.value)}
                        className="w-full text-xs px-2 py-1 bg-white border border-gray-300 rounded-sm outline-none focus:border-del-blue"
                        placeholder="Tags (kommagetrennt)"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
                      <button
                        onClick={cancelEdit}
                        className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-sm font-bold"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        className="bg-del-blue text-white text-xs font-bold px-3.5 py-1 rounded-sm hover:bg-del-dark-blue"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Top Action Bar */}
                    <div className="flex items-center justify-between mb-2 text-[10px] text-gray-400 border-b border-[#F4EFE6] pb-1.5">
                      <div className="flex items-center gap-1.5 font-sans">
                        <span>🕒 {formatDateTime(note.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100">
                        <button
                          onClick={() => copyToClipboard(note.id, rawText)}
                          className="text-[11px] text-gray-400 hover:text-del-blue p-0.5"
                          title="Text kopieren"
                        >
                          {copiedId === note.id ? '✓' : '📋'}
                        </button>
                        <button
                          onClick={() => startEdit(note)}
                          className="text-[11px] text-gray-400 hover:text-del-blue p-0.5"
                          title="Notiz bearbeiten"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          className="text-[11px] text-gray-400 hover:text-red-500 p-0.5"
                          title="Löschen"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Continuous Note Body (Rendered Markdown with Interactive Task Checkboxes) */}
                    <div className="text-xs text-gray-800 leading-relaxed prose prose-xs max-w-none break-words my-2">
                      {renderInteractiveMarkdown(rawText, note.id)}
                    </div>

                    {/* Bottom Tags & Permalink */}
                    <div className="pt-2 mt-2 border-t border-[#F4EFE6] flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400">
                      <div className="flex flex-wrap items-center gap-1">
                        {note.tags?.filter(t => t !== 'note').map(tag => (
                          <span
                            key={tag}
                            onClick={() => setSelectedTag(tag)}
                            className="bg-[#F0EBE0] hover:bg-blue-50 hover:text-del-blue text-gray-600 px-1.5 py-0.5 rounded-xs cursor-pointer font-bold"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {onOpenPermalink && (
                        <button
                          onClick={() => onOpenPermalink(note.id)}
                          className="text-gray-400 hover:text-del-blue hover:underline uppercase font-bold text-[9px] ml-auto"
                        >
                          Permalink
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
