interface Props {
  onNewAgent: () => void;
}

export function EmptyState({ onNewAgent }: Props) {
  return (
    <div style={containerStyle}>
      <div style={iconStyle} aria-hidden>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" />
          <path d="M8 7l4-4 4 4" />
          <path d="M8 17l4 4 4-4" />
          <path d="M3 12h2" />
          <path d="M19 12h2" />
          <path d="M5 9h2" />
          <path d="M17 9h2" />
          <path d="M5 15h2" />
          <path d="M17 15h2" />
        </svg>
      </div>
      <h2 style={headingStyle}>No agents yet</h2>
      <p style={textStyle}>
        Start an agent to work on a repo. Each agent runs in an isolated workspace so you can review changes before merging.
      </p>
      <button type="button" onClick={onNewAgent} style={buttonStyle}>
        New agent
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '3rem 2rem',
  minHeight: '20rem',
  borderRadius: '0.5rem',
  background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
  border: '1px dashed #334155',
};

const iconStyle: React.CSSProperties = {
  color: '#475569',
  marginBottom: '1.25rem',
  opacity: 0.9,
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#e2e8f0',
  marginBottom: '0.5rem',
};

const textStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.9375rem',
  color: '#94a3b8',
  maxWidth: '22rem',
  lineHeight: 1.5,
  marginBottom: '1.5rem',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  fontSize: '0.9375rem',
  fontWeight: 500,
  borderRadius: '0.375rem',
  border: '1px solid #475569',
  background: '#334155',
  color: '#e2e8f0',
  cursor: 'pointer',
};
