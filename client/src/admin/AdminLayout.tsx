import { useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Mic,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  userEmail: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'leads', label: 'Lead Pipeline', icon: TrendingUp },
];

export function AdminLayout({ children, currentPage, onNavigate, userEmail }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="admin-logo">
          <Mic size={20} />
          {!collapsed && <span>Aisha Admin</span>}
        </div>

        {!collapsed && (
          <div className="admin-user-info">
            <span className="admin-user-email">{userEmail}</span>
          </div>
        )}

        <nav className="admin-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`admin-nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <button
          className="admin-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
