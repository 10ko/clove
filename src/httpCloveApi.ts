/**
 * HTTP client for talking to a running Clove daemon.
 */

import type { AgentId, StreamEnvelope } from './types.js';
import type { AgentRecord } from './orchestrator.js';
import type { StartAgentParams, StartAgentResult } from './api.js';
import type { CliApi } from './cliApi.js';

export class HttpCloveApi implements CliApi {
  constructor(private readonly baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async listAgents(): Promise<AgentRecord[]> {
    const res = await fetch(this.url('/api/agents'));
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { agents: AgentRecord[] };
    return data.agents;
  }

  async startAgent(params: StartAgentParams): Promise<StartAgentResult> {
    const body: Record<string, unknown> = {
      agentId: params.agentId,
      prompt: params.prompt,
      runtimeKey: params.runtimeKey,
      pluginKey: params.pluginKey,
    };
    if (params.sourceRepo.type === 'path') {
      body.repoPath = params.sourceRepo.path;
    } else {
      body.repoUrl = params.sourceRepo.url;
    }
    if (params.branchName != null && params.branchName !== '') {
      body.branchName = params.branchName;
    }
    const res = await fetch(this.url('/api/agents/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error((err as { error?: string }).error ?? 'Failed to start agent');
    }
    return res.json() as Promise<StartAgentResult>;
  }

  async pauseAgent(agentId: AgentId): Promise<void> {
    const res = await fetch(this.url(`/api/agents/${encodeURIComponent(agentId)}/pause`), {
      method: 'POST',
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async resumeAgent(agentId: AgentId, prompt?: string): Promise<void> {
    const res = await fetch(this.url(`/api/agents/${encodeURIComponent(agentId)}/resume`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt ?? '' }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async deleteAgent(agentId: AgentId): Promise<void> {
    const res = await fetch(this.url(`/api/agents/${encodeURIComponent(agentId)}`), {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async *stream(agentId: AgentId): AsyncIterable<StreamEnvelope> {
    const res = await fetch(this.url(`/api/agents/${encodeURIComponent(agentId)}/stream`));
    if (!res.ok) throw new Error(await res.text());
    const body = res.body;
    if (!body) return;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = line.slice(6).trim();
            if (json) {
              try {
                yield JSON.parse(json) as StreamEnvelope;
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async sendInput(agentId: AgentId, input: string): Promise<void> {
    const res = await fetch(this.url(`/api/agents/${encodeURIComponent(agentId)}/input`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) throw new Error(await res.text());
  }
}
