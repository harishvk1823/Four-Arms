

export type User = {
  id: string;
  name: string;
};

type ActiveUsersProps = {
  users: User[];
};

export function ActiveUsers({ users }: ActiveUsersProps) {
  if (users.length === 0) return null;

  // Colors for avatars based on name hash (simple)
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
    <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-auto z-20 flex bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm p-1.5 rounded-full items-center pl-3 gap-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {users.length} {users.length === 1 ? 'User' : 'Users'}
      </span>
      <div className="flex -space-x-2 mr-1">
        {users.slice(0, 5).map((user, i) => (
          <div 
            key={user.id} 
            title={user.name}
            className={`w-8 h-8 rounded-full ${getAvatarColor(user.name)} flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm ring-1 ring-black/5 hover:relative hover:z-10 transition-transform hover:scale-110 cursor-help`}
            style={{ zIndex: 10 - i }}
          >
            {getInitials(user.name)}
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold border-2 border-white shadow-sm ring-1 ring-black/5" style={{ zIndex: 0 }}>
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}
