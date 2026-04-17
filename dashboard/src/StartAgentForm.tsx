import { useState, useEffect, useCallback } from 'react';
import { uniqueNamesGenerator, adjectives, animals } from 'unique-names-generator';
import { CURSOR_MODEL_OPTIONS } from '../../src/cursor-models.ts';
import { getServerInfo, startAgent, type CursorModelOption } from './api';

function generateMemorableId(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    length: 2,
    separator: '-',
    style: 'lowerCase',
  });
}

interface Props {
  onStarted: () => void;
  /** Default repo path (e.g. server cwd) when creating a new agent. */
  defaultRepoPath?: string;
  /** When true (e.g. modal just opened), repo path and agent id are reset/defaulted. */
  isOpen?: boolean;
}

const RUNTIMES = ['local', 'docker'] as const;
const PLUGINS = ['cursor'] as const;

function bundledCursorModels(): CursorModelOption[] {
  return CURSOR_MODEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
}

export function StartAgentForm({ onStarted, defaultRepoPath, isOpen }: Props) {
  const [agentId, setAgentId] = useState<string>(() => generateMemorableId());
  const [branchName, setBranchName] = useState<string>('');
  const [runtimeKey, setRuntimeKey] = useState<string>('local');
  const [pluginKey, setPluginKey] = useState<string>('cursor');
  const [repoPath, setRepoPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [cursorModels, setCursorModels] = useState<CursorModelOption[]>(bundledCursorModels);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDefaults = useCallback(() => {
    setAgentId(generateMemorableId());
    setBranchName('');
    setModel('');
    if (defaultRepoPath) setRepoPath(defaultRepoPath);
  }, [defaultRepoPath]);

  useEffect(() => {
    if (isOpen) resetDefaults();
  }, [isOpen, resetDefaults]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const info = await getServerInfo();
        if (cancelled) return;
        if (info.cursorModels != null && info.cursorModels.length > 0) {
          setCursorModels(info.cursorModels);
        }
      } catch {
        if (!cancelled) setCursorModels(bundledCursorModels());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isDocker = runtimeKey === 'docker';
    const repo = isDocker ? repoUrl.trim() : repoPath.trim();
    const id = agentId.trim();
    if (!repo) return;
    if (!id) {
      setError('Agent ID is required');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: Parameters<typeof startAgent>[0] = {
        agentId: id,
        prompt: prompt.trim() || undefined,
        runtimeKey,
        pluginKey,
        branchName: branchName.trim() || undefined,
      };
      if (isDocker) body.repoUrl = repo;
      else body.repoPath = repo;
      if (pluginKey === 'cursor' && model.trim() !== '') {
        body.model = model.trim();
      }
      await startAgent(body);
      resetDefaults();
      setRepoUrl('');
      setPrompt('');
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isDocker = runtimeKey === 'docker';

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      {error && <div style={errorStyle}>{error}</div>}
      <div style={rowStyle}>
        <label style={labelStyle}>
          Agent ID
        </label>
        <div style={agentIdRowStyle}>
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="e.g. swift-tiger"
            disabled={submitting}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={() => setAgentId(generateMemorableId())}
            disabled={submitting}
            style={refreshBtnStyle}
            title="Generate a new random name"
          >
            ↻
          </button>
        </div>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>
          Branch name (optional)
          <input
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder={agentId.trim() ? `defaults to clove/${agentId.trim()} (or enter any branch name)` : 'defaults to clove/<agent-id>'}
            disabled={submitting}
            style={inputStyle}
          />
        </label>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>
          Runtime
          <select
            value={runtimeKey}
            onChange={(e) => setRuntimeKey(e.target.value)}
            disabled={submitting}
            style={selectStyle}
          >
            {RUNTIMES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>
          Agent
          <select
            value={pluginKey}
            onChange={(e) => {
              setPluginKey(e.target.value);
              if (e.target.value !== 'cursor') setModel('');
            }}
            disabled={submitting}
            style={selectStyle}
          >
            {PLUGINS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pluginKey === 'cursor' && (
        <div style={rowStyle}>
          <label style={labelStyle}>
            Model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={submitting}
              style={selectStyle}
            >
              {cursorModels.map((m) => (
                <option key={m.value === '' ? '__default' : m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div style={rowStyle}>
        <label style={labelStyle}>
          {isDocker ? 'Repo URL' : 'Repo path'}
          <input
            type="text"
            value={isDocker ? repoUrl : repoPath}
            onChange={(e) => (isDocker ? setRepoUrl(e.target.value) : setRepoPath(e.target.value))}
            placeholder={isDocker ? 'https://github.com/org/repo' : '/path/to/repo or .'}
            disabled={submitting}
          />
        </label>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>
          Prompt (optional)
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the agent do? Leave empty to start and type later."
            rows={2}
            disabled={submitting}
          />
        </label>
      </div>
      <button type="submit" disabled={submitting} style={btnStyle}>
        {submitting ? 'Starting…' : 'Start agent'}
      </button>
    </form>
  );
}

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0',
};

const errorStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
  padding: '0.5rem',
  borderRadius: '0.25rem',
  background: 'rgba(248, 113, 113, 0.2)',
  color: '#fca5a5',
  fontSize: '0.875rem',
};

const rowStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
};

const agentIdRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'stretch',
  marginTop: '0.25rem',
};

const refreshBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '0.5rem 0.75rem',
  borderRadius: '0.25rem',
  border: '1px solid #334155',
  background: '#334155',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: '1.125rem',
  lineHeight: 1,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  fontSize: '0.875rem',
  color: '#94a3b8',
};

const btnStyle: React.CSSProperties = {
  marginTop: '0.5rem',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  marginTop: '0.25rem',
  borderRadius: '0.25rem',
  background: '#0f172a',
  border: '1px solid #334155',
  color: '#e2e8f0',
  fontSize: '0.875rem',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};
