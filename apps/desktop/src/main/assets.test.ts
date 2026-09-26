import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteAssets, listAssets } from './assets.js';

/**
 * The asset manager reads image dimensions by parsing headers rather than
 * pulling in an image library. Each format encodes them differently — and two
 * of them little-endian, offset by one — so the fixtures below are minimal but
 * real headers, built byte by byte.
 */

let root: string;
let assetsDir: string;

function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function gif(width: number, height: number): Buffer {
  const b = Buffer.alloc(13);
  b.write('GIF89a', 0, 'ascii');
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

function jpeg(width: number, height: number): Buffer {
  const b = Buffer.alloc(4 + 20 + 11);
  b.writeUInt16BE(0xffd8, 0);
  // An APP0 segment first, so the scanner has to skip something to find SOF0.
  b.writeUInt16BE(0xffe0, 2);
  b.writeUInt16BE(18, 4);
  let at = 4 + 18;
  b.writeUInt16BE(0xffc0, at);
  b.writeUInt16BE(11, at + 2);
  b.writeUInt8(8, at + 4);
  b.writeUInt16BE(height, at + 5);
  b.writeUInt16BE(width, at + 7);
  return b;
}

function webpLossy(width: number, height: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8 ', 12, 'ascii');
  b.writeUInt16LE(width, 26);
  b.writeUInt16LE(height, 28);
  return b;
}

/** VP8X stores each dimension as a 24-bit little-endian value, minus one. */
function webpExtended(width: number, height: number): Buffer {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.write('WEBP', 8, 'ascii');
  b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(width - 1, 24, 3);
  b.writeUIntLE(height - 1, 27, 3);
  return b;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'raporgo-assets-'));
  assetsDir = join(root, 'image_Assets');
  await writeFile(join(root, 'rapor.json'), '{}');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(assetsDir, { recursive: true }));

  await writeFile(join(assetsDir, 'panel.png'), png(1440, 900));
  await writeFile(join(assetsDir, 'akis.gif'), gif(320, 240));
  await writeFile(join(assetsDir, 'foto.jpg'), jpeg(4032, 3024));
  await writeFile(join(assetsDir, 'lossy.webp'), webpLossy(800, 600));
  await writeFile(join(assetsDir, 'ext.webp'), webpExtended(1920, 1080));
  await writeFile(join(assetsDir, 'logo.svg'), '<svg viewBox="0 0 120 48" xmlns="http://www.w3.org/2000/svg"></svg>');
  await writeFile(join(assetsDir, 'notlar.txt'), 'not an image');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('listAssets', () => {
  it('reads dimensions out of every supported format', async () => {
    const assets = await listAssets(root);
    const byName = new Map(assets.map((asset) => [asset.name, asset]));

    expect(byName.get('panel.png')).toMatchObject({ width: 1440, height: 900 });
    expect(byName.get('akis.gif')).toMatchObject({ width: 320, height: 240 });
    expect(byName.get('foto.jpg')).toMatchObject({ width: 4032, height: 3024 });
    expect(byName.get('lossy.webp')).toMatchObject({ width: 800, height: 600 });
    expect(byName.get('ext.webp')).toMatchObject({ width: 1920, height: 1080 });
    expect(byName.get('logo.svg')).toMatchObject({ width: 120, height: 48 });
  });

  it('reports the path a document would reference and the file size', async () => {
    const asset = (await listAssets(root)).find((item) => item.name === 'panel.png')!;
    expect(asset.src).toBe('image_Assets/panel.png');
    expect(asset.bytes).toBe(24);
  });

  it('ignores files that are not images', async () => {
    const names = (await listAssets(root)).map((asset) => asset.name);
    expect(names).not.toContain('notlar.txt');
  });

  it('returns nothing rather than throwing when there is no assets folder', async () => {
    expect(await listAssets(join(root, 'yok'))).toEqual([]);
  });
});

describe('deleteAssets', () => {
  it('refuses a path that escapes the assets folder', async () => {
    expect(await deleteAssets(root, ['../rapor.json', 'image_Assets/../rapor.json', 'assets/panel.png', '/etc/passwd'])).toEqual([]);
    // The document it tried to reach is still there.
    expect((await listAssets(root)).length).toBeGreaterThan(0);
  });

  it('deletes the assets it is given and reports them', async () => {
    const removed = await deleteAssets(root, ['image_Assets/akis.gif']);
    expect(removed).toEqual(['image_Assets/akis.gif']);
    expect((await listAssets(root)).map((asset) => asset.name)).not.toContain('akis.gif');
  });
});
