/**
 * Per-command help: edit these objects next to each command implementation.
 * `buildFullHelp` / `buildShellHelp` assemble the strings at runtime.
 */
export interface CommandHelp {
  /** Aliases; first is used for padding alignment with other commands. */
  readonly names: readonly string[];
  /** One-line description in the full `clove --help` COMMANDS section. */
  readonly summary: string;
  /**
   * Extra lines printed after the main COMMANDS line (e.g. `daemon` subcommands).
   * Include leading indentation as you want them printed (typically two spaces).
   */
  readonly additionalLines?: readonly string[];
  /**
   * Line for interactive shell `help` (leading `  ` is added if missing).
   * Omit for commands that should not appear in shell help.
   */
  readonly shellLine?: string;
  /**
   * Lines under the full-help **EXAMPLES** section for this command.
   * Use the same indentation you want printed (typically two leading spaces).
   */
  readonly examples?: readonly string[];
}
