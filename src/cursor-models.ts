/**
 * Curated model ids for `agent --model <id>` (ACP child process).
 * Run `agent models` locally to refresh this list when Cursor adds or renames models.
 */
export interface CursorModelOption {
  readonly value: string;
  readonly label: string;
}

export const CURSOR_MODEL_OPTIONS: readonly CursorModelOption[] = [
  { value: '', label: 'Default (Cursor picks)' },
  { value: 'auto', label: 'Auto' },
  { value: 'composer-1', label: 'Composer 1' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.2-high', label: 'GPT-5.2 High' },
  { value: 'sonnet-4.5', label: 'Claude Sonnet 4.5' },
  // Opus — short `opus-*` slugs plus `claude-*-opus-*` names seen in Cursor CLI; run `agent models` to confirm yours.
  { value: 'opus-4', label: 'Claude Opus 4' },
  { value: 'opus-4-thinking', label: 'Claude Opus 4 (thinking)' },
  { value: 'opus-4.5', label: 'Claude Opus 4.5' },
  { value: 'opus-4.5-thinking', label: 'Claude Opus 4.5 (thinking)' },
  { value: 'opus-4.6', label: 'Claude Opus 4.6' },
  { value: 'opus-4.6-thinking', label: 'Claude Opus 4.6 (thinking)' },
  { value: 'claude-4.5-opus-high', label: 'Claude 4.5 Opus high' },
  { value: 'claude-4.5-opus-high-thinking', label: 'Claude 4.5 Opus high (thinking)' },
  { value: 'claude-4.6-opus-high', label: 'Claude 4.6 Opus high' },
  { value: 'claude-4.6-opus-high-thinking', label: 'Claude 4.6 Opus high (thinking)' },
  { value: 'claude-4.6-opus-max', label: 'Claude 4.6 Opus max' },
  { value: 'claude-4.6-opus-max-thinking', label: 'Claude 4.6 Opus max (thinking)' },
  // Opus / Sonnet — ~1M context variants (Cursor often uses a `-1m` suffix; Max mode / plan may still apply).
  { value: 'opus-4.5-1m', label: 'Claude Opus 4.5 (1M)' },
  { value: 'opus-4.5-thinking-1m', label: 'Claude Opus 4.5 thinking (1M)' },
  { value: 'opus-4.6-1m', label: 'Claude Opus 4.6 (1M)' },
  { value: 'opus-4.6-thinking-1m', label: 'Claude Opus 4.6 thinking (1M)' },
  { value: 'claude-4.5-opus-high-1m', label: 'Claude 4.5 Opus high (1M)' },
  { value: 'claude-4.5-opus-high-thinking-1m', label: 'Claude 4.5 Opus high thinking (1M)' },
  { value: 'claude-4.6-opus-high-1m', label: 'Claude 4.6 Opus high (1M)' },
  { value: 'claude-4.6-opus-high-thinking-1m', label: 'Claude 4.6 Opus high thinking (1M)' },
  { value: 'claude-4.6-opus-max-1m', label: 'Claude 4.6 Opus max (1M)' },
  { value: 'claude-4.6-opus-max-thinking-1m', label: 'Claude 4.6 Opus max thinking (1M)' },
  { value: 'sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'sonnet-4.6-thinking', label: 'Claude Sonnet 4.6 (thinking)' },
  { value: 'sonnet-4.6-1m', label: 'Claude Sonnet 4.6 (1M)' },
  { value: 'sonnet-4.6-thinking-1m', label: 'Claude Sonnet 4.6 thinking (1M)' },
  { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
] as const;

const curated = new Set(
  CURSOR_MODEL_OPTIONS.map((o) => o.value).filter((v) => v !== ''),
);

/** Slugs outside the curated list (e.g. from `clove start --model`): safe subset for HTTP. */
const ADHOC_MODEL = /^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/;

/** HTTP/API: curated id, empty (default), or a short alphanumeric slug (matches CLI flexibility). */
export function isAllowedCursorModelForHttp(model: unknown): boolean {
  if (model == null || model === '') return true;
  if (typeof model !== 'string') return false;
  const t = model.trim();
  if (t === '') return true;
  return curated.has(t) || ADHOC_MODEL.test(t);
}

export function normalizeCursorModel(model: unknown): string | undefined {
  if (model == null || typeof model !== 'string') return undefined;
  const t = model.trim();
  return t === '' ? undefined : t;
}
