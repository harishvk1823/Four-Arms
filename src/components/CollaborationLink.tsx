import { useState, useEffect } from 'react';

type CollaborationLinkProps = {
  roomId: string;
  onCopy: () => void;
};

export function CollaborationLink({ roomId, onCopy }: CollaborationLinkProps) {
  const [fullUrl, setFullUrl] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', roomId.trim().toLowerCase());
    setFullUrl(url.toString());
  }, [roomId]);

  const handleCopy = () => {
    onCopy();
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const displayUrl = fullUrl.replace(/^https?:\/\//, '');

  return (
    <div 
      className="relative group flex items-center gap-2 px-3 py-1.5 bg-white/40 backdrop-blur-md border border-white/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden max-w-[240px] lg:max-w-[320px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCopy}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Collaborative Link</span>
          <div className="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20">
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black text-emerald-600 uppercase">Live</span>
          </div>
        </div>
        <div className="text-[11px] font-mono font-medium text-slate-600 truncate">
          {displayUrl}
        </div>
      </div>

      <div className={`ml-auto p-1.5 rounded-lg transition-colors ${showCopied ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100'}`}>
        {showCopied ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        )}
      </div>

      {/* Tooltip */}
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900/90 text-white text-[10px] rounded-lg opacity-0 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 ${isHovered && !showCopied ? 'opacity-100' : ''}`}>
        Click to copy invite link
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/90" />
      </div>
      
      {/* Toast Mini */}
      <div className={`absolute inset-0 bg-emerald-500/95 flex items-center justify-center transition-transform duration-300 translate-y-full ${showCopied ? 'translate-y-0' : ''}`}>
        <span className="text-white text-[10px] font-black uppercase tracking-wider">Copied to Clipboard!</span>
      </div>
    </div>
  );
}
