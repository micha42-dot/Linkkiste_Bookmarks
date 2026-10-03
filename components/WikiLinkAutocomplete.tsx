import React, { useEffect, useState } from 'react';

interface WikiLinkAutocompleteProps {
  query: string;
  options: string[];
  onSelect: (title: string) => void;
  onClose: () => void;
}

export const WikiLinkAutocomplete: React.FC<WikiLinkAutocompleteProps> = ({
  query,
  options,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = options
    .filter(opt => opt.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[selectedIndex]) {
          e.preventDefault();
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute z-50 bg-white border border-[#3274D1] shadow-lg rounded-sm py-1 min-w-[200px] max-w-sm mt-1">
      <div className="px-2 py-0.5 text-[10px] text-gray-400 font-bold uppercase border-b border-gray-100 flex justify-between items-center">
        <span>Wiki Link Vorschläge</span>
        <span>↵ Einfügen</span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((item, idx) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              idx === selectedIndex ? 'bg-del-blue text-white font-bold' : 'text-gray-800 hover:bg-blue-50'
            }`}
          >
            <span className="text-[10px] opacity-70">📄</span>
            <span className="truncate">{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
