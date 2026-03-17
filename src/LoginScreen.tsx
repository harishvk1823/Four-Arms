import React, { useState, useEffect } from 'react';

type LoginScreenProps = {
  onLogin: (name: string, password?: string) => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setPassword(roomParam);
      setIsLogin(true); // Default to login if they are joining an existing room
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && password.trim()) {
      onLogin(name.trim(), password.trim());
    }
  };

  return (
    <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden bg-slate-900">
      
      {/* Animated Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
      <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000" />
      
      <div className="relative z-10 w-full max-w-md p-8 md:p-12 backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] transition-all duration-500 transform hover:scale-[1.02]">
        
        {/* Logo */}
        <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 shadow-2xl flex items-center justify-center text-white ring-1 ring-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                {/* 4 interlocking / crossing paths representing 'four arms' coming together */}
                <path d="M24 10 V24 H38" />
                <path d="M38 24 V38 H24" />
                <path d="M24 38 V24 H10" />
                <path d="M10 24 V10 H24" />
                <circle cx="24" cy="24" r="4" fill="currentColor" />
              </svg>
            </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">FOUR ARMS</h1>
          <p className="text-sm text-slate-300 font-medium tracking-wide">
            {isLogin ? 'Welcome back to the canvas' : 'Join the collaborative space'}
          </p>
        </div>

        {/* Toggle Login/Signup */}
        <div className="flex p-1 mb-8 bg-black/20 rounded-xl backdrop-blur-md border border-white/10">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
              isLogin ? 'bg-white/20 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
              !isLogin ? 'bg-white/20 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              required
              className="w-full px-5 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all cursor-text"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider ml-1">
              Room Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter room password"
              required
              className="w-full px-5 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all cursor-text"
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transform transition-all active:scale-[0.98] mt-4"
          >
            {isLogin ? 'Enter Canvas' : 'Create Account & Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
