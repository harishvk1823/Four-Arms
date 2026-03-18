import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Canvas } from './Canvas';
import { LoginScreen } from './LoginScreen';
import { ActiveUsers, User } from './components/ActiveUsers';
import { ChatPanel, ChatMessage } from './components/ChatPanel';
import { MembersPanel } from './components/MembersPanel';
import { CollaborationLink } from './components/CollaborationLink';

type ToolType = 'select' | 'pen' | 'pencil' | 'marker' | 'painter' | 'rectangle' | 'circle' | 'eraser' | 'text';

type Point = { x: number; y: number };
type DrawingObject = { 
  id: string;
  type: ToolType;
  points: Point[]; 
  color: string; 
  width: number;
  authorId?: string;
  text?: string;
};

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
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [clearTriggered, setClearTriggered] = useState(0);

  // Phase 5: Messaging & Presence
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isMeetSidebarOpen, setIsMeetSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [objects, setObjects] = useState<DrawingObject[]>([]);

  const canvasRef = React.useRef<{ exportImage: () => void, undo: () => void, redo: () => void } | null>(null);

  // Initialize socket ONLY when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isLocalIP = window.location.hostname.startsWith('192.168.') || 
                      window.location.hostname.startsWith('10.') || 
                      window.location.hostname.startsWith('172.') ||
                      window.location.hostname.endsWith('.local');
    
    // If we're on a local network, use HTTP on port 3001
    const serverUrl = (isLocalhost || isLocalIP)
      ? `http://${window.location.hostname}:3001`
      : `https://${window.location.hostname}`;
      
    const newSocket = io(serverUrl, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      const normalizedRoom = (roomPassword || '').trim().toLowerCase();
      newSocket.emit('join-room', { name: userName, room: normalizedRoom });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setIsConnected(false);
    });

    newSocket.on('init-sync', (data: { objects: DrawingObject[], users: User[], messages: ChatMessage[], meetLink: string | null }) => {
      console.log(`[Chat] Init-sync received. Messages count:`, data.messages?.length || 0);
      setObjects(data.objects || []);
      setActiveUsers(data.users || []);
      setMessages(data.messages || []);
      setMeetLink(data.meetLink || null);
    });

    newSocket.on('users-updated', (users: User[]) => {
      setActiveUsers(users);
    });

    newSocket.on('new-message', (msg: ChatMessage) => {
      console.log(`[Chat] Received new-message:`, msg);
      setMessages(prev => [...prev, msg]);
      
      // Increment unread if chat is closed
      setIsChatOpen(current => {
        if (!current) {
          console.log(`[Chat] Chat closed, incrementing unreadCount`);
          setUnreadCount(u => u + 1);
        }
        return current;
      });
    });

    newSocket.on('meet-link-updated', (link: string | null) => {
      setMeetLink(link);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, userName, roomPassword]);


  const handleClear = () => {
    // Incrementing counter forces the Canvas useEffect to trigger
    setClearTriggered(prev => prev + 1);
  };

  const handleLogin = (name: string, password?: string) => {
    // In a real app we'd verify password with backend here.
    // For now, if they provide any password, let them in.
    setUserName(name);
    if (password) {
      setRoomPassword(password.trim().toLowerCase());
    }
    setIsAuthenticated(true);
  };

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.error('Clipboard API failed', err);
      }
    }
    
    // Legacy fallback
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback copy failed', err);
      return false;
    }
  };

  const handleShare = async (forceCopy: boolean = false) => {
    try {
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('room', roomPassword.trim().toLowerCase());
      const shareUrl = url.toString();
      const shareData = {
        title: 'Join my Four Arms Canvas',
        text: `Join my collaborative drawing session on Four Arms! Room: ${roomPassword}`,
        url: shareUrl,
      };

      // Always try to copy to clipboard first if possible/requested
      if (forceCopy || !navigator.share) {
        const success = await copyToClipboard(shareUrl);
        if (success) {
          setShowCopiedToast(true);
          setTimeout(() => setShowCopiedToast(false), 2000);
        } else {
          alert('Failed to copy link. Please copy it manually from the browser address bar.');
        }
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('Sharing a localhost link.');
        }
        return;
      }

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const success = await copyToClipboard(shareUrl);
        if (success) {
          setShowCopiedToast(true);
          setTimeout(() => setShowCopiedToast(false), 2000);
        }
      }
    } catch (err) {  
      console.error('Sharing failed:', err);
      // Fallback to clipboard on any error
      try {
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('room', roomPassword.trim().toLowerCase());
        const success = await copyToClipboard(url.toString());
        if (success) {
          setShowCopiedToast(true);
          setTimeout(() => setShowCopiedToast(false), 2000);
        }
      } catch (e) {
        console.error('Final fallback failed:', e);
      }
    }
  };

  const handleUpdateMeetLink = () => {
    const link = window.prompt('Paste your Google Meet or Video Call link here:', meetLink || '');
    if (link !== null) {
      const trimmedLink = link.trim();
      if (trimmedLink) {
        socket?.emit('update-meet-link', trimmedLink);
      } else {
        socket?.emit('update-meet-link', null);
      }
    }
  };

  const handleSendMessage = (text: string) => {
    if (!socket || !isConnected) {
      console.warn(`[Chat] Cannot send message: socket connected=${!!socket}, isConnected=${isConnected}`);
      return;
    }
    console.log(`[Chat] Sending message: ${text}`);
    // Safe ID generation fallback for non-secure contexts (IP access)
    const msgId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15);

    const msg: ChatMessage = {
      id: msgId,
      senderName: userName,
      text,
      timestamp: Date.now()
    };
    socket.emit('send-message', msg);
  };

  useEffect(() => {
    if (isChatOpen) setUnreadCount(0);
  }, [isChatOpen]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-dot-pattern bg-[length:24px_24px] bg-slate-50 transition-colors duration-500 animate-in fade-in duration-700">
      <header className="fixed top-0 left-0 w-full h-16 flex items-center justify-between px-6 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 z-30 select-none pointer-events-none">
        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <span className="text-white font-black text-xl italic tracking-tighter">4A</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none uppercase">Four Arms</h1>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">Collab Canvas</span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 hidden md:block" />

          {/* Collaborative Link Display */}
          <div className="hidden lg:flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CollaborationLink roomId={roomPassword} onCopy={() => handleShare(true)} />
              {meetLink && (
                <div className="flex items-center gap-1">
                  <a 
                    href={meetLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600 hover:-translate-y-0.5 transition-all text-[11px] font-black uppercase tracking-tight active:scale-95 group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Join Video
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:translate-x-0.5 transition-transform"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
                  </a>
                  <button 
                    onClick={() => setIsMeetSidebarOpen(!isMeetSidebarOpen)}
                    className={`p-1.5 rounded-lg transition-all ${isMeetSidebarOpen ? 'bg-rose-100 text-rose-600' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={isMeetSidebarOpen ? 'Close Meet Sidebar' : 'Open Meet Sidebar'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-5 ml-1">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-tight">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className={`text-[9px] ${isConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isConnected ? 'Sync Active' : 'Connecting'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setIsMembersOpen(!isMembersOpen);
                  setIsChatOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all active:scale-95 ${isMembersOpen ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="text-[9px] font-extrabold uppercase tracking-tight">{activeUsers.length} Online</span>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className={`transition-transform duration-300 ${isMembersOpen ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-2 flex gap-2 transition-all hover:shadow-xl hover:bg-white/90">
            
            {/* Share Link Button */}
            <button 
              onClick={() => handleShare()}
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

            {/* Google Meet Share Action */}
            <button 
              onClick={handleUpdateMeetLink}
              className="px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2 uppercase tracking-tight"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              {meetLink ? 'Sync Video' : 'Link Video'}
            </button>

            <div className="w-[1px] h-auto bg-slate-200 my-1 mx-1" />

            <button 
              onClick={() => canvasRef.current?.exportImage()}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-2"
              title="Export as PNG"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
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
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              setIsMembersOpen(false);
            }}
            className={`w-14 h-14 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 flex items-center justify-center text-slate-700 hover:shadow-xl hover:bg-white/90 transition-all active:scale-95 relative ${isChatOpen ? 'ring-2 ring-indigo-500' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Active Users Overlay */}
      <ActiveUsers users={activeUsers} />
      
      {/* Canvas Layer */}
      {socket && (
        <Canvas 
          ref={canvasRef}
          userName={userName}
          currentTool={currentTool} 
          currentColor={currentColor} 
          strokeWidth={strokeWidth}
          onClearTriggered={clearTriggered} 
          socket={socket} 
          objects={objects}
          setObjects={setObjects}
        />
      )}

      {/* Floating Toolbar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-2xl rounded-[1.5rem] shadow-2xl shadow-slate-200/50 border border-white/60 p-2.5 flex items-center justify-center gap-1.5 transition-all pointer-events-auto">
          
          <ToolButton 
            active={false} 
            onClick={() => canvasRef.current?.undo()} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>}
            label="Undo (Ctrl+Z)"
          />

          <ToolButton 
            active={false} 
            onClick={() => canvasRef.current?.redo()} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>}
            label="Redo (Ctrl+Y/Ctrl+Shift+Z)"
          />

          <div className="w-[2px] h-8 bg-slate-100 rounded-full mx-1.5" />
          
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

          <ToolButton 
            active={currentTool === 'text'} 
            onClick={() => setCurrentTool('text')} 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/><path d="M9 9h6"/><path d="M12 9v6"/></svg>}
            label="Text Tool (T)"
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

          {/* Brush Size Slider */}
          <div className="flex flex-col items-center px-4 gap-1 group/slider">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter opacity-0 group-hover/slider:opacity-100 transition-opacity">Size</span>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={strokeWidth} 
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              className="w-24 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

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
        isConnected={isConnected}
      />

      <MembersPanel
        users={activeUsers}
        roomId={roomPassword}
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        onInvite={() => handleShare(true)}
        currentUserId={socket?.id}
      />

      {/* Google Meet Sidebar */}
      {meetLink && (
        <div 
          className={`fixed top-16 right-0 h-[calc(100vh-64px)] bg-white border-l border-slate-200 shadow-2xl transition-all duration-500 z-40 flex flex-col overflow-hidden ${isMeetSidebarOpen ? 'w-[400px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
        >
          <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              </div>
              <span className="font-bold text-slate-800 text-sm tracking-tight uppercase">Live Meeting</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.open(meetLink, '_blank')}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Open in new tab"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>
              </button>
              <button 
                onClick={() => setIsMeetSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-100 relative group">
            <iframe 
              src={meetLink} 
              className="w-full h-full border-none" 
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              title="Google Meet"
            />
            {/* Overlay for when iframe blocks interactions or has issues */}
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center p-8">
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center flex flex-col items-center gap-4 pointer-events-auto">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Meeting Active</p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">If the meeting doesn't load here, it might be blocked by the provider.</p>
                <a 
                  href={meetLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-tight shadow-lg shadow-indigo-100 hover:-translate-y-0.5 transition-all"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
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
