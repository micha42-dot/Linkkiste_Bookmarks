import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); 
  const [message, setMessage] = useState<{ text: React.ReactNode; type: 'success' | 'error' | 'warning' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
            setMessage({
                text: 'Registrierung erfolgreich! Bitte überprüfe deine E-Mails für den Bestätigungslink.',
                type: 'success'
            });
            // Optional: Switch to login view after successful signup request
            // setIsSignUp(false); 
        } else {
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
        }
    } catch (error: any) {
      console.error('Auth Error:', error);
      
      const errMsg = error.message || '';

      if (errMsg.includes('Invalid login credentials')) {
        setMessage({
          text: (
            <div className="space-y-2">
              <p className="font-bold">Login fehlgeschlagen</p>
              <p>Email oder Passwort ist nicht korrekt.</p>
            </div>
          ),
          type: 'error'
        });
      } else if (errMsg.includes('User already registered')) {
         setMessage({ text: 'Dieser User existiert bereits. Bitte einloggen.', type: 'warning' });
      } else if (errMsg.includes('Email not confirmed')) {
         setMessage({ text: 'Bitte bestätige erst deine E-Mail-Adresse über den Link in deinem Postfach.', type: 'warning' });
      } else if (errMsg.includes('rate limit')) {
         setMessage({ text: 'Zu viele Versuche. Bitte warte einen Moment.', type: 'error' });
      } else {
        setMessage({ text: errMsg, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (setter: (val: string) => void, value: string) => {
      setter(value);
      if (message) setMessage(null); // Clear error on typing
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-arial px-4">
      <div className="w-full max-w-[400px] bg-white border border-[#ccc] shadow-sm">
        
        {/* Delicious-style Header */}
        <div className="bg-white p-6 pb-2 border-b border-[#eee]">
            <div className="flex items-center gap-1 mb-2">
                <div className="w-6 h-6 bg-black mr-1"></div>
                <div className="w-6 h-6 bg-del-blue mr-2"></div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-500">
                    <span className="text-black">link</span>kiste
                </h1>
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">just simple bookmarking</p>
        </div>

        <div className="p-8 pt-6">
            <div className="flex justify-between items-baseline mb-6">
                <h2 className="text-sm font-bold text-[#333]">
                    {isSignUp ? 'Create Account' : 'Sign In'}
                </h2>
                <button 
                    onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
                    className="text-xs text-del-blue hover:underline"
                >
                    {isSignUp ? 'Switch to Login' : 'Create an account?'}
                </button>
            </div>
            
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-600" htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  autoComplete="email"
                  className="w-full border border-[#ccc] p-3 text-base md:text-sm focus:border-del-blue outline-none rounded-sm"
                  type="email"
                  value={email}
                  onChange={(e) => handleInputChange(setEmail, e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-gray-600" htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  className="w-full border border-[#ccc] p-3 text-base md:text-sm focus:border-del-blue outline-none rounded-sm"
                  type="password"
                  value={password}
                  onChange={(e) => handleInputChange(setPassword, e.target.value)}
                  required
                />
              </div>
              
              {message && (
                <div className={`text-xs p-3 border rounded-sm leading-normal ${
                  message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                  message.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                className="mt-4 bg-del-green hover:bg-[#7bc038] text-white px-6 py-3 md:py-2 text-sm font-bold uppercase shadow-sm rounded-sm transition-colors w-full md:w-fit"
                disabled={loading}
              >
                {loading ? 'Working...' : (isSignUp ? 'Sign Up' : 'Login')}
              </button>
            </form>

            <div className="mt-8 text-[10px] text-center border-t border-[#eee] pt-4 text-gray-400">
              <p>Private System. {isSignUp ? 'Please register to start.' : 'Access restricted.'}</p>
            </div>
        </div>
      </div>
    </div>
  );
};