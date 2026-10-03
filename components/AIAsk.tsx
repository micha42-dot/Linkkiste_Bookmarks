import React, { useState, useEffect } from 'react';
import { Bookmark } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIAskProps {
  bookmarks: Bookmark[];
  onNodeClick: (id: number) => void;
  openRouterKey?: string;
  aiBaseUrl?: string;
  defaultAiQueryModel?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AIAsk: React.FC<AIAskProps> = ({ bookmarks, onNodeClick, openRouterKey, aiBaseUrl, defaultAiQueryModel }) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const suggestions = [
    "Was sind meine wichtigsten Themen und Interessensgebiete?",
    "Fasse alle meine Notizen über Entwicklungs-Tools zusammen.",
    "Welche Lesezeichen habe ich, die noch ungelesen sind?",
    "Welche Querverbindungen gibt es zwischen meinen Notizen?"
  ];

  const handleAskWithPrompt = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setPrompt('');
    setLoading(true);
    setError('');

    try {
      const MAX_BOOKMARKS = 100;
      let contextBookmarks = bookmarks;
      if (contextBookmarks.length > MAX_BOOKMARKS) {
          contextBookmarks = [...bookmarks].sort((a, b) => b.id - a.id).slice(0, MAX_BOOKMARKS);
      }

      const context = contextBookmarks.map(b => ({
          id: b.id,
          title: b.title,
          url: b.url,
          notes: b.notes ? b.notes.substring(0, 500) + (b.notes.length > 500 ? '...' : '') : '',
          tags: b.tags
      }));

      // Convert conversation into API messages format
      const customMessages = [
        {
          role: "system",
          content: `Du bist der persönliche KI-Assistent für das Personal Knowledge Management (PKM) System "LinkKiste".
Hier ist der Kontext der Lesezeichen und Notizen des Benutzers im JSON-Format:
${JSON.stringify(context)}

Beantworte Fragen präzise, hilfsbereit und verweise direkt auf Notiztitel mit [[Titel]]. Beantworte auf Deutsch, es sei denn der Nutzer fragt auf Englisch.`
        },
        ...updatedMessages.map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      const payload = JSON.stringify({
        model: defaultAiQueryModel,
        customMessages
      });

      if (payload.length > 800000) {
          throw new Error("Der Kontext deiner Wissensbasis ist zu groß für eine einzelne KI-Abfrage.");
      }

      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...(openRouterKey ? { 'x-openrouter-key': openRouterKey } : {}),
            ...(aiBaseUrl ? { 'x-ai-base-url': aiBaseUrl } : {})
        },
        body: payload
      });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
          data = await res.json();
      } else {
          const textRes = await res.text();
          throw new Error(`Server returned a non-JSON response (Status ${res.status}): ${textRes.substring(0, 100)}...`);
      }
      
      if (!res.ok || data.error) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const aiText = data.choices[0].message.content;
      setMessages([...updatedMessages, { role: 'assistant', content: aiText }]);
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist bei der Kommunikation mit der KI aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = () => handleAskWithPrompt(prompt);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span>🤖</span> Chat mit deiner Wissensbasis
        </h2>
        {messages.length > 0 && (
          <button 
            onClick={() => setMessages([])}
            className="web2-btn text-xs text-gray-600 hover:text-red-600 font-bold px-3 py-1 rounded-sm cursor-pointer shadow-2xs"
          >
            Verlauf leeren
          </button>
        )}
      </div>

      {/* Suggested quick questions */}
      {messages.length === 0 && (
        <div className="bg-white border border-[#D5D5D5] rounded-sm overflow-hidden shadow-2xs">
          <div className="web2-panel-header px-3 py-1.5 border-b border-[#E5E5E5]">
            <p className="text-xs font-bold text-gray-700">Vorschläge zum Ausprobieren:</p>
          </div>
          <div className="p-3 bg-[#FAFAFA] flex flex-wrap gap-2">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleAskWithPrompt(s)}
                disabled={loading}
                className="web2-btn text-xs text-gray-800 px-3 py-1.5 rounded-sm hover:text-del-blue transition-colors text-left cursor-pointer"
              >
                💡 {s}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-sm text-red-600 text-sm">
            {error}
        </div>
      )}

      {/* Conversation Thread */}
      {messages.length > 0 && (
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`rounded-sm shadow-2xs border overflow-hidden ${
                msg.role === 'user' 
                  ? 'bg-white border-del-blue/40 ml-6 md:ml-12' 
                  : 'bg-[#fffff8] border-[#e8d082] mr-6 md:mr-12'
              }`}
            >
              <div className={`px-3 py-1.5 border-b text-xs font-bold flex items-center justify-between ${
                msg.role === 'user' ? 'web2-panel-header text-del-blue border-del-blue/20' : 'bg-[#fff9e6] text-[#b09b54] border-[#eedc82]'
              }`}>
                <span>{msg.role === 'user' ? '👤 Du' : '🤖 KI-Assistent'}</span>
              </div>
              <div className="p-4 prose prose-sm max-w-none font-serif text-gray-800 leading-relaxed text-[15px] prose-p:my-2 prose-a:text-del-blue">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                      a: ({node, href, children, ...props}) => {
                          if (href?.startsWith('#wiki:')) {
                              const title = decodeURIComponent(href.replace('#wiki:', ''));
                              const existing = bookmarks.find(b => b.title.toLowerCase() === title.toLowerCase());
                              if (existing) {
                                  return (
                                      <a 
                                          href="#" 
                                          onClick={(e) => { e.preventDefault(); onNodeClick(existing.id); }} 
                                          className="text-del-blue hover:underline font-semibold bg-blue-50 px-1 rounded-sm"
                                          title={existing.description || existing.url}
                                      >
                                          {children}
                                      </a>
                                  );
                              } else {
                                  return (
                                      <span className="text-gray-500 bg-gray-50 px-1 rounded-sm border-b border-dashed border-gray-300">
                                          {children}
                                      </span>
                                  );
                              }
                          }
                          return <a href={href} {...props} target="_blank" rel="noopener noreferrer">{children}</a>
                      }
                  }}
                >
                  {msg.content.replace(/\[\[([^\]]+)\]\]/g, (match, p1) => `[${p1}](#wiki:${encodeURIComponent(p1)})`)}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border border-[#CCCCCC] rounded-sm overflow-hidden shadow-2xs">
        <div className="web2-panel-header px-3 py-2 border-b border-[#D5D5D5]">
          <label className="block text-xs font-bold text-gray-800">
            {messages.length > 0 ? 'Nachfrage stellen...' : 'Frage zu deinen Notizen und Bookmarks stellen:'}
          </label>
        </div>
        <div className="p-3 bg-[#FAFAFA]">
          <textarea 
            className="web2-input w-full p-3 text-sm rounded-sm outline-none min-h-[90px]"
            placeholder="Z.B.: Welche Frameworks nutze ich laut meinen Notizen am häufigsten?"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleAsk();
              }
            }}
          ></textarea>
          <div className="mt-2.5 flex justify-between items-center">
              <span className="text-xs text-gray-500">⌘ + Enter / Strg + Enter zum Senden</span>
              <button 
                  onClick={handleAsk}
                  disabled={loading || !prompt.trim()}
                  className="web2-btn-blue disabled:opacity-50 text-white font-bold text-xs uppercase px-5 py-2 rounded-sm transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                  {loading ? (
                    <>
                      <span className="animate-spin text-xs">⏳</span> Analysiere...
                    </>
                  ) : (
                    'Frage stellen'
                  )}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
