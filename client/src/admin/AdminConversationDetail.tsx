import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { API_URL } from '../config/api';

interface ConversationDetail {
  id: string;
  user_id: string | null;
  created_at: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    duration_ms: number | null;
    created_at: string;
  }>;
}

interface AdminConversationDetailProps {
  conversationId: string;
  userId: string;
  onBack: () => void;
}

export function AdminConversationDetail({ conversationId, userId, onBack }: AdminConversationDetailProps) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetail();
  }, [conversationId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat/admin/conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data = await res.json();
      setDetail(data);
    } catch (e) {
      setDetail(null);
    }
    setLoading(false);
  };

  if (loading) return <div className="admin-page"><div className="admin-loading">Loading conversation...</div></div>;
  if (!detail) return <div className="admin-page"><div className="admin-error">Conversation not found</div></div>;

  const leadInfo = analyzeLead(detail.messages);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <button className="admin-back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>Conversation</h1>
        <span className="admin-conv-id-badge">{detail.messages.length} messages</span>
      </div>

      <div className="admin-detail-meta">
        <div className="admin-meta-card">
          <span className="admin-meta-label">Created</span>
          <span className="admin-meta-value">
            {new Date(detail.created_at).toLocaleDateString('en', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <div className="admin-meta-card">
          <span className="admin-meta-label">User</span>
          <span className="admin-meta-value" style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {detail.user_id ? detail.user_id.slice(0, 8) + '...' : 'Anonymous'}
          </span>
        </div>
        {leadInfo.projectType && (
          <div className="admin-meta-card highlight">
            <span className="admin-meta-label">Project</span>
            <span className="admin-meta-value">{leadInfo.projectType}</span>
          </div>
        )}
        {leadInfo.stage && (
          <div className="admin-meta-card highlight">
            <span className="admin-meta-label">Lead Stage</span>
            <span className="admin-meta-value">{leadInfo.stage}</span>
          </div>
        )}
      </div>

      <div className="admin-conversation-thread">
        {detail.messages.map(msg => (
          <div key={msg.id} className={`admin-msg ${msg.role}`}>
            <div className="admin-msg-header">
              <span className="admin-msg-role">{msg.role === 'user' ? 'User' : 'Aisha'}</span>
              <span className="admin-msg-time">
                {new Date(msg.created_at).toLocaleTimeString('en', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {msg.duration_ms !== null && (
                <span className="admin-msg-duration">{msg.duration_ms}ms</span>
              )}
            </div>
            <div className="admin-msg-content">{msg.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function analyzeLead(messages: ConversationDetail['messages']) {
  const userMsgs = messages.filter(m => m.role === 'user');
  const allText = userMsgs.map(m => m.content.toLowerCase()).join(' ');

  let projectType = '';
  if (/website|web app|landing/.test(allText)) projectType = 'Website';
  else if (/mobile app|android|ios|react native/.test(allText)) projectType = 'App';
  else if (/ai |chatbot|voice agent|automation/.test(allText)) projectType = 'AI Solution';

  let stage = 'New';
  if (projectType) stage = 'Qualifying';
  if (/feature|login|payment|budget|cost|price|kitna/.test(allText)) stage = 'Warm';
  if (/phone|email|contact|meeting|call|callback/.test(allText)) stage = 'Ready to Close';

  return { projectType, stage };
}
