import type { AgentRecord } from './api';
import { avatarDataUri } from './avatar';
import { IconBranch } from './Icons';

interface Props {
  agents: AgentRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AgentList({ agents, selectedId, onSelect }: Props) {
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
            <div style={cardHeaderWrapperStyle}>
              <div style={cardHeaderStyle}>
                <div style={cardAvatarWrapStyle}>
                  <img
                    src={avatarDataUri(a.agentId)}
                    alt=""
                    width={56}
                    height={56}
                    style={cardAvatarStyle}
                  />
                </div>
                <div style={cardNameTagsBlockStyle}>
                  <span style={cardIdStyle}>{a.agentId}</span>
                  <div style={cardTagsRowStyle}>
                    {a.agentState != null && (
                      <span style={cardAgentStateBadgeStyle(a.agentState)}>{a.agentState}</span>
                    )}
                    <span style={cardTagStyle}>{a.runtimeKey}</span>
                    <span style={cardTagStyle}>{a.pluginKey}</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={cardFooterStyle}>
              {a.branch != null && a.branch !== '' ? (
                <div style={cardBranchRowStyle}>
                  <IconBranch size={14} />
                  <span style={cardBranchStyle}>{a.branch}</span>
                </div>
              ) : <span />}
              <span style={cardArrowStyle} aria-hidden>→</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#e2e8f0',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
  gap: '1rem',
};

const cardStyle: React.CSSProperties = {
  padding: '1.125rem',
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

const cardHeaderWrapperStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  minHeight: 0,
};

const cardFooterStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
};

const cardSelectedStyle: React.CSSProperties = {
  borderColor: '#38bdf8',
  boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.25)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: '0.75rem',
  minWidth: 0,
};

const cardAvatarWrapStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 10,
  lineHeight: 0,
  overflow: 'hidden',
};

const cardAvatarStyle: React.CSSProperties = {
  display: 'block',
  width: 56,
  height: 56,
  borderRadius: '50%',
  objectFit: 'cover',
};

const cardNameTagsBlockStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '0.35rem',
};

const cardIdStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '1.0625rem',
  color: '#e2e8f0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cardTagsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.35rem',
};

const cardTagStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '0.25rem',
  background: 'rgba(100, 116, 139, 0.25)',
  color: '#94a3b8',
  textTransform: 'capitalize',
};

function cardAgentStateBadgeStyle(agentState: 'busy' | 'waiting'): React.CSSProperties {
  return {
    fontSize: '0.8125rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '0.25rem',
    background: agentState === 'busy' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
    color: agentState === 'busy' ? '#fbbf24' : '#22c55e',
  };
}

const cardBranchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  color: '#64748b',
  minWidth: 0,
  overflow: 'hidden',
};

const cardBranchStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const cardArrowStyle: React.CSSProperties = {
  fontSize: '1.125rem',
  color: '#64748b',
  flexShrink: 0,
};
