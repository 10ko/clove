import type { CliRuntime } from '../types.js';
import type { CommandHelp } from '../command-help-types.js';

const STREAM_IDLE_MS = 3000;

export const commandHelp: CommandHelp = {
  names: ['stream'],
  summary: 'Stream logs and agent output',
  shellLine: 'stream <agent-id>                       Stream agent output (Ctrl+C to exit stream)',
};

export async function runStream(rest: string[], ctx: CliRuntime): Promise<boolean> {
  const agentId = rest[0];
  if (!agentId) {
    console.error('stream requires <agent-id>');
    return false;
  }
  const stream = ctx.api.stream(agentId);
  const it = stream[Symbol.asyncIterator]();
  let idleTimeout: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  let interrupted = false;
  const nextWithTimeout = (): Promise<IteratorResult<{ payload: string }>> =>
    new Promise((resolve, reject) => {
      idleTimeout = setTimeout(() => {
        timedOut = true;
        resolve({ value: undefined, done: true });
      }, STREAM_IDLE_MS);
      it.next().then(
        (result) => {
          if (idleTimeout) clearTimeout(idleTimeout);
          resolve(result);
        },
        reject
      );
    });
  const interruptPromise = new Promise<IteratorResult<{ payload: string }>>((resolve) => {
    if (ctx.streamInterruptRef) {
      ctx.streamInterruptRef.current = () => {
        interrupted = true;
        resolve({ value: undefined, done: true });
      };
    }
  });
  try {
    while (true) {
      const result = await (ctx.streamInterruptRef
        ? Promise.race([nextWithTimeout(), interruptPromise])
        : nextWithTimeout());
      if (result.done) break;
      if (result.value?.payload) process.stdout.write(result.value.payload);
    }
    if (interrupted) {
      console.log('\n(Ctrl+C — left stream; agent still running)');
    } else if (timedOut) {
      console.log('\n(no new output for 3s — agent still running; run "stream <id>" again to see more)');
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
  } finally {
    if (ctx.streamInterruptRef) ctx.streamInterruptRef.current = null;
  }
  return false;
}
