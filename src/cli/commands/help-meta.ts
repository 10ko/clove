import type { CommandHelp } from '../command-help-types.js';

export const commandHelp: CommandHelp = {
  names: ['help'],
  summary: 'Show this help',
  shellLine: 'help                                    Show help',
  examples: [
    '  clove                                     # interactive shell (starts daemon if needed)',
  ],
};
