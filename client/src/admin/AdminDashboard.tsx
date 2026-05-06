import { useState, useEffect } from 'react';
import { MessageSquare, Send, Clock, BarChart3 } from 'lucide-react';
import { API_URL } from '../config/api';

interface AdminStats {
  totalConversations: number;
  totalMessages: number;
  totalUsers: number;
  conversationsByDay: Array<{ date: string; count: number }>;
  languages: Array<{ language: string; count: number }>;
  styles: Array<{ style: string; count: number }>;
  avgMessagesPerConversation: number;
  avgResponseTimeMs: number | null;
}

interface AdminDashboardProps {
  userId: string;
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setStats(null);
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/chat/admin/stats?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Admin stats fetch failed:', res.status, errorData);
        setStats(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Admin stats fetch error:', e);
      setStats(null);
    }
    setLoading(false);
  };

  if (loading) return <div className="admin-page"><div className="admin-loading">Loading stats...</div></div>;
  if (!stats) return <div className="admin-page"><div className="admin-error">Failed to load stats</div></div>;

  const maxDayCount = Math.max(...stats.conversationsByDay.map(d => d.count), 1);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Your Dashboard</h1>
        <div className="admin-date-filter">
          <button className={days === 7 ? 'active' : ''} onClick={() => setDays(7)}>7D</button>
          <button className={days === 30 ? 'active' : ''} onClick={() => setDays(30)}>30D</button>
          <button className={days === 90 ? 'active' : ''} onClick={() => setDays(90)}>90D</button>
        </div>
      </div>

      <div className="admin-stats-grid">
        <StatCard label="Conversations" value={stats.totalConversations} icon={MessageSquare} color="purple" />
        <StatCard label="Messages" value={stats.totalMessages} icon={Send} color="blue" />
        <StatCard label="Avg Messages/Conv" value={stats.avgMessagesPerConversation} icon={BarChart3} color="amber" />
        <StatCard
          label="Avg Response Time"
          value={stats.avgResponseTimeMs ? `${stats.avgResponseTimeMs}ms` : 'N/A'}
          icon={Clock}
          color="green"
        />
      </div>

      <div className="admin-charts-row">
        <div className="admin-chart-card">
          <h3>Conversations by Day</h3>
          <div className="admin-bar-chart">
            {stats.conversationsByDay.map((d, i) => (
              <div key={i} className="admin-bar-col">
                <div
                  className="admin-bar"
                  style={{ height: `${Math.max((d.count / maxDayCount) * 100, 4)}%` }}
                  title={`${d.date}: ${d.count}`}
                />
                <span className="admin-bar-label">
                  {new Date(d.date).toLocaleDateString('en', { day: '2-digit', month: 'short' }).replace(/^0/, '')}
                </span>
              </div>
            ))}
            {stats.conversationsByDay.length === 0 && (
              <div className="admin-chart-empty">No data</div>
            )}
          </div>
        </div>

        <div className="admin-chart-card">
          <h3>By Language</h3>
          <div className="admin-list-stats">
            {stats.languages.map((l, i) => (
              <div key={i} className="admin-list-item">
                <span className="admin-list-label">{LANGUAGE_DISPLAY[l.language] || l.language}</span>
                <span className="admin-list-value">{l.count}</span>
              </div>
            ))}
            {stats.languages.length === 0 && (
              <div className="admin-chart-empty">No data</div>
            )}
          </div>
        </div>

        <div className="admin-chart-card">
          <h3>By Style</h3>
          <div className="admin-list-stats">
            {stats.styles.map((s, i) => (
              <div key={i} className="admin-list-item">
                <span className="admin-list-label">{STYLE_DISPLAY[s.style] || s.style}</span>
                <span className="admin-list-value">{s.count}</span>
              </div>
            ))}
            {stats.styles.length === 0 && (
              <div className="admin-chart-empty">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="admin-stat-card">
      <div className={`admin-stat-icon ${color}`}>
        <Icon size={18} />
      </div>
      <span className="admin-stat-value">{value}</span>
      <span className="admin-stat-label">{label}</span>
    </div>
  );
}

const LANGUAGE_DISPLAY: Record<string, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', bn: 'Bengali',
  ta: 'Tamil', te: 'Telugu', gu: 'Gujarati', kn: 'Kannada',
  hinglish: 'Hinglish', english: 'English', hindi: 'Hindi',
};

const STYLE_DISPLAY: Record<string, string> = {
  english: 'English', hindi: 'Hindi', hinglish: 'Hinglish',
  marathi: 'Marathi', 'mixed-tech': 'Mixed-Tech',
};
