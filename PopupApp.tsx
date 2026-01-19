import React, { useEffect, useState } from 'react';
import { supabase } from './services/supabaseClient';
import { Auth } from './components/Auth';
import { AddBookmark } from './components/AddBookmark';
import { NewBookmark } from './types';
import { Session } from '@supabase/supabase-js';

const PopupApp: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  
  // Read URL Params directly
  const params = new URLSearchParams(window.location.search);
  const initialUrl = params.get('url') || '';
  const initialTitle = params.get('title') || '';

  useEffect(() => {
    // Check Config
    const configured = !!import.meta.env.VITE_SUPABASE_URL;
    setIsConfigured(configured);
    
    if (!configured) {
        setLoading(false);
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSave = async (newBm: NewBookmark) => {
    if (!session?.user) return;
    
    const { error } = await supabase.from('bookmarks').insert([{
        ...newBm,
        user_id: session.user.id
    }]);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        setSaved(true);
    }
  };

  if (!isConfigured) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
              <h2 className="text-red-600 font-bold mb-2">Setup Required</h2>
              <p className="text-xs text-gray-600">Please configure Supabase API keys in your .env file.</p>
          </div>
      )
  }

  if (loading) {
      return <div className="flex items-center justify-center h-screen text-gray-400 text-xs">Loading...</div>;
  }

  if (!session) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
             <div className="w-full">
                <Auth isPopup={true} />
             </div>
        </div>
      );
  }

  if (saved) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-green-50 text-green-800 p-6 text-center">
            <div className="text-5xl mb-4 text-green-600">✓</div>
            <h2 className="font-bold text-xl mb-1">Saved</h2>
            <p className="text-xs text-green-700 opacity-80 mb-6">to LinkKiste</p>
            <button onClick={() => window.close()} className="text-xs underline hover:no-underline text-green-800">
                Close window
            </button>
        </div>
      );
  }

  return (
      <div className="min-h-screen bg-white px-5 py-4">
          <AddBookmark 
            onSave={handleSave} 
            onCancel={() => window.close()}
            initialUrl={initialUrl}
            initialTitle={initialTitle}
            isPopup={true}
          />
      </div>
  );
};

export default PopupApp;