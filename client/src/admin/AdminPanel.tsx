import { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { AdminDashboard } from './AdminDashboard';
import { AdminConversations } from './AdminConversations';
import { AdminConversationDetail } from './AdminConversationDetail';
import { AdminLeads } from './AdminLeads';

interface AdminPanelProps {
  userId: string;
  userEmail: string;
  onExit: () => void;
}

export function AdminPanel({ userId, userEmail, onExit }: AdminPanelProps) {
  const [page, setPage] = useState('dashboard');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const handleSelectConversation = (id: string) => {
    setSelectedConversation(id);
    setPage('conversation-detail');
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setPage('conversations');
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <AdminDashboard userId={userId} />;
      case 'conversations':
        return <AdminConversations userId={userId} onSelectConversation={handleSelectConversation} />;
      case 'conversation-detail':
        return selectedConversation ? (
          <AdminConversationDetail conversationId={selectedConversation} userId={userId} onBack={handleBack} />
        ) : (
          <AdminConversations userId={userId} onSelectConversation={handleSelectConversation} />
        );
      case 'leads':
        return <AdminLeads userId={userId} />;
      default:
        return <AdminDashboard userId={userId} />;
    }
  };

  return (
    <>
      <AdminLayout currentPage={page} onNavigate={setPage} userEmail={userEmail}>
        {renderPage()}
      </AdminLayout>
      <button className="admin-exit-btn" onClick={onExit}>
        Exit Admin
      </button>
    </>
  );
}
