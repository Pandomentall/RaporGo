import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readDocument } from '@raporgo/core';
import { chromium, type Browser } from 'playwright';
import { measureLayout, type LayoutBox } from '../src/measure.js';

/**
 * A template drifts one innocent CSS edit at a time. This pins the showcase
 * report's layout down against a committed baseline of every segment box, so
 * a change that moves something shows up as a named segment and a distance.
 */

const here = dirname(fileURLToPath(import.meta.url));
const examplePath = resolve(here, '../../../examples/showcase/en/q3-operations-report.json');
const baselinePath = resolve(here, 'fixtures/showcase-layout.json');

let browser: Browser;
let boxes: LayoutBox[];

beforeAll(async () => {
  browser = await chromium.launch();
  const { doc, dir } = await readDocument(examplePath);
  boxes = await measureLayout(doc, { docDir: dir, browser });
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

describe('layout baseline', () => {
  /**
   * Two CSS pixels. Layout is deterministic given a pinned Chromium and fonts
   * that ship with the package, but leaving a hair of room keeps the suite
   * from flaking across operating systems while still catching real drift,
   * which shows up as several points at minimum.
   */
  const DRIFT_TOLERANCE = 1.5;

  it('matches the committed baseline for every segment', async () => {
    const baseline: LayoutBox[] = JSON.parse(await readFile(baselinePath, 'utf8'));

    expect(boxes.map((b) => b.id)).toEqual(baseline.map((b) => b.id));

    const drifted = boxes
      .map((actual, index) => ({ actual, expected: baseline[index]! }))
      .filter(({ actual, expected }) =>
        actual.page !== expected.page ||
        Math.abs(actual.x - expected.x) > DRIFT_TOLERANCE ||
        Math.abs(actual.y - expected.y) > DRIFT_TOLERANCE ||
        Math.abs(actual.width - expected.width) > DRIFT_TOLERANCE ||
        Math.abs(actual.height - expected.height) > DRIFT_TOLERANCE,
      )
      .map(({ actual, expected }) => `${actual.id}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);

    expect(drifted).toEqual([]);
  });
});
