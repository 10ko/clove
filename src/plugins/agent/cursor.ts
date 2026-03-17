/**
 * Cursor agent plugin: runs the Cursor CLI via ACP (Agent Client Protocol) for
 * session-based interaction and reliable follow-up input.
 * See https://cursor.com/docs/cli/acp and https://agentclientprotocol.com/
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentContext, AgentId, AgentPlugin, StreamEnvelope } from '../../types.js';

export interface CursorAgentOptions {
  /** Command to run (default: 'agent'). Use full path if not in PATH. */
  command?: string;
  /** Extra args passed to the CLI before 'acp' (e.g. --trust, --model). */
  extraArgs?: string[];
  /** If true, use one-shot -p mode instead of ACP (no follow-up input). Default: false. */
  nonInteractive?: boolean;
}

const CURSOR_INSTALL_HINT =
  'Install with: curl https://cursor.com/install -fsS | bash (see https://cursor.com/docs/cli/overview)';

/** ACP session handle for follow-up prompts. */
interface AcpSession {
  sessionId: string;
  sendPrompt: (text: string) => Promise<void>;
  /** Cancel current prompt turn (sends session/cancel). */
  cancel?: () => void;
  /** Push a line into the stream (e.g. "[Follow-up sent.]") for user feedback. */
  pushFeedback?: (line: string) => void;
  /** Push user message into the stream (shown right-aligned in UI). */
  pushUserMessage?: (payload: string) => void;
}

function isCursorCliInstalled(command: string): boolean {
  const r = spawnSync(command, ['--version'], {
    stdio: 'pipe',
    timeout: 5000,
  });
  return r.status === 0;
}

function resolveCommandToPath(cmd: string): string {
  if (path.isAbsolute(cmd) || cmd.includes(path.sep)) return cmd;
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const r = spawnSync(which, [cmd], { encoding: 'utf-8', timeout: 5000 });
    const first = r.stdout?.split(/\r?\n/)[0]?.trim();
    return first || cmd;
  } catch {
    return cmd;
  }
}

/** Run Cursor in ACP mode: JSON-RPC over stdio, session/new + session/prompt, stream session/update. */
function runCursorStreamAcp(
  prompt: string,
  context: AgentContext,
  options: CursorAgentOptions,
  acpSessionByAgent: Map<AgentId, AcpSession>
): AsyncIterable<StreamEnvelope> {
  const command = options.command ?? 'agent';
  const extraArgs = options.extraArgs ?? [];
  const agentId = context.agentId;
  const resolvedCommand = resolveCommandToPath(command);
  const acpArgs = ['--trust', ...extraArgs, 'acp'];

  return {
    async *[Symbol.asyncIterator]() {
      if (!isCursorCliInstalled(command)) {
        throw new Error(
          `Cursor CLI not found (command: ${command}). ${CURSOR_INSTALL_HINT}`
        );
      }

      const child = spawn(resolvedCommand, acpArgs, {
        cwd: context.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      try {
      const queue: StreamEnvelope[] = [];
      let ended = false;
      let resolveWait: (() => void) | null = null;
      const waitNext = (): Promise<void> =>
        new Promise((resolve) => {
          if (queue.length > 0 || ended) return void resolve();
          resolveWait = resolve;
        });
      const push = (envelope: StreamEnvelope): void => {
        if (!envelope.payload) return;
        queue.push(envelope);
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      };

      const cleanup = (exitCode?: number): void => {
        acpSessionByAgent.delete(agentId);
        push({ type: 'log', payload: '\n[ACP process exited' + (exitCode != null ? ` with code ${exitCode}` : '') + '.]\n' });
        ended = true;
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      };
      child.once('exit', (code) => cleanup(code ?? undefined));

      context.abortSignal?.addEventListener('abort', () => {
        ended = true;
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      });

      let nextId = 1;
      const pending = new Map<
        number,
        { resolve: (v: unknown) => void; reject: (e: Error) => void }
      >();

      const writeStdin = (msg: object): void => {
        if (child.stdin?.writable) {
          child.stdin.write(JSON.stringify(msg) + '\n');
        }
      };

      const send = (method: string, params?: object): Promise<unknown> => {
        const id = nextId++;
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          writeStdin({ jsonrpc: '2.0', id, method, params: params ?? {} });
        });
      };

      const respond = (id: number, result: object): void => {
        writeStdin({ jsonrpc: '2.0', id, result });
      };

      let stdoutBuffer = '';
      child.stdout?.on('data', (data: Buffer | string) => {
        const s = typeof data === 'string' ? data : data.toString();
        stdoutBuffer += s;
        const lines = stdoutBuffer.split(/\r?\n/);
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as {
              id?: number;
              method?: string;
              params?: { update?: { sessionUpdate?: string; content?: { text?: string }; text?: string } };
              result?: unknown;
              error?: { message?: string };
            };
            if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
              const waiter = pending.get(msg.id);
              if (waiter) {
                pending.delete(msg.id);
                if (msg.error) {
                  waiter.reject(new Error(msg.error.message ?? String(msg.error)));
                } else {
                  waiter.resolve(msg.result);
                }
              }
              continue;
            }
            if (msg.method === 'session/update') {
              const update = msg.params?.update as { sessionUpdate?: string; content?: { text?: string }; text?: string } | undefined;
              const text = update?.content?.text ?? update?.text;
              if (typeof text === 'string') {
                const kind = update?.sessionUpdate === 'agent_thought_chunk' ? 'reasoning' : 'agent';
                push({ type: kind, payload: text });
              } else if (update?.sessionUpdate === 'agent_message_chunk' && update?.content?.text) {
                push({ type: 'agent', payload: update.content.text });
              } else if (update?.sessionUpdate === 'agent_thought_chunk' && update?.content?.text) {
                push({ type: 'reasoning', payload: update.content.text });
              }
              continue;
            }
            if (msg.method === 'session/request_permission' && msg.id !== undefined) {
              respond(msg.id, { outcome: { outcome: 'selected', optionId: 'allow-once' } });
              continue;
            }
            if (msg.method === 'fs/write_text_file' && msg.id !== undefined) {
              const params = (msg as { params?: { path?: string; content?: string } }).params;
              handleFsWrite(msg.id, params ?? {}).catch((err) => {
                writeStdin({
                  jsonrpc: '2.0',
                  id: msg.id,
                  error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
                });
              });
              continue;
            }
            if (msg.method === 'fs/read_text_file' && msg.id !== undefined) {
              const params = (msg as { params?: { path?: string } }).params;
              handleFsRead(msg.id, params ?? {}).catch(() => {});
              continue;
            }
          } catch {
            push({ type: 'log', payload: line + '\n' });
          }
        }
      });

      child.stderr?.on('data', (data: Buffer | string) => {
        const s = typeof data === 'string' ? data : data.toString();
        push({ type: 'log', payload: '[stderr] ' + s });
      });

      const workspacePath = context.workspacePath;
      const resolveWorkspacePath = (p: string): string => {
        const resolved = path.isAbsolute(p)
          ? path.normalize(p)
          : path.join(workspacePath, p);
        const real = path.normalize(resolved);
        if (!real.startsWith(path.normalize(workspacePath) + path.sep) && real !== path.normalize(workspacePath)) {
          return path.join(workspacePath, path.basename(p));
        }
        return resolved;
      };

      const handleFsWrite = async (id: number, params: { path?: string; content?: string }): Promise<void> => {
        const filePath = resolveWorkspacePath(params.path ?? '');
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, params.content ?? '', 'utf-8');
        writeStdin({ jsonrpc: '2.0', id, result: null });
      };
      const handleFsRead = async (id: number, params: { path?: string }): Promise<void> => {
        try {
          const filePath = resolveWorkspacePath(params.path ?? '');
          const content = await fs.readFile(filePath, 'utf-8');
          writeStdin({ jsonrpc: '2.0', id, result: { content } });
        } catch (err) {
          writeStdin({
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
          });
        }
      };

      try {
        await send('initialize', {
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
            terminal: false,
          },
          clientInfo: { name: 'clove', version: '0.1.0' },
        });
        await send('authenticate', { methodId: 'cursor_login' });
        const result = await send('session/new', {
          cwd: context.workspacePath,
          mcpServers: [],
        }) as { sessionId?: string };
        const sessionId = result?.sessionId;
        if (!sessionId) {
          throw new Error('ACP session/new did not return sessionId');
        }

        const stateRef = context.agentStateRef;
        const sendPromptRaw = async (text: string): Promise<void> => {
          await send('session/prompt', {
            sessionId,
            prompt: [{ type: 'text', text }],
          });
        };
        const sendPrompt = async (text: string): Promise<void> => {
          if (stateRef) stateRef.current = 'busy';
          try {
            await sendPromptRaw(text);
          } finally {
            if (stateRef) stateRef.current = 'waiting';
          }
        };

        acpSessionByAgent.set(agentId, {
          sessionId,
          sendPrompt,
          cancel: () => {
            writeStdin({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId } });
          },
          pushFeedback: (line) => push({ type: 'agent', payload: line }),
          pushUserMessage: (payload) => push({ type: 'user', payload }),
        });
        if (stateRef) stateRef.current = 'busy';
        sendPrompt(prompt).catch(() => {});
      } catch (err) {
        cleanup();
        throw err;
      }

      while (queue.length > 0 || !ended) {
        await waitNext();
        while (queue.length > 0) {
          const envelope = queue.shift();
          if (envelope) yield envelope;
        }
      }
      } finally {
        console.log('[clove] cursor ACP generator: finally (abort or exit), killing child', agentId);
        try {
          child?.kill?.('SIGTERM');
        } catch {
          // ignore
        }
      }
    },
  };
}

/** One-shot -p mode (no ACP, no follow-up). */
function runCursorStreamNonInteractive(
  prompt: string,
  context: AgentContext,
  options: CursorAgentOptions
): AsyncIterable<StreamEnvelope> {
  const command = options.command ?? 'agent';
  const extraArgs = options.extraArgs ?? [];
  const resolvedCommand = resolveCommandToPath(command);
  const args = ['-p', prompt, '--output-format', 'text', ...extraArgs];

  return {
    async *[Symbol.asyncIterator]() {
      if (!isCursorCliInstalled(command)) {
        throw new Error(
          `Cursor CLI not found (command: ${command}). ${CURSOR_INSTALL_HINT}`
        );
      }

      const child = spawn(resolvedCommand, args, {
        cwd: context.workspacePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      const queue: StreamEnvelope[] = [];
      let ended = 0;
      let resolveWait: (() => void) | null = null;
      const waitNext = (): Promise<void> =>
        new Promise((resolve) => {
          if (queue.length > 0 || ended >= 2) return void resolve();
          resolveWait = resolve;
        });
      const push = (envelope: StreamEnvelope): void => {
        queue.push(envelope);
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      };

      child.stdout?.on('data', (c: Buffer | string) =>
        push({ type: 'agent', payload: typeof c === 'string' ? c : c.toString() })
      );
      child.stderr?.on('data', (c: Buffer | string) =>
        push({ type: 'log', payload: '[stderr] ' + (typeof c === 'string' ? c : c.toString()) })
      );
      const onEnd = (): void => {
        ended += 1;
        if (ended >= 2 && resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      };
      child.stdout?.once('end', onEnd);
      child.stderr?.once('end', onEnd);

      while (queue.length > 0 || ended < 2) {
        await waitNext();
        while (queue.length > 0) {
          const envelope = queue.shift();
          if (envelope) yield envelope;
        }
      }
    },
  };
}

function runCursorStream(
  prompt: string,
  context: AgentContext,
  options: CursorAgentOptions,
  acpSessionByAgent: Map<AgentId, AcpSession>
): AsyncIterable<StreamEnvelope> {
  if (options.nonInteractive) {
    return runCursorStreamNonInteractive(prompt, context, options);
  }
  return runCursorStreamAcp(prompt, context, options, acpSessionByAgent);
}

export function createCursorAgent(options: CursorAgentOptions = {}): AgentPlugin {
  const acpSessionByAgent = new Map<AgentId, AcpSession>();

  return {
    async run(prompt: string, context: AgentContext): Promise<string> {
      const parts: string[] = [];
      for await (const envelope of this.stream(prompt, context)) {
        parts.push(envelope.payload);
      }
      return parts.join('');
    },

    stream(prompt: string, context: AgentContext): AsyncIterable<StreamEnvelope> {
      return runCursorStream(prompt, context, options, acpSessionByAgent);
    },

    async handleInput(agentId: AgentId, input: string): Promise<void | string> {
      const session = acpSessionByAgent.get(agentId);
      if (!session) {
        console.error('[clove] send-input: no ACP session for', agentId, '(known:', [...acpSessionByAgent.keys()], ')');
        return '\n[No active session for this agent; it may have exited. Start a new agent.]\n';
      }
      session.pushUserMessage?.(input);
      try {
        await session.sendPrompt(input);
      } catch (err) {
        console.error('[clove] send-input ACP error:', err);
        return '\n[Failed to send follow-up: ' + (err instanceof Error ? err.message : String(err)) + ']\n';
      }
      return undefined;
    },

    async cancel(agentId: AgentId): Promise<void> {
      const session = acpSessionByAgent.get(agentId);
      if (session?.cancel) session.cancel();
    },
  };
}
