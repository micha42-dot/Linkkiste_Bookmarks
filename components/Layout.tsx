import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  userEmail?: string;
  onLogout: () => void;
  currentView: string;
  setView: (view: any) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onLogoClick?: () => void;
}

interface TabProps {
    id: string; 
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const Tab: React.FC<TabProps> = ({ id, label, isActive, onClick }) => {
    return (
      <button 
        onClick={onClick}
        className={`px-3 md:px-5 py-3 md:py-2 text-xs md:text-sm font-bold transition-colors mr-1 rounded-t-sm whitespace-nowrap flex-shrink-0 ${
          isActive 
            ? 'bg-del-blue text-white' 
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        {label}
      </button>
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
  onLogoClick
}) => {
  const username = userEmail ? userEmail.split('@')[0] : 'user';

  return (
    <div className="min-h-screen bg-white font-arial">
      
      {/* Top Login Bar - Hidden on small mobile to save space */}
      <div className="hidden md:flex justify-end items-center px-4 py-1 text-[11px] text-gray-400 border-b border-gray-100">
        <div className="flex gap-3">
            <span>Signed in as <span className="font-bold text-gray-600">{username}</span></span>
            <button onClick={() => setView('settings')} className="hover:underline hover:text-del-blue">Settings</button>
            <button onClick={onLogout} className="hover:underline hover:text-del-blue">Logout</button>
        </div>
      </div>

      {/* Mobile only Settings bar */}
      <div className="md:hidden flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs">
         <span className="font-bold text-gray-500 truncate max-w-[150px]">{username}</span>
         <div className="flex gap-4">
             <button onClick={() => setView('settings')} className="text-del-blue">Settings</button>
             <button onClick={onLogout} className="text-gray-400">Logout</button>
         </div>
      </div>

      <header className="bg-white">
        {/* Logo Section */}
        <div className="px-4 py-4 md:py-6 md:px-8">
            <div 
                className="flex items-center gap-0 cursor-pointer group w-fit" 
                onClick={onLogoClick ? onLogoClick : () => setView('list')}
            >
                <div className="w-6 h-6 md:w-8 md:h-8 bg-black mr-2"></div> 
                <div className="w-6 h-6 md:w-8 md:h-8 bg-del-blue mr-3"></div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-500 group-hover:text-black">
                    <span className="text-black">link</span>kiste
                </h1>
                <span className="ml-2 text-gray-400 text-xs md:text-sm font-normal tracking-wide mt-1 md:mt-2">just simple bookmarking</span>
            </div>
        </div>

        {/* Search Bar - Delicious Style */}
        <div className="bg-[#f0f0f0] border-y border-[#cccccc] px-4 py-3 md:px-8">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 max-w-4xl">
                 <label className="text-sm font-bold text-gray-700 whitespace-nowrap hidden md:block">Search your bookmarks:</label>
                 <div className="flex w-full md:w-auto gap-2">
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search tags, titles, URLs..."
                        className="border border-[#cccccc] px-2 py-2 md:py-1 text-base md:text-sm w-full md:w-80 focus:border-del-blue outline-none rounded-sm"
                    />
                    <button className="bg-del-green hover:bg-[#7bc038] text-white text-xs font-bold uppercase px-4 py-1.5 rounded-sm shadow-sm transition-colors">
                        Search
                    </button>
                 </div>
            </div>
        </div>

        {/* Tabs - Scrollable on mobile with hidden scrollbar */}
        <div className="px-4 mt-4 md:mt-6 md:px-8">
             <div className="flex border-b-[5px] border-del-blue items-end overflow-x-auto scrollbar-hide">
                <Tab id="list" label="All Bookmarks" isActive={currentView === 'list'} onClick={() => setView('list')} />
                <Tab id="unread" label="Unread" isActive={currentView === 'unread'} onClick={() => setView('unread')} />
                <Tab id="folders" label="Folders" isActive={currentView === 'folders'} onClick={() => setView('folders')} />
                <Tab id="tags" label="Tags" isActive={currentView === 'tags'} onClick={() => setView('tags')} />
                <Tab id="add" label="+ Add" isActive={currentView === 'add'} onClick={() => setView('add')} />
             </div>
        </div>
      </header>

      <main className="px-4 py-6 w-full max-w-7xl min-h-[60vh] md:px-8">
        {children}
      </main>

      <footer className="mt-12 md:mt-24 py-8 border-t border-gray-200 text-xs text-gray-500 text-center pb-20 md:pb-8">
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-4">
           <button onClick={() => setView('about')} className="hover:text-del-blue">About</button>
           <button onClick={() => setView('terms')} className="hover:text-del-blue">Terms</button>
           <button onClick={() => setView('privacy')} className="hover:text-del-blue">Privacy</button>
        </div>
        <p className="mb-2 text-gray-400">Made with ❤️ by a human with the help of AI.</p>
        <p className="opacity-60">&copy; {new Date().getFullYear()} LINKkiste.</p>
      </footer>
    </div>
  );
};