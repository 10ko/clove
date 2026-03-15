import { useState } from 'react';
import { startAgent } from './api';

interface Props {
  onStarted: () => void;
}

const RUNTIMES = ['local', 'docker'] as const;
const PLUGINS = ['cursor'] as const;

export function StartAgentForm({ onStarted }: Props) {
  const [runtimeKey, setRuntimeKey] = useState<string>('local');
  const [pluginKey, setPluginKey] = useState<string>('cursor');
  const [repoPath, setRepoPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isDocker = runtimeKey === 'docker';
    const repo = isDocker ? repoUrl.trim() : repoPath.trim();
    if (!repo || !prompt.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: Parameters<typeof startAgent>[0] = {
        prompt: prompt.trim(),
        runtimeKey,
        pluginKey,
      };
      if (isDocker) body.repoUrl = repo;
      else body.repoPath = repo;
      await startAgent(body);
      setRepoPath('');
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
            onChange={(e) => setPluginKey(e.target.value)}
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
          Prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should the agent do?"
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  fontSize: '0.875rem',
  color: '#94a3b8',
};

const btnStyle: React.CSSProperties = {
  marginTop: '0.5rem',
};

const selectStyle: React.CSSProperties = {
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
