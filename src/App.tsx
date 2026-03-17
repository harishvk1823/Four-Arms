import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Canvas } from './Canvas';
import { LoginScreen } from './LoginScreen';
import { ActiveUsers, User } from './components/ActiveUsers';
import { ChatPanel, ChatMessage } from './components/ChatPanel';

type ToolType = 'select' | 'pen' | 'pencil' | 'marker' | 'painter' | 'rectangle' | 'circle' | 'eraser';

const COLORS = [
  { id: 'slate', value: '#0f172a' },
  { id: 'red', value: '#ef4444' },
  { id: 'orange', value: '#f97316' },
  { id: 'yellow', value: '#eab308' },
  { id: 'green', value: '#22c55e' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'purple', value: '#a855f7' },
  { id: 'pink', value: '#ec4899' },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  
  const [currentTool, setCurrentTool] = useState<ToolType>('pen');
  const [currentColor, setCurrentColor] = useState<string>(COLORS[0].value);
  const [clearTriggered, setClearTriggered] = useState(0);
  const [isMeetMenuOpen, setIsMeetMenuOpen] = useState(false);

  // Phase 5: Messaging & Presence
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize socket ONLY when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:3001' 
      : `https://${window.location.hostname}`;
      
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { name: userName });
    });

    newSocket.on('init-sync', (data: { objects: any[], users: User[], messages: ChatMessage[] }) => {
      setActiveUsers(data.users || []);
      setMessages(data.messages || []);
    });

    newSocket.on('users-updated', (users: User[]) => {
      setActiveUsers(users);
    });

    newSocket.on('new-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      
      // Increment unread if chat is closed
      setIsChatOpen(current => {
        if (!current) setUnreadCount(u => u + 1);
        return current;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, userName]);


  const handleClear = () => {
    // Incrementing counter forces the Canvas useEffect to trigger
    setClearTriggered(prev => prev + 1);
  };

  const handleLogin = (name: string, password?: string) => {
    // In a real app we'd verify password with backend here.
    // For now, if they provide any password, let them in.
    setUserName(name);
    if (password) {
      setRoomPassword(password);
    }
    setIsAuthenticated(true);
  };

  const handleShare = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomPassword);
      await navigator.clipboard.writeText(url.toString());
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!socket) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderName: userName,
      text,
      timestamp: Date.now()
    };
    socket.emit('send-message', msg);
    // Optimistic UI update (optional, server broadcasts it to us too, but we can rely on broadcast only or optimistic)
    // Actually the server broadcasts to all including sender? Our server.js `io.emit` sends to all.
    // So we don't need optimistic update here to avoid duplicates.
  };

  useEffect(() => {
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dot-pattern bg-[length:24px_24px] bg-slate-50 transition-colors duration-500 animate-in fade-in duration-700">
      {/* Active Users Overlay */}
      <ActiveUsers users={activeUsers} />
      
      {/* Canvas Layer */}
      {socket && <Canvas currentTool={currentTool} currentColor={currentColor} onClearTriggered={clearTriggered} socket={socket} />}

      {/* Top Header / Nav */}
      <div className="absolute top-0 left-0 w-full p-6 pointer-events-none z-20 flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 shadow-xl shadow-blue-500/20 flex items-center justify-center text-white pointer-events-auto cursor-pointer hover:scale-105 transition-transform duration-300 ring-1 ring-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 10 V24 H38" />
              <path d="M38 24 V38 H24" />
              <path d="M24 38 V24 H10" />
              <path d="M10 24 V10 H24" />
              <circle cx="24" cy="24" r="4" fill="currentColor" />
            </svg>
          </div>
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm px-4 py-2 rounded-xl pointer-events-auto">
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 tracking-tight">
              FOUR ARMS
            </h1>
            <p className="text-xs font-medium text-slate-400">Collaborative Whiteboard</p>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="pointer-events-auto flex items-start gap-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-2 flex gap-2 transition-all hover:shadow-xl hover:bg-white/90">
            
            {/* Share Link Button */}
            <button 
              onClick={handleShare}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2 ${showCopiedToast ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'}`}
            >
              {showCopiedToast ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                  Share Room
                </>
              )}
            </button>
            <div className="w-[1px] h-auto bg-slate-200 my-1 mx-1" />

            {/* Google Meet Dropdown Container */}
            <div className="relative">
              <button 
                onClick={() => setIsMeetMenuOpen(!isMeetMenuOpen)}
                className="px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                Google Meet
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isMeetMenuOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>

              {/* Dropdown Menu Panel */}
              <div 
                className={`
                  absolute right-0 top-full mt-3 w-56 bg-white/90 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] overflow-hidden origin-top-right transition-all duration-300 z-50
                  ${isMeetMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
                `}
              >
                <div className="p-1.5 flex flex-col gap-1">
                  <a 
                    href="https://meet.google.com/new" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setIsMeetMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                    </div>
                    Start Instant Meet
                  </a>
                  <a 
                    href="https://calendar.google.com/calendar/u/0/r/eventedit?vcon=meet&title=FOUR+ARMS+Collaboration" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setIsMeetMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100/50 flex items-center justify-center text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    Schedule in Calendar
                  </a>
                  <a 
                    href="https://meet.google.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={() => setIsMeetMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                   <div className="w-8 h-8 rounded-lg bg-blue-100/50 flex items-center justify-center text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    </div>
                    Join with a code
                  </a>
                </div>
              </div>
            </div>

            <div className="w-[1px] h-auto bg-slate-200 my-1 mx-1" />
            <button 
              onClick={handleClear}
              className="px-4 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              Clear Canvas
            </button>
          </div>

          {/* Chat Toggle Button */}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-14 h-14 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 flex items-center justify-center text-slate-700 hover:shadow-xl hover:bg-white/90 transition-all active:scale-95 relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Floating Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-2xl rounded-[1.5rem] shadow-2xl shadow-slate-200/50 border border-white/60 p-2.5 flex items-center justify-center gap-1.5 transition-all pointer-events-auto">
          
          <ToolButton 
            active={currentTool === 'select'} 
            onClick={() => setCurrentTool('select')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="m13 13 6 6"></path></svg>}
            label="Select (V)"
          />
          
          <div className="w-[2px] h-8 bg-slate-100 rounded-full mx-1.5" />
          
          <ToolButton 
            active={currentTool === 'pen'} 
            onClick={() => setCurrentTool('pen')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg>}
            label="Pen (P)"
          />

          <ToolButton 
            active={currentTool === 'pencil'} 
            onClick={() => setCurrentTool('pencil')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 19v-5.5"/></svg>}
            label="Pencil"
          />

          <ToolButton 
            active={currentTool === 'marker'} 
            onClick={() => setCurrentTool('marker')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M5 10h14"/></svg>}
            label="Marker"
          />

          <ToolButton 
            active={currentTool === 'painter'} 
            onClick={() => setCurrentTool('painter')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v15"/><path d="M4 14l5-2 5 2v-4l-5-2-5 2z"/><path d="M15 15v3c0 2.2 1.8 4 4 4 1.1 0 2-.9 2-2s-.9-2-2-2c-1.1 0-2-.9-2-2"/></svg>}
            label="Painter Brush"
          />

          <div className="w-[2px] h-8 bg-slate-100 rounded-full mx-1.5" />

          <ToolButton 
            active={currentTool === 'rectangle'} 
            onClick={() => setCurrentTool('rectangle')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>}
            label="Rectangle (R)"
          />

          <ToolButton 
            active={currentTool === 'circle'} 
            onClick={() => setCurrentTool('circle')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>}
            label="Circle (C)"
          />

          <ToolButton 
            active={currentTool === 'eraser'} 
            onClick={() => setCurrentTool('eraser')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>}
            label="Eraser (E)"
          />

          <div className="w-[2px] h-8 bg-slate-100 rounded-full mx-1.5" />

          {/* Color Picker */}
          <div className="flex items-center gap-1 px-1">
            {COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => {
                  setCurrentColor(color.value);
                  if (currentTool === 'eraser' || currentTool === 'select') {
                    setCurrentTool('pen');
                  }
                }}
                className={`
                  w-6 h-6 rounded-full transition-transform duration-200 active:scale-95
                  ${currentColor === color.value ? 'scale-110 shadow-md ring-2 ring-indigo-500 ring-offset-2' : 'hover:scale-110'}
                `}
                style={{ backgroundColor: color.value }}
                title={color.id}
              />
            ))}
          </div>

        </div>
      </div>

      {/* Chat Sidebar Overlay */}
      <ChatPanel 
        messages={messages} 
        onSendMessage={handleSendMessage} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />

    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={`
        w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 relative group
        ${active 
          ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50' 
          : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-700'
        }
      `}
    >
      {icon}
      {active && (
        <span className="absolute -bottom-1 w-4 h-1 bg-indigo-500 rounded-t-full opacity-100 animate-pulse" />
      )}
    </button>
  );
}

export default App;
