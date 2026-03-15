const API_BASE = '/api';

export interface AgentRecord {
  agentId: string;
  status: string;
  workspacePath: string;
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

export type StreamEnvelope = { type: 'log'; payload: string } | { type: 'agent'; payload: string };

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

export async function stopAgent(agentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/stop`, {
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
