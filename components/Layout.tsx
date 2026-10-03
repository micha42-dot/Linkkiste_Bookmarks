import React from 'react';

export interface EnabledTabsConfig {
  list?: boolean;
  notes?: boolean;
  wiki?: boolean;
  unread?: boolean;
  folders?: boolean;
  tags?: boolean;
  ai?: boolean;
  add?: boolean;
}

interface LayoutProps {
  children: React.ReactNode;
  userEmail?: string;
  onLogout: () => void;
  currentView: string;
  setView: (view: any) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onLogoClick?: () => void;
  kmFeatures?: { wiki: boolean; ai: boolean };
  enabledTabs?: EnabledTabsConfig;
  onOpenShortcuts?: () => void;
}

interface TabProps {
    id: string; 
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const Tab: React.FC<TabProps> = ({ id, label, isActive, onClick }) => {
    // Generate permalink href (list is root, others use ?view=)
    const href = id === 'list' ? window.location.pathname : `?view=${id}`;
    
    return (
      <a 
        href={href}
        onClick={(e) => { e.preventDefault(); onClick(); }}
        className={`px-4 py-2 text-xs md:text-sm font-bold transition-colors mr-1 rounded-t-sm whitespace-nowrap flex-shrink-0 flex items-center justify-center border-t border-x ${
          isActive 
            ? 'bg-del-blue text-white border-del-blue border-b-0 -mb-[2px] pb-[10px] z-10' 
            : 'bg-[#EDEDED] text-gray-700 border-[#CCCCCC] border-b-0 hover:bg-white hover:text-del-blue relative -mb-[2px] z-0'
        }`}
      >
        {label}
      </a>
    );
};

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  userEmail, 
  onLogout,
  currentView,
  setView,
  searchTerm,
  setSearchTerm,
  onLogoClick,
  kmFeatures = { wiki: true, ai: true },
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
  onOpenShortcuts
}) => {
  const username = userEmail ? userEmail.split('@')[0] : 'user';

  // Helper for footer links to use SPA navigation
  const renderFooterLink = (view: string, label: string) => (
      <a 
        href={`?view=${view}`} 
        onClick={(e) => { e.preventDefault(); setView(view); }}
        className="hover:text-del-blue"
      >
        {label}
      </a>
  );

  return (
    <div className="min-h-screen bg-white font-arial">
      
      {/* Top Login Bar - Classic Delicious Subheader */}
      <div className="hidden md:flex justify-between items-center px-4 py-1.5 text-[11px] text-gray-500 bg-[#FAFAFA] border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
            <span>Signed in as <span className="font-bold text-gray-800">{username}</span></span>
        </div>
        <div className="flex gap-4 items-center">
            {onOpenShortcuts && (
              <button onClick={onOpenShortcuts} className="hover:underline hover:text-del-blue text-gray-500">
                ⌨️ Shortcuts (?)
              </button>
            )}
            <a href="?view=settings" onClick={(e) => { e.preventDefault(); setView('settings'); }} className="hover:underline hover:text-del-blue">Settings</a>
            <button onClick={onLogout} className="hover:underline hover:text-del-blue text-red-600">Logout</button>
        </div>
      </div>

      {/* Mobile only Settings bar */}
      <div className="md:hidden flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs">
         <span className="font-bold text-gray-600 truncate max-w-[150px]">{username}</span>
         <div className="flex gap-3 items-center">
             <a href="?view=settings" onClick={(e) => { e.preventDefault(); setView('settings'); }} className="text-del-blue">Settings</a>
             <button onClick={onLogout} className="text-gray-400">Logout</button>
         </div>
      </div>

      <header className="bg-white">
        {/* Logo Section - Iconic LinkKiste Mark */}
        <div className="px-4 py-3 md:py-4 md:px-8 flex items-center justify-between border-b border-[#EBEBEB]">
            <a 
                href="/"
                className="flex items-center gap-2.5 cursor-pointer group w-fit no-underline hover:no-underline select-none" 
                onClick={(e) => { e.preventDefault(); if(onLogoClick) onLogoClick(); else setView('list'); }}
            >
                {/* 2 Iconic LinkKiste Squares */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-black rounded-[2px] logo-square-1 shadow-2xs"></div>
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-del-blue rounded-[2px] logo-square-2 shadow-2xs"></div>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-800 no-underline leading-none">
                      <span className="text-black">link</span>
                      <span className="text-del-blue group-hover:text-del-dark-blue transition-colors">kiste</span>
                  </h1>
                  <span className="text-[10px] text-gray-400 font-normal tracking-wide lowercase mt-0.5 hidden sm:block">
                    social bookmarking &amp; personal knowledge
                  </span>
                </div>
            </a>
        </div>

        {/* Search Bar - Delicious Style */}
        <div className="bg-[#F0F0F0] border-y border-[#D5D5D5] px-4 py-2.5 md:px-8">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 max-w-5xl">
                 <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-grow">
                     <label className="text-xs font-bold text-gray-700 whitespace-nowrap hidden md:block">Search bookmarks:</label>
                     <div className="flex w-full md:w-auto gap-1.5">
                         <input 
                            id="global-search-input"
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tags, titles, URLs... (Drücke '/' zum Suchen)"
                            className="bg-white border border-[#CCCCCC] px-2.5 py-1.5 text-sm w-full md:w-80 outline-none rounded-sm focus:border-del-blue shadow-inner"
                        />
                        <button className="bg-[#86C944] hover:bg-[#76B736] active:bg-[#5E9429] text-white text-xs font-bold uppercase px-4 py-1.5 rounded-sm transition-colors cursor-pointer border border-[#71B034] shadow-xs">
                            Search
                        </button>
                     </div>
                 </div>
            </div>
        </div>

        {/* Tabs - Grounded firmly on baseline border */}
        <div className="px-4 mt-3 md:mt-4 md:px-8">
             <div className="flex border-b-2 border-del-blue items-end w-full overflow-x-auto scrollbar-hide pb-0">
                {enabledTabs.list !== false && <Tab id="list" label="All Bookmarks" isActive={currentView === 'list'} onClick={() => setView('list')} />}
                {enabledTabs.notes !== false && <Tab id="notes" label="Notes" isActive={currentView === 'notes'} onClick={() => setView('notes')} />}
                {enabledTabs.wiki !== false && kmFeatures?.wiki !== false && <Tab id="wiki" label="Wiki Pages" isActive={currentView === 'wiki'} onClick={() => setView('wiki')} />}
                {enabledTabs.unread !== false && <Tab id="unread" label="Unread" isActive={currentView === 'unread'} onClick={() => setView('unread')} />}
                {enabledTabs.folders !== false && <Tab id="folders" label="Folders" isActive={currentView === 'folders'} onClick={() => setView('folders')} />}
                {enabledTabs.tags !== false && <Tab id="tags" label="Tags" isActive={currentView === 'tags'} onClick={() => setView('tags')} />}
                {enabledTabs.ai !== false && kmFeatures?.ai !== false && <Tab id="ai" label="AI Query" isActive={currentView === 'ai'} onClick={() => setView('ai')} />}
                {enabledTabs.add !== false && <Tab id="add" label="+ Add" isActive={currentView === 'add'} onClick={() => setView('add')} />}
             </div>
        </div>
      </header>

      <main className="px-4 pt-4 md:pt-5 pb-24 md:pb-6 w-full max-w-7xl min-h-[60vh] md:px-8 relative z-0">
        {children}
      </main>

      {/* Floating Action Button (FAB) for Add on Mobile */}
      {enabledTabs.add !== false && currentView !== 'add' && (
        <button
          onClick={() => setView('add')}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#86C944] text-white rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.3)] flex items-center justify-center text-3xl pb-1.5 z-50 hover:bg-[#76B736] active:scale-95 transition-transform"
          aria-label="Add New"
        >
          +
        </button>
      )}

      <footer className="mt-12 md:mt-24 py-8 border-t border-gray-200 text-xs text-gray-500 text-center pb-20 md:pb-8">
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-4">
           {renderFooterLink('about', 'About')}
           {renderFooterLink('terms', 'Terms')}
           {renderFooterLink('privacy', 'Privacy')}
        </div>
        <p className="mb-2 text-gray-400">Made with ❤️ by a human with the help of AI.</p>
        <p className="opacity-60">&copy; {new Date().getFullYear()} LINKkiste.</p>
      </footer>
    </div>
  );
};
