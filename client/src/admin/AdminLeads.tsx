import { useState, useEffect } from 'react';
import { API_URL } from '../config/api';

interface LeadSummary {
  stage: string;
  count: number;
  projectType: string | null;
  hasContact: boolean;
}

const STAGES = ['new', 'qualifying', 'warm', 'ready-to-close'];
const STAGE_LABELS: Record<string, string> = {
  'new': 'New',
  'qualifying': 'Qualifying',
  'warm': 'Warm',
  'ready-to-close': 'Ready to Close',
};
const STAGE_COLORS: Record<string, string> = {
  'new': '#6b7280',
  'qualifying': '#60a5fa',
  'warm': '#fbbf24',
  'ready-to-close': '#34d399',
};

const FUNNEL_SHAPES: Record<string, { left: string; right: string; leftBottom: string; rightBottom: string }> = {
  'new': { left: '0%', right: '100%', leftBottom: '8%', rightBottom: '92%' },
  'qualifying': { left: '8%', right: '92%', leftBottom: '15%', rightBottom: '85%' },
  'warm': { left: '15%', right: '85%', leftBottom: '22%', rightBottom: '78%' },
  'ready-to-close': { left: '22%', right: '78%', leftBottom: '28%', rightBottom: '72%' },
};

interface AdminLeadsProps {
  userId: string;
}

export function AdminLeads({ userId }: AdminLeadsProps) {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('all');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLeads([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_URL}/chat/admin/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (e) {
      setLeads([]);
    }
    setLoading(false);
  };

  const stageCounts: Record<string, number> = {};
  const stageProjects: Record<string, Record<string, number>> = {};

  for (const lead of leads) {
    stageCounts[lead.stage] = (stageCounts[lead.stage] || 0) + 1;
    if (lead.projectType) {
      if (!stageProjects[lead.stage]) stageProjects[lead.stage] = {};
      stageProjects[lead.stage][lead.projectType] = (stageProjects[lead.stage][lead.projectType] || 0) + 1;
    }
  }

  const filtered = filterStage === 'all'
    ? leads
    : leads.filter(l => l.stage === filterStage);

  const total = leads.length;
  const conversionRate = total > 0
    ? Math.round((stageCounts['ready-to-close'] || 0) / total * 100)
    : 0;

  if (loading) return <div className="admin-page"><div className="admin-loading">Loading leads...</div></div>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Your Lead Pipeline</h1>
        <span className="admin-count">{total} leads · {conversionRate}% conversion</span>
      </div>

      <div className="admin-funnel">
        {STAGES.map((stage, i) => {
          const count = stageCounts[stage] || 0;
          const projects = stageProjects[stage] || {};
          const shape = FUNNEL_SHAPES[stage];
          return (
            <div
              key={stage}
              className={`admin-funnel-stage ${filterStage === stage ? 'active' : ''}`}
              onClick={() => setFilterStage(filterStage === stage ? 'all' : stage)}
            >
              <div
                className="admin-funnel-shape"
                style={{
                  backgroundColor: STAGE_COLORS[stage],
                  '--funnel-left': shape.left,
                  '--funnel-right': shape.right,
                  '--funnel-left-bottom': shape.leftBottom,
                  '--funnel-right-bottom': shape.rightBottom,
                } as React.CSSProperties}
              />
              <div className="admin-funnel-info">
                <span className="admin-funnel-label">{STAGE_LABELS[stage]}</span>
                <span className="admin-funnel-count">{count}</span>
              </div>
              {Object.keys(projects).length > 0 && (
                <div className="admin-funnel-projects">
                  {Object.entries(projects).map(([proj, cnt]) => (
                    <span key={proj} className="admin-funnel-project">
                      {proj} ({cnt})
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filterStage !== 'all' && (
        <div className="admin-leads-list">
          <h3>{STAGE_LABELS[filterStage]} ({(stageCounts[filterStage] || 0)})</h3>
          <div className="admin-leads-grid">
            {filtered.map((lead, i) => (
              <div key={i} className="admin-lead-card">
                <div className="admin-lead-top">
                  <div
                    className="admin-lead-stage"
                    style={{ backgroundColor: STAGE_COLORS[lead.stage] }}
                  >
                    {STAGE_LABELS[lead.stage]}
                  </div>
                  {lead.hasContact && (
                    <span className="admin-lead-contact">Contact available</span>
                  )}
                </div>
                {lead.projectType && (
                  <div className="admin-lead-project">{lead.projectType}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
