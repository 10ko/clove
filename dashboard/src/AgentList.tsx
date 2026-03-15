import { stopAgent, type AgentRecord } from './api';

interface Props {
  agents: AgentRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStop: () => void;
}

/** Build vscode:// URL to open a folder in a new window (VS Code and Cursor). */
function vscodeUrlForPath(workspacePath: string): string {
  const path = workspacePath.replace(/\\/g, '/');
  const encoded = encodeURI(path);
  const base = `vscode://file${path.startsWith('/') ? '' : '/'}${encoded}`;
  return `${base}${path.endsWith('/') ? '' : '/'}?windowId=_blank`;
}

export function AgentList({ agents, selectedId, onSelect, onStop }: Props) {
  async function handleStop(e: React.MouseEvent, agentId: string) {
    e.stopPropagation();
    try {
      await stopAgent(agentId);
      onStop();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2 style={sectionHeadingStyle}>Agents</h2>
      <div style={gridStyle}>
        {agents.map((a) => (
          <article
            key={a.agentId}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(a.agentId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(a.agentId);
              }
            }}
            style={{
              ...cardStyle,
              ...(selectedId === a.agentId ? cardSelectedStyle : {}),
            }}
          >
            <div style={cardHeaderStyle}>
              <span style={cardIdStyle}>{a.agentId}</span>
              <div style={badgesStyle}>
                <span style={statusBadgeStyle(a.status)}>{a.status}</span>
                {a.agentState && (
                  <span style={agentStateBadgeStyle(a.agentState)}>{a.agentState}</span>
                )}
              </div>
            </div>
            <div style={cardMetaStyle}>
              {a.runtimeKey} / {a.pluginKey}
            </div>
            <div style={cardPathStyle} title={a.workspacePath}>
              {a.workspacePath}
            </div>
            <div style={cardActionsStyle}>
              <a
                href={vscodeUrlForPath(a.workspacePath)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={actionLinkStyle}
                title="Open workspace in VS Code"
              >
                VS Code
              </a>
              <button
                type="button"
                onClick={(e) => handleStop(e, a.agentId)}
                style={actionBtnStyle}
                title="Stop agent"
              >
                Stop
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#e2e8f0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
  gap: '1rem',
};

const cardStyle: React.CSSProperties = {
  padding: '1rem',
  borderRadius: '0.5rem',
  background: '#1e293b',
  border: '1px solid #334155',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minHeight: '8rem',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const cardSelectedStyle: React.CSSProperties = {
  borderColor: '#38bdf8',
  boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.25)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minWidth: 0,
};

const cardIdStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.9375rem',
  color: '#e2e8f0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const badgesStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const isRunning = status === 'running';
  return {
    fontSize: '0.7rem',
    padding: '0.15rem 0.4rem',
    borderRadius: '0.25rem',
    background: isRunning ? 'rgba(34, 197, 94, 0.2)' : '#334155',
    color: isRunning ? '#22c55e' : '#94a3b8',
  };
}

function agentStateBadgeStyle(agentState: 'busy' | 'waiting'): React.CSSProperties {
  return {
    fontSize: '0.7rem',
    padding: '0.15rem 0.4rem',
    borderRadius: '0.25rem',
    background: agentState === 'busy' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
    color: agentState === 'busy' ? '#fbbf24' : '#22c55e',
  };
}

const cardMetaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
};

const cardPathStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '0.8125rem',
  color: '#94a3b8',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minHeight: 0,
};

const cardActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginTop: '0.25rem',
  paddingTop: '0.5rem',
  borderTop: '1px solid #334155',
};

const actionLinkStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  borderRadius: '0.25rem',
  border: '1px solid #334155',
  background: 'transparent',
  color: '#94a3b8',
  textDecoration: 'none',
  cursor: 'pointer',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  borderRadius: '0.25rem',
  border: '1px solid #334155',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
};
