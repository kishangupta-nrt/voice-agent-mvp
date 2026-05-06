import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { API_URL } from '../config/api';

interface ConversationRecord {
  id: string;
  user_id: string | null;
  created_at: string;
  message_count: number;
  first_message: string | null;
  last_message: string | null;
  last_user_message: string | null;
  last_assistant_message: string | null;
  style: string | null;
  language: string | null;
}

interface AdminConversationsProps {
  userId: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

export function AdminConversations({ userId, onSelectConversation, onDeleteConversation }: AdminConversationsProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'messages'>('date');

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setConversations([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/chat/admin/conversations?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) {
      setConversations([]);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation? This cannot be undone.')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_URL}/chat/admin/conversations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        onDeleteConversation(id);
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const filtered = conversations.filter(c => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      (c.last_user_message || '').toLowerCase().includes(f) ||
      (c.last_assistant_message || '').toLowerCase().includes(f) ||
      (c.last_message || '').toLowerCase().includes(f) ||
      c.id.toLowerCase().includes(f) ||
      (c.user_id || '').toLowerCase().includes(f)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'messages') return b.message_count - a.message_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading) return <div className="admin-page"><div className="admin-loading">Loading conversations...</div></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Your Conversations</h1>
        <span className="admin-count">{sorted.length} conversations</span>
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Search conversations..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="admin-search"
        />
        <div className="admin-sort-toggle">
          <button className={sortBy === 'date' ? 'active' : ''} onClick={() => setSortBy('date')}>
            By Date
          </button>
          <button className={sortBy === 'messages' ? 'active' : ''} onClick={() => setSortBy('messages')}>
            By Messages
          </button>
        </div>
      </div>

      <div className="admin-conversations-list">
        {sorted.length === 0 && (
          <div className="admin-empty">No conversations found</div>
        )}
        {sorted.map(conv => (
          <div
            key={conv.id}
            className="admin-conversation-card"
            onClick={() => onSelectConversation(conv.id)}
          >
            <div className="admin-conv-header">
              <span className="admin-conv-title">
                {conv.first_message ? truncate(conv.first_message, 60) : 'Empty conversation'}
              </span>
              <button
                className="admin-conv-delete-btn"
                onClick={(e) => handleDelete(conv.id, e)}
                title="Delete conversation"
              >
                <Trash2 size={16} />
              </button>
              <span className="admin-conv-date">
                {new Date(conv.created_at).toLocaleDateString('en', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span className="admin-conv-count">{conv.message_count} msgs</span>
            </div>
            <div className="admin-conv-preview">
              {conv.last_user_message && (
                <div className="admin-conv-msg user">
                  <span className="msg-role">You:</span> {truncate(conv.last_user_message, 100)}
                </div>
              )}
              {conv.last_assistant_message && (
                <div className="admin-conv-msg assistant">
                  <span className="msg-role">Aisha:</span> {truncate(conv.last_assistant_message, 100)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}
