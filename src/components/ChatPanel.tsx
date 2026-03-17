import React, { useState, useEffect, useRef } from 'react';

export type ChatMessage = {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
};

type ChatPanelProps = {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
};

export function ChatPanel({ messages, onSendMessage, isOpen, onClose, isConnected }: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`[ChatPanel] Form submitted with text: ${inputText}`);
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <>
      <div 
        className={`fixed top-0 right-0 h-full w-[280px] bg-white/90 backdrop-blur-2xl shadow-2xl border-l border-slate-200/60 flex flex-col transition-transform duration-300 z-50
          ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
      >
        <div className="flex items-center justify-between p-3 border-b border-slate-200/60 bg-white/50">
          <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Room Chat
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-[9px] text-slate-300 font-mono text-center pb-2 border-b border-slate-50">
            Messages: {messages.length} | Sync: {isConnected ? 'Active' : 'Wait...'}
          </div>
          
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 opacity-30">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <p className="text-[11px] font-medium text-slate-500">No messages yet.</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const senderName = msg.senderName || 'Anonymous';
              const isConsecutive = idx > 0 && messages[idx - 1].senderName === senderName;
              
              return (
                <div key={msg.id || idx} className={`flex flex-col ${isConsecutive ? 'mt-1' : 'mt-3'}`}>
                  {!isConsecutive && (
                    <span className="text-[10px] font-bold text-slate-400 mb-0.5 ml-1">{senderName}</span>
                  )}
                  <div className="bg-slate-100/70 rounded-xl rounded-tl-sm px-3 py-1.5 text-[13px] text-slate-600 w-fit max-w-[95%] shadow-sm border border-slate-200/20">
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-slate-200/60 bg-white/50">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Message..."
              className="w-full bg-slate-100 border-none rounded-lg pl-3 pr-9 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button 
              type="submit" 
              disabled={!inputText.trim()}
              className="absolute right-1 top-1 p-1.5 text-indigo-500 hover:bg-white rounded-md disabled:opacity-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
