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

  if (agents.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
        No agents. Start one above.
      </p>
    );
  }

  return (
    <section>
      <h2 style={headingStyle}>Agents</h2>
      <ul style={listStyle}>
        {agents.map((a) => (
          <li
            key={a.agentId}
            style={{
              ...itemStyle,
              ...(selectedId === a.agentId ? itemSelectedStyle : {}),
            }}
            onClick={() => onSelect(a.agentId)}
          >
            <div style={itemMainStyle}>
              <span style={idStyle}>{a.agentId}</span>
              <span style={statusBadgeStyle(a.status)}>{a.status}</span>
              {a.agentState && (
                <span style={agentStateStyle(a.agentState)}>{a.agentState}</span>
              )}
              <span style={metaStyle}>{a.runtimeKey} / {a.pluginKey}</span>
            </div>
            <div style={pathStyle} title={a.workspacePath}>
              {a.workspacePath}
            </div>
            <a
              href={vscodeUrlForPath(a.workspacePath)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={openVscodeBtnStyle}
              title="Open workspace in VS Code"
            >
              VS Code
            </a>
            <button
              type="button"
              onClick={(e) => handleStop(e, a.agentId)}
              style={stopBtnStyle}
              title="Stop agent"
            >
              Stop
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const headingStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1rem',
  fontWeight: 600,
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  marginBottom: '0.5rem',
  borderRadius: '0.375rem',
  background: '#1e293b',
  border: '1px solid #334155',
  cursor: 'pointer',
};

const itemSelectedStyle: React.CSSProperties = {
  borderColor: '#38bdf8',
  boxShadow: '0 0 0 1px #38bdf8',
};

const itemMainStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: 0,
};

const idStyle: React.CSSProperties = {
  fontWeight: 500,
  flexShrink: 0,
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const isRunning = status === 'running';
  return {
    fontSize: '0.75rem',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    background: isRunning ? 'rgba(34, 197, 94, 0.2)' : '#334155',
    color: isRunning ? '#22c55e' : '#94a3b8',
  };
}

function agentStateStyle(agentState: 'busy' | 'waiting'): React.CSSProperties {
  return {
    fontSize: '0.7rem',
    padding: '0.1rem 0.35rem',
    borderRadius: '0.2rem',
    background: agentState === 'busy' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
    color: agentState === 'busy' ? '#fbbf24' : '#22c55e',
  };
}

const metaStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
};

const pathStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.875rem',
  color: '#64748b',
};

const openVscodeBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  borderRadius: '0.375rem',
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#e2e8f0',
  textDecoration: 'none',
  cursor: 'pointer',
};

const stopBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
};
