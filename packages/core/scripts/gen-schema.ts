import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_VERSION, toJsonSchema } from '../src/schema.js';

/** Emits the published JSON Schema that LLMs read to learn the document format. */
const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../../../schema', `rapor-${SCHEMA_VERSION}.json`);

const jsonSchema = toJsonSchema();
const document = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://raporgo.dev/schema/rapor-${SCHEMA_VERSION}.json`,
  title: 'RaporGo document',
  description:
    'A RaporGo report: metadata, a theme and an ordered list of segments. ' +
    'The file is the single source of truth — the desktop editor, the raporgo CLI ' +
    'and any LLM all read and write this same document.',
  ...jsonSchema,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`wrote ${outPath}`);
