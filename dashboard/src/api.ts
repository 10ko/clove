const API_BASE =
  (import.meta as any).env?.VITE_CLOVE_API_URL && typeof (import.meta as any).env.VITE_CLOVE_API_URL === 'string'
    ? ((import.meta as any).env.VITE_CLOVE_API_URL as string)
    : '/api';

export interface AgentRecord {
  agentId: string;
  status: string;
  workspacePath: string;
  branch?: string;
  runtimeKey: string;
  pluginKey: string;
  /** Agent phase: "busy" (prompt in flight) or "waiting" (ready for input). Set when runtime supports it. */
  agentState?: 'busy' | 'waiting';
}

export interface ListAgentsResponse {
  agents: AgentRecord[];
}

export interface StartAgentBody {
  repoPath?: string;
  repoUrl?: string;
  /** Optional: initial prompt for the agent. Omit to start and send later via send-input. */
  prompt?: string;
  /** Required: unique id for the agent (e.g. memorable name like swift-tiger). */
  agentId: string;
  /** Optional: branch segment (branch will be clove/<branchName>). Defaults to agentId. */
  branchName?: string;
  runtimeKey?: string;
  pluginKey?: string;
}

export interface StartAgentResponse {
  path: string;
  branch: string;
  mainRepoRoot?: string;
  repoPath: string;
}

export type StreamEnvelope =
  | { type: 'log'; payload: string }
  | { type: 'reasoning'; payload: string }
  | { type: 'agent'; payload: string }
  | { type: 'user'; payload: string };

export interface ServerInfo {
  cwd: string;
}

export async function getServerInfo(): Promise<ServerInfo> {
  const res = await fetch(`${API_BASE}/info`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listAgents(): Promise<AgentRecord[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) throw new Error(await res.text());
  const data: ListAgentsResponse = await res.json();
  return data.agents;
}

export async function startAgent(body: StartAgentBody): Promise<StartAgentResponse> {
  const res = await fetch(`${API_BASE}/agents/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Failed to start agent');
  }
  return res.json();
}

export async function pauseAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/pause`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function resumeAgent(agentId: string, prompt?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt ?? '' }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await res.text());
}

/** @deprecated Use pauseAgent */
export async function stopAgent(agentId: string): Promise<void> {
  return pauseAgent(agentId);
}

export async function cancelAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function sendInput(agentId: string, input: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(await res.text());
}

export function streamAgentUrl(agentId: string): string {
  return `${API_BASE}/agents/${encodeURIComponent(agentId)}/stream`;
}

/** Build vscode:// URL to open a folder in a new window (VS Code and Cursor). */
export function vscodeUrlForPath(workspacePath: string): string {
  const path = workspacePath.replace(/\\/g, '/');
  const encoded = encodeURI(path);
  const base = `vscode://file${path.startsWith('/') ? '' : '/'}${encoded}`;
  return `${base}${path.endsWith('/') ? '' : '/'}?windowId=_blank`;
}
