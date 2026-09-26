import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDocument } from '@raporgo/core';
import { measureLayout } from '../src/measure.js';

/**
 * Regenerates the layout baseline the fidelity test compares against. Run this
 * after a deliberate template change, then review the diff — an unexpected
 * line in it means the change moved something you did not intend to move.
 */
const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, '../../../examples/showcase/en/q3-operations-report.json');
const baselinePath = resolve(here, '../test/fixtures/showcase-layout.json');

const { doc, dir } = await readDocument(examplePath);
const boxes = await measureLayout(doc, { docDir: dir });

await mkdir(dirname(baselinePath), { recursive: true });
await writeFile(baselinePath, `${JSON.stringify(boxes, null, 2)}\n`, 'utf8');
console.log(`wrote ${baselinePath} (${boxes.length} segments)`);
