import type { ChildProcess } from 'node:child_process';
import type { HttpCloveApi } from '../httpCloveApi.js';

/** Set by stream command so SIGINT can leave the stream without killing the shell. */
export type StreamInterruptRef = { current: (() => void) | null };

/** Shared context for every CLI command handler. */
export interface CliRuntime {
  api: HttpCloveApi;
  daemonBaseUrl: string;
  /** When true, dashboard runs in foreground and process should exit on fatal errors. */
  singleShot: boolean;
  streamInterruptRef?: StreamInterruptRef;
  dashboardChildRef?: { current: ChildProcess | null };
}
