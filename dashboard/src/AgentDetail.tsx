import { useState, useEffect, useRef } from 'react';
import { cancelAgent, sendInput, pauseAgent, resumeAgent, deleteAgent, streamAgentUrl, vscodeUrlForPath } from './api';
import type { AgentRecord, StreamEnvelope } from './api';
import { avatarDataUri } from './avatar';
import { ConfirmModal } from './ConfirmModal';
import { IconBranch, IconCheck, IconClose, IconCopy, IconVscode } from './Icons';

interface Props {
  agentId: string;
  agent: AgentRecord | null;
  onClose: () => void;
  onAgentChanged?: () => void;
}

type StreamSegment = { type: StreamEnvelope['type']; payload: string };

export function AgentDetail({ agentId, agent, onClose, onAgentChanged }: Props) {
  const workspacePath = agent?.workspacePath ?? '';
  const isSleeping = agent?.status === 'sleeping';
  const [segments, setSegments] = useState<StreamSegment[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [pathJustCopied, setPathJustCopied] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const TEXTAREA_MIN_HEIGHT = 40;
  const TEXTAREA_MAX_HEIGHT = 280;

  function adjustTextareaHeight() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.min(TEXTAREA_MAX_HEIGHT, Math.max(TEXTAREA_MIN_HEIGHT, el.scrollHeight));
    el.style.height = `${h}px`;
    el.style.overflow = h >= TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  }

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  useEffect(() => {
    if (isSleeping) {
      setSegments([]);
      setStreamError(null);
      return;
    }
    setSegments([]);
    setStreamError(null);
    const url = streamAgentUrl(agentId);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as StreamEnvelope;
        setSegments((prev) => [...prev, { type: envelope.type, payload: envelope.payload }]);
      } catch {
        setSegments((prev) => [...prev, { type: 'log', payload: event.data + '\n' }]);
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
  }, [agentId, isSleeping]);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        cancelAgent(agentId).catch((err) => alert(err instanceof Error ? err.message : String(err)));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agentId]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
    };
  }, []);

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

  async function handlePauseConfirm() {
    try {
      await pauseAgent(agentId);
      onAgentChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleResume() {
    setResuming(true);
    try {
      await resumeAgent(agentId);
      onAgentChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setResuming(false);
    }
  }

  async function handleDeleteConfirm() {
    try {
      await deleteAgent(agentId);
      onClose();
      onAgentChanged?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCancelTask() {
    try {
      await cancelAgent(agentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCopyPath() {
    if (!workspacePath) return;
    navigator.clipboard.writeText(workspacePath).then(
      () => {
        if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current);
        setPathJustCopied(true);
        copyFeedbackTimeoutRef.current = setTimeout(() => {
          setPathJustCopied(false);
          copyFeedbackTimeoutRef.current = null;
        }, 2000);
      },
      () => alert('Failed to copy'),
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <img
            src={avatarDataUri(agentId)}
            alt=""
            width={56}
            height={56}
            style={headerAvatarStyle}
          />
          <div style={headerContentColumnStyle}>
            <div style={nameRowStyle}>
              <h2 style={titleStyle}>{agentId}</h2>
              {agent?.agentState != null && (
                <span style={agentStateBadgeStyle(agent.agentState)}>{agent.agentState}</span>
              )}
              {agent != null && (
                <>
                  <span style={headerTagStyle}>{agent.runtimeKey}</span>
                  <span style={headerTagStyle}>{agent.pluginKey}</span>
                </>
              )}
            </div>
            {agent != null && (
              <div style={headerMetaStyle}>
                <div style={headerPathRowStyle}>
                  <div style={headerPathStyle} title={agent.workspacePath}>
                    {agent.workspacePath}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    style={pathJustCopied ? { ...headerCopyBtnStyle, ...copiedBtnStyle } : headerCopyBtnStyle}
                    title={pathJustCopied ? 'Copied!' : 'Copy path'}
                  >
                    {pathJustCopied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </button>
                </div>
                {agent.branch != null && agent.branch !== '' && (
                  <div style={headerBranchRowStyle}>
                    <IconBranch size={12} />
                    <span style={headerBranchStyle}>{agent.branch}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={closeBtnWrapStyle}>
            <button type="button" onClick={onClose} style={closeBtnStyle} title="Close">
              <IconClose size={22} />
            </button>
          </div>
        </div>

        <div style={actionsBarStyle}>
          <div style={actionsLeftStyle}>
            {workspacePath && (
              <a
                href={vscodeUrlForPath(workspacePath)}
                target="_blank"
                rel="noopener noreferrer"
                style={actionLinkWithTextStyle}
                title="Open workspace in VS Code"
              >
                Open <IconVscode size={14} />
              </a>
            )}
          </div>
          <div style={actionsLeftStyle}>
            {isSleeping ? (
              <button type="button" onClick={handleResume} disabled={resuming} style={resumeBtnStyle} title="Resume agent">
                {resuming ? 'Resuming...' : 'Resume'}
              </button>
            ) : (
              <button type="button" onClick={() => setShowPauseConfirm(true)} style={pauseBtnStyle} title="Pause agent (keep workspace)">
                Pause
              </button>
            )}
            <button type="button" onClick={() => setShowDeleteConfirm(true)} style={deleteBtnStyle} title="Delete agent and workspace">
              Delete
            </button>
          </div>
        </div>

        <div style={streamSectionStyle}>
          <div style={streamLabelStyle}>{isSleeping ? 'Status' : 'Stream'}</div>
          <pre style={preStyle}>
            {isSleeping && segments.length === 0 && 'Agent is sleeping. Click "Resume" to continue.'}
            {!isSleeping && segments.length === 0 && '(waiting for output…)'}
            {segments.map((seg, i) => (
              <span key={i} style={segmentStyle(seg.type)} title={seg.type === 'reasoning' ? 'Reasoning' : seg.type === 'log' ? 'Log' : undefined}>
                {seg.payload}
              </span>
            ))}
            <div ref={outputEndRef} />
          </pre>
          {streamError && !isSleeping && (
            <div style={streamErrorStyle}>{streamError}</div>
          )}
        </div>

        {!isSleeping && (
          <form onSubmit={handleSendInput} style={formStyle} ref={(el) => { formRef.current = el; }}>
            <div style={inputRowStyle}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputValue.trim()) formRef.current?.requestSubmit();
                  }
                }}
                placeholder={agent?.agentState === 'busy' ? 'Agent is working…' : 'Type to send to agent… (Enter to send, Shift+Enter for new line)'}
                disabled={sending || agent?.agentState === 'busy'}
                rows={1}
                style={textareaStyle}
              />
              {agent?.agentState === 'busy' ? (
                <button type="button" onClick={handleCancelTask} style={cancelBtnStyle} title="Cancel current task (Cmd+. or Ctrl+.)">
                  Cancel
                </button>
              ) : (
                <button type="submit" disabled={sending || !inputValue.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              )}
            </div>
          </form>
        )}

        <ConfirmModal
          isOpen={showPauseConfirm}
          onClose={() => setShowPauseConfirm(false)}
          onConfirm={handlePauseConfirm}
          title="Pause agent?"
          message="The agent process will stop but the workspace and all changes will be preserved. You can resume anytime."
          confirmLabel="Pause"
          cancelLabel="Cancel"
          variant="danger"
        />
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete workspace?"
          message="This will permanently delete the worktree and branch. Any uncommitted changes will be lost. This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
        />
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: '1rem',
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '72rem',
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#1e293b',
  borderRadius: '0.5rem',
  border: '1px solid #334155',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '1.25rem 0.75rem',
  borderBottom: '1px solid #334155',
};

const headerAvatarStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: '50%',
  flexShrink: 0,
  objectFit: 'cover',
};

const headerContentColumnStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
};

const nameRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const headerMetaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
};

const headerPathRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  minWidth: 0,
  overflow: 'hidden',
};

const headerPathStyle: React.CSSProperties = {
  flex: '0 1 auto',
  minWidth: 0,
  fontSize: '0.8125rem',
  color: '#94a3b8',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const headerCopyBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.5rem',
  height: '1.5rem',
  padding: 0,
  border: 'none',
  borderRadius: '0.25rem',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
};

const headerBranchStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
};

const headerBranchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  color: '#64748b',
};

const headerTagStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '0.25rem',
  background: 'rgba(100, 116, 139, 0.25)',
  color: '#94a3b8',
  textTransform: 'capitalize',
};

function agentStateBadgeStyle(agentState: 'busy' | 'waiting'): React.CSSProperties {
  return {
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '0.25rem',
    background: agentState === 'busy' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
    color: agentState === 'busy' ? '#fbbf24' : '#22c55e',
  };
}

const closeBtnWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  marginLeft: 'auto',
  alignSelf: 'flex-start',
};

const closeBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  width: '2.5rem',
  height: '2.5rem',
  padding: 0,
  border: 'none',
  borderRadius: '0.25rem',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
};

const actionsBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  borderBottom: '1px solid #334155',
  flexWrap: 'wrap',
};

const actionsLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const pauseBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.8125rem',
  borderRadius: '0.25rem',
  border: '1px solid #334155',
  background: 'transparent',
  color: '#94a3b8',
  cursor: 'pointer',
};

const resumeBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.8125rem',
  borderRadius: '0.25rem',
  border: '1px solid rgba(34, 197, 94, 0.5)',
  background: 'rgba(34, 197, 94, 0.15)',
  color: '#22c55e',
  cursor: 'pointer',
};

const deleteBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.8125rem',
  borderRadius: '0.25rem',
  border: '1px solid rgba(239, 68, 68, 0.4)',
  background: 'transparent',
  color: '#fca5a5',
  cursor: 'pointer',
};

const actionLinkWithTextStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.25rem 0.5rem',
  fontSize: '0.8125rem',
  borderRadius: '0.25rem',
  border: '1px solid #334155',
  background: 'transparent',
  color: '#94a3b8',
  textDecoration: 'none',
  cursor: 'pointer',
};

const copiedBtnStyle: React.CSSProperties = {
  color: '#22c55e',
  borderColor: 'rgba(34, 197, 94, 0.5)',
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

function segmentStyle(type: StreamSegment['type']): React.CSSProperties {
  if (type === 'reasoning') {
    return { color: '#94a3b8', opacity: 0.85 };
  }
  if (type === 'log') {
    return { color: '#64748b', fontSize: '0.75em' };
  }
  if (type === 'user') {
    return {
      display: 'block',
      marginTop: '0.5rem',
      marginBottom: '0.25rem',
      padding: '0.2rem 0.4rem',
      borderRadius: '0.25rem',
      background: 'rgba(100, 116, 139, 0.2)',
    };
  }
  return {};
}

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
  minHeight: '16rem',
  maxHeight: '44rem',
};

const streamErrorStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  fontSize: '0.75rem',
  color: '#fca5a5',
};

const formStyle: React.CSSProperties = {
  padding: '0.5rem 1.25rem 1rem',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'flex-end',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  borderRadius: '0.375rem',
  border: '1px solid #334155',
  background: 'rgba(239, 68, 68, 0.2)',
  color: '#fca5a5',
  cursor: 'pointer',
  flexShrink: 0,
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  resize: 'none',
  minHeight: '2.5rem',
  padding: '0.5rem 0.6rem',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  color: '#e2e8f0',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '0.375rem',
  outline: 'none',
  boxSizing: 'border-box',
};
