import React from 'react';
import { User } from './ActiveUsers';

type MembersPanelProps = {
  users: User[];
  roomId: string; // Add roomId prop
  isOpen: boolean;
  onClose: () => void;
  onInvite: () => void;
  currentUserId?: string;
};

export function MembersPanel({ users, roomId, isOpen, onClose, onInvite, currentUserId }: MembersPanelProps) {
  const [showCopied, setShowCopied] = React.useState(false);

  const handleInviteClick = () => {
    onInvite();
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };
  // Colors for avatars based on name hash (using same logic as ActiveUsers)
  const getAvatarColor = (name: string) => {
    const colors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-fuchsia-500', 'bg-cyan-500', 'bg-violet-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-[280px] bg-white/95 backdrop-blur-2xl shadow-2xl border-l border-slate-200/60 flex flex-col transition-transform duration-300 z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-200/60 bg-white/50">
        <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Participants ({users.length})
        </h2>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
        </button>
      </div>

      {/* Room Details Section */}
      <div className="p-3 bg-indigo-50/40 border-b border-indigo-100/50">
         <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
               <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Active Room</span>
               <span className="text-xs font-mono font-bold text-indigo-600">{roomId}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] font-extrabold text-emerald-600 uppercase">Live</span>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {users.map((user) => (
            <div 
              key={user.id} 
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${getAvatarColor(user.name)} flex items-center justify-center text-white text-[10px] font-bold shadow-sm border border-black/5 ring-2 ring-white`}>
                  {getInitials(user.name)}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-slate-700 leading-tight">
                    {user.name}
                    {user.id === currentUserId && <span className="ml-1.5 text-[10px] text-slate-400 font-normal italic">(You)</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Online</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-slate-200/60 bg-slate-50/50">
         <button 
           onClick={handleInviteClick}
           className={`w-full py-2.5 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 ${showCopied ? 'bg-emerald-500 shadow-emerald-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
         >
           {showCopied ? (
             <>
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
               Copied Link!
             </>
           ) : (
             <>
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
               Copy Invite Link
             </>
           )}
         </button>
      </div>
    </div>
  );
}
