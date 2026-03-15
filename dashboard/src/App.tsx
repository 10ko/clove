import { useState, useEffect, useCallback } from 'react';
import { listAgents, getServerInfo, type AgentRecord } from './api';
import { AgentList } from './AgentList';
import { AgentDetail } from './AgentDetail';
import { StartAgentForm } from './StartAgentForm';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';

export default function App() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newAgentModalOpen, setNewAgentModalOpen] = useState(false);
  const [serverCwd, setServerCwd] = useState<string>('');

  useEffect(() => {
    getServerInfo().then((info) => setServerCwd(info.cwd)).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await listAgents();
      setAgents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, error ? 10000 : 3000);
    return () => clearInterval(interval);
  }, [refresh, error]);

  const handleAgentStarted = useCallback(() => {
    refresh();
    setNewAgentModalOpen(false);
  }, [refresh]);

  return (
    <>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Clove</h1>
          <p style={subStyle}>Agent orchestrator</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setNewAgentModalOpen(true)}
          style={newAgentBtnStyle}
        >
          New agent
        </button>
      </header>

      <main style={mainStyle}>
        {error && (
          <div style={errorStyle}>
            <strong>API unreachable.</strong> Start the server in another terminal:
            <code style={codeBlockStyle}> clove serve</code>
            <br />
            <span style={errorDetailStyle}>{error}</span>
          </div>
        )}

        {loading ? (
          <p style={loadingStyle}>Loading agents…</p>
        ) : agents.length === 0 ? (
          <EmptyState onNewAgent={() => setNewAgentModalOpen(true)} />
        ) : (
          <AgentList
            agents={agents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}

        <Modal
          isOpen={newAgentModalOpen}
          onClose={() => setNewAgentModalOpen(false)}
          title="New agent"
        >
          <StartAgentForm
            onStarted={handleAgentStarted}
            defaultRepoPath={serverCwd || undefined}
            isOpen={newAgentModalOpen}
          />
        </Modal>

        {selectedId && (
          <AgentDetail
            agentId={selectedId}
            agent={agents.find((a) => a.agentId === selectedId) ?? null}
            onClose={() => setSelectedId(null)}
            onStop={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        )}
      </main>
    </>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #334155',
};

const newAgentBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  borderRadius: '0.375rem',
  cursor: 'pointer',
};

const loadingStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.875rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
};

const subStyle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  fontSize: '0.875rem',
  color: '#94a3b8',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: '1.5rem',
  maxWidth: '56rem',
  margin: '0 auto',
  width: '100%',
};

const errorStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  marginBottom: '1rem',
  borderRadius: '0.375rem',
  background: 'rgba(248, 113, 113, 0.15)',
  color: '#fca5a5',
  fontSize: '0.875rem',
};

const codeBlockStyle: React.CSSProperties = {
  display: 'inline-block',
  margin: '0 0.25rem',
  padding: '0.125rem 0.5rem',
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '0.25rem',
  fontFamily: 'monospace',
};

const errorDetailStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '0.5rem',
  fontSize: '0.8125rem',
  opacity: 0.9,
};
