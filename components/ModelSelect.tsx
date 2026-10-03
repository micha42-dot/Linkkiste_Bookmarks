import React, { useState, useRef, useEffect } from 'react';

export interface ModelOption {
  id: string;
  name: string;
  isFree?: boolean;
}

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models: ModelOption[];
  label?: string;
  placeholder?: string;
  helpText?: string;
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  onChange,
  models,
  label,
  placeholder = '-- Standard (Server-Empfehlung) --',
  helpText
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const selectedModel = models.find(m => m.id === value);

  const filteredModels = models.filter(m => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && <label className="block text-xs font-bold text-gray-700">{label}</label>}
      <div className="relative">
        <div
          onClick={() => setIsOpen(prev => !prev)}
          className={`w-full min-h-[36px] px-3 py-1.5 bg-white border rounded-sm flex items-center justify-between cursor-pointer text-xs ${
            isOpen ? 'border-purple-600 ring-1 ring-purple-600/20' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {selectedModel ? (
              <>
                <span className="font-semibold text-gray-900 truncate">{selectedModel.name}</span>
                {selectedModel.isFree && (
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-xs">Free</span>
                )}
                <span className="text-[11px] text-gray-400 font-mono truncate hidden sm:inline">({selectedModel.id})</span>
              </>
            ) : value ? (
              <span className="font-mono text-gray-800 text-xs truncate">{value}</span>
            ) : (
              <span className="text-gray-500 italic">{placeholder}</span>
            )}
          </div>
          <span className="text-gray-400 text-[10px] ml-2">▼</span>
        </div>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-[#CCCCCC] rounded-sm shadow-lg max-h-72 flex flex-col overflow-hidden animate-in fade-in-50 duration-75">
            {/* Search Input */}
            <div className="p-2 border-b border-gray-200 bg-gray-50 sticky top-0">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Modell suchen (z. B. claude, gpt, llama, gemini, free)..."
                className="w-full bg-white border border-gray-300 px-2.5 py-1.5 text-xs rounded-sm outline-none focus:border-purple-500"
              />
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-56 divide-y divide-gray-100 text-xs">
              <div
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`p-2 hover:bg-purple-50 cursor-pointer flex items-center justify-between ${
                  !value ? 'bg-purple-100/60 font-bold text-purple-900' : 'text-gray-600'
                }`}
              >
                <span>{placeholder}</span>
                {!value && <span className="text-purple-600 text-xs">✓</span>}
              </div>

              {filteredModels.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500">
                  Kein passendes Modell gefunden für "{search}".
                </div>
              ) : (
                filteredModels.map(m => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onChange(m.id);
                      setIsOpen(false);
                    }}
                    className={`p-2 hover:bg-purple-50 cursor-pointer flex items-center justify-between gap-2 ${
                      value === m.id ? 'bg-purple-100/60 font-bold text-purple-900' : 'text-gray-800'
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{m.name}</span>
                        {m.isFree && (
                          <span className="bg-green-100 text-green-700 text-[9px] font-bold px-1 rounded-xs">Free</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono truncate">{m.id}</span>
                    </div>
                    {value === m.id && <span className="text-purple-600 text-xs flex-shrink-0">✓</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {helpText && <p className="text-[10px] text-gray-400 mt-0.5">{helpText}</p>}
    </div>
  );
};
