import { parseArgs } from 'node:util';
import { RaporError } from '@raporgo/core';
import {
  cmdGet,
  cmdInsert,
  cmdMeta,
  cmdMove,
  cmdNew,
  cmdOutline,
  cmdRemove,
  cmdRender,
  cmdSchema,
  cmdSegments,
  cmdSet,
  cmdTemplates,
  cmdTheme,
  cmdValidate,
  type Flags,
} from './commands.js';
import { fail, type OutputMode } from './output.js';

type Command = (args: string[], flags: Flags, mode: OutputMode) => void | Promise<void>;

const COMMANDS: Record<string, { run: Command; usage: string; blurb: string }> = {
  new: { run: cmdNew, usage: 'new <file> [--template <name>] [--title <t>] [--subtitle <s>]', blurb: 'Create an empty report' },
  outline: { run: cmdOutline, usage: 'outline <file>', blurb: 'List segment ids, types and summaries' },
  get: { run: cmdGet, usage: 'get <file> <segmentId>', blurb: 'Print one segment as JSON' },
  set: { run: cmdSet, usage: "set <file> <segmentId> --data '{...}' [--replace]", blurb: 'Merge (or replace) a segment' },
  insert: { run: cmdInsert, usage: "insert <file> --data '{...}' [--after <id>|--before <id>|--index <n>]", blurb: 'Add a segment' },
  move: { run: cmdMove, usage: 'move <file> <segmentId> [--after <id>|--before <id>|--index <n>]', blurb: 'Reorder a segment' },
  remove: { run: cmdRemove, usage: 'remove <file> <segmentId>', blurb: 'Delete a segment' },
  meta: { run: cmdMeta, usage: "meta <file> [--data '{...}']", blurb: 'Read or edit title, date, headers' },
  theme: { run: cmdTheme, usage: 'theme <file> [--template <name>] [--preset <name>]', blurb: 'Switch template or palette' },
  validate: { run: cmdValidate, usage: 'validate <file>', blurb: 'Check the schema and referenced assets' },
  render: { run: cmdRender, usage: 'render <file> [-o out.pdf] [--html out.html]', blurb: 'Render to PDF (or HTML)' },
  schema: { run: cmdSchema, usage: 'schema', blurb: 'Print the JSON Schema for a document' },
  templates: { run: cmdTemplates, usage: 'templates', blurb: 'List available templates' },
  segments: { run: cmdSegments, usage: 'segments', blurb: 'List available segment types' },
};

function help(): string {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  const lines = Object.entries(COMMANDS).map(([name, command]) => `  ${name.padEnd(width)}  ${command.blurb}`);
  return [
    'raporgo — segment-based PDF reports that an LLM can read and edit',
    '',
    'Usage: raporgo <command> [args] [--json]',
    '',
    'Commands:',
    ...lines,
    '',
    'Every command accepts --json for machine-readable output on stdout and',
    'structured errors on stderr. See docs/LLM.md for the full contract.',
    '',
    'Run "raporgo help <command>" for one command\'s arguments.',
  ].join('\n');
}

/** One command's argument list. The blurb says what it does; this says how to call it. */
function commandHelp(name: string): string | null {
  const command = COMMANDS[name];
  return command ? `${command.blurb}\n\nUsage: raporgo ${command.usage}` : null;
}

export async function run(argv: string[]): Promise<void> {
  const [name, ...rest] = argv;

  if (!name || name === 'help' || name === '--help' || name === '-h') {
    const topic = rest.find((arg) => !arg.startsWith('-'));
    process.stdout.write(`${(topic && commandHelp(topic)) ?? help()}\n`);
    return;
  }
  if (name === '--version' || name === '-v') {
    process.stdout.write('raporgo 0.1.0\n');
    return;
  }

  const command = COMMANDS[name];
  const mode: OutputMode = { json: rest.includes('--json') };

  if (!command) {
    fail(mode, new RaporError(`Unknown command "${name}". Run "raporgo help".`, 'COMMAND_UNKNOWN'));
  }

  try {
    const { positionals, values } = parseArgs({
      args: rest,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean' },
        data: { type: 'string' },
        out: { type: 'string', short: 'o' },
        html: { type: 'string' },
        after: { type: 'string' },
        before: { type: 'string' },
        index: { type: 'string' },
        template: { type: 'string' },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        eyebrow: { type: 'string' },
        date: { type: 'string' },
        preset: { type: 'string' },
        replace: { type: 'boolean' },
      },
    });

    await command.run(positionals, values as Flags, { json: values['json'] === true });
  } catch (error) {
    fail(mode, error);
  }
}
