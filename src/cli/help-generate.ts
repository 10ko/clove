import type { CommandHelp } from './command-help-types.js';
import { commandHelp as startHelp } from './commands/start.js';
import { commandHelp as stopHelp } from './commands/stop.js';
import { commandHelp as resumeHelp } from './commands/resume.js';
import { commandHelp as deleteHelp } from './commands/delete.js';
import { commandHelp as streamHelp } from './commands/stream.js';
import { commandHelp as sendInputHelp } from './commands/send-input.js';
import { commandHelp as listHelp } from './commands/list.js';
import { commandHelp as dashboardHelp } from './commands/dashboard-cmd.js';
import { commandHelp as helpMeta } from './commands/help-meta.js';
import { commandHelp as exitHelp } from './commands/exit.js';
import { daemonCommandHelp } from './daemon-help.js';

const HELP_TITLE = 'clove – orchestrate multiple AI coding agents';

const USAGE_LINES = [
  'USAGE',
  '  clove                    Start interactive shell (connects to daemon)',
  '  clove [COMMAND] ...      Run a single command against the daemon',
  '',
  'COMMANDS',
] as const;

const OPTIONS_SECTION = ['', 'OPTIONS', '  -h, --help  Show this help', ''] as const;

/** Which commands contribute example lines, and in what order (edit each command’s `examples` array). */
const EXAMPLES_ORDER: readonly CommandHelp[] = [
  helpMeta,
  startHelp,
  listHelp,
  stopHelp,
  resumeHelp,
  deleteHelp,
  dashboardHelp,
  daemonCommandHelp,
];

/** Order of commands in generated full help. */
const FULL_HELP_COMMANDS: readonly CommandHelp[] = [
  startHelp,
  stopHelp,
  resumeHelp,
  deleteHelp,
  streamHelp,
  sendInputHelp,
  listHelp,
  dashboardHelp,
  daemonCommandHelp,
  helpMeta,
  exitHelp,
];

/** Order of lines in interactive shell help. */
const SHELL_HELP_ORDER: readonly CommandHelp[] = [
  startHelp,
  listHelp,
  streamHelp,
  sendInputHelp,
  stopHelp,
  resumeHelp,
  deleteHelp,
  dashboardHelp,
  helpMeta,
  exitHelp,
];

function commandLabel(block: CommandHelp): string {
  return block.names.join(', ');
}

function formatCommandsSection(blocks: readonly CommandHelp[]): string[] {
  const labels = blocks.map(commandLabel);
  const colWidth = Math.max(10, ...labels.map((l) => l.length));
  const lines: string[] = [];
  for (const block of blocks) {
    const label = commandLabel(block);
    const gap = ' '.repeat(Math.max(1, colWidth - label.length + 2));
    lines.push(`  ${label}${gap}${block.summary}`);
    for (const extra of block.additionalLines ?? []) {
      lines.push(extra);
    }
  }
  return lines;
}

function normalizeShellLine(line: string): string {
  const t = line.trimStart();
  return t ? `  ${t}` : '';
}

function formatExamplesSection(blocks: readonly CommandHelp[]): string[] {
  const lines: string[] = ['', 'EXAMPLES'];
  for (const block of blocks) {
    for (const ex of block.examples ?? []) {
      lines.push(ex.startsWith('  ') ? ex : `  ${ex}`);
    }
  }
  return lines;
}

/** Full `clove --help` text. */
export function buildFullHelp(): string {
  const body = [
    HELP_TITLE,
    '',
    ...USAGE_LINES,
    ...formatCommandsSection(FULL_HELP_COMMANDS),
    ...OPTIONS_SECTION,
    ...formatExamplesSection(EXAMPLES_ORDER),
  ];
  return body.join('\n').trim();
}

/** Short text for the interactive `clove>` shell. */
export function buildShellHelp(): string {
  const lines: string[] = [];
  for (const block of SHELL_HELP_ORDER) {
    if (block.shellLine == null || block.shellLine === '') continue;
    lines.push(normalizeShellLine(block.shellLine));
  }
  return lines.join('\n').trim();
}
