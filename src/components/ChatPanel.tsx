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
};

export function ChatPanel({ messages, onSendMessage, isOpen, onClose }: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <>
      <div 
        className={`absolute top-0 right-0 h-full w-80 bg-white/90 backdrop-blur-2xl shadow-2xl border-l border-slate-200/60 flex flex-col transition-transform duration-300 z-40
          ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200/60 bg-white/50">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Room Chat
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => {
            const isConsecutive = idx > 0 && messages[idx - 1].senderName === msg.senderName;
            
            return (
              <div key={msg.id} className={`flex flex-col ${isConsecutive ? 'mt-1' : 'mt-4'}`}>
                {!isConsecutive && (
                  <span className="text-xs font-semibold text-slate-500 mb-1 ml-1">{msg.senderName}</span>
                )}
                <div className="bg-slate-100/80 rounded-2xl rounded-tl-sm px-4 py-2 text-sm text-slate-700 w-fit max-w-[90%]">
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-200/60 bg-white/50">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-slate-100 border-none rounded-xl pl-4 pr-10 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button 
              type="submit" 
              disabled={!inputText.trim()}
              className="absolute right-1.5 top-1.5 p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
