import { useState, useEffect, useRef } from 'react';
import { sendInput, streamAgentUrl } from './api';
import type { StreamEnvelope } from './api';

interface Props {
  agentId: string;
  onClose: () => void;
}

export function AgentDetail({ agentId, onClose }: Props) {
  const [output, setOutput] = useState<string>('');
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setOutput('');
    setStreamError(null);
    const url = streamAgentUrl(agentId);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as StreamEnvelope;
        setOutput((prev) => prev + envelope.payload);
      } catch {
        setOutput((prev) => prev + event.data + '\n');
      }
    };

    es.onerror = () => {
      es.close();
      setStreamError('Stream ended or failed');
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId]);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  async function handleSendInput(e: React.FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendInput(agentId, text);
      setInputValue('');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{agentId}</h2>
          <button type="button" onClick={onClose} style={closeBtnStyle}>
            Close
          </button>
        </div>

        <div style={streamSectionStyle}>
          <div style={streamLabelStyle}>Stream</div>
          <pre style={preStyle}>
            {output || '(waiting for output…)'}
            <div ref={outputEndRef} />
          </pre>
          {streamError && (
            <div style={streamErrorStyle}>{streamError}</div>
          )}
        </div>

        <form onSubmit={handleSendInput} style={formStyle}>
          <label style={labelStyle}>
            Send input
            <div style={inputRowStyle}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type to send to agent…"
                disabled={sending}
              />
              <button type="submit" disabled={sending || !inputValue.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </label>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: '1rem',
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '42rem',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#1e293b',
  borderRadius: '0.5rem',
  border: '1px solid #334155',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 1.25rem',
  borderBottom: '1px solid #334155',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
};

const closeBtnStyle: React.CSSProperties = {
  flexShrink: 0,
};

const streamSectionStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  padding: '1rem 1.25rem',
};

const streamLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  marginBottom: '0.25rem',
};

const preStyle: React.CSSProperties = {
  flex: 1,
  margin: 0,
  padding: '0.75rem',
  overflow: 'auto',
  background: '#0f172a',
  borderRadius: '0.375rem',
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: '20rem',
};

const streamErrorStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  fontSize: '0.75rem',
  color: '#fca5a5',
};

const formStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  borderTop: '1px solid #334155',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  color: '#94a3b8',
  marginBottom: '0.25rem',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};
