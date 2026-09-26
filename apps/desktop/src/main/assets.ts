import { copyFile, mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { IMAGE_FOLDER } from '@raporgo/core';

/**
 * Reads the image folder beside the report for the asset manager.
 *
 * Dimensions come from parsing image headers directly rather than pulling in
 * an image library: the manager only needs width and height, and every format
 * the editor accepts carries them in the first few dozen bytes.
 */

export type AssetInfo = {
  /** File name, e.g. `panel.png`. */
  name: string;
  /** Path relative to the document, as it would appear in `image.src`. */
  src: string;
  /** Absolute path, for the renderer to load as a file:// URL. */
  path: string;
  bytes: number;
  width?: number;
  height?: number;
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

export async function listAssets(docDir: string): Promise<AssetInfo[]> {
  const assetsDir = join(docDir, IMAGE_FOLDER);

  let names: string[];
  try {
    names = await readdir(assetsDir);
  } catch {
    return []; // No assets folder yet — an empty manager, not an error.
  }

  const assets: AssetInfo[] = [];
  for (const name of names.sort()) {
    if (!IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) continue;
    const path = join(assetsDir, name);

    let info;
    try {
      info = await stat(path);
    } catch {
      continue;
    }
    if (!info.isFile()) continue;

    const asset: AssetInfo = { name, src: `${IMAGE_FOLDER}/${name}`, path, bytes: info.size };
    const size = await imageSize(path);
    if (size) {
      asset.width = size.width;
      asset.height = size.height;
    }
    assets.push(asset);
  }
  return assets;
}

/** Deletes assets by their document-relative path. Refuses anything outside the image folder. */
export async function deleteAssets(docDir: string, sources: string[]): Promise<string[]> {
  const removed: string[] = [];
  for (const src of sources) {
    const inImages = src.startsWith(`${IMAGE_FOLDER}/`) && !/[/\\]/.test(src.slice(IMAGE_FOLDER.length + 1));
    if (!inImages) continue;
    try {
      await unlink(join(docDir, src));
      removed.push(src);
    } catch {
      // Already gone is the desired end state either way.
    }
  }
  return removed;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies `source` into the given project folder under a name that does not
 * collide with anything already there, and returns the document-relative
 * path. Never overwrites a file the report might reference.
 */
export async function copyIntoProject(dir: string, folder: string, source: string): Promise<string> {
  const target = join(dir, folder);
  await mkdir(target, { recursive: true });
  const name = basename(source);
  let destination = join(target, name);
  for (let n = 2; await exists(destination); n += 1) {
    destination = join(target, `${basename(name, extname(name))}-${n}${extname(name)}`);
  }
  await copyFile(source, destination);
  return `${folder}/${basename(destination)}`;
}

// --- Header parsing ---------------------------------------------------------

type Size = { width: number; height: number };

/** Enough of each format's header to find the dimensions. */
const HEADER_BYTES = 64 * 1024;

async function imageSize(path: string): Promise<Size | undefined> {
  let head: Buffer;
  try {
    // SVG has no fixed header; reading the whole (small) file is fine, and for
    // raster formats this is capped by the slice below.
    head = (await readFile(path)).subarray(0, HEADER_BYTES);
  } catch {
    return undefined;
  }

  return pngSize(head) ?? gifSize(head) ?? webpSize(head) ?? jpegSize(head) ?? svgSize(head);
}

function pngSize(b: Buffer): Size | undefined {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return undefined;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function gifSize(b: Buffer): Size | undefined {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'GIF') return undefined;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function webpSize(b: Buffer): Size | undefined {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  const chunk = b.toString('ascii', 12, 16);

  if (chunk === 'VP8X') {
    // 24-bit little-endian, stored as size - 1.
    const width = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16));
    const height = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16));
    return { width, height };
  }
  if (chunk === 'VP8 ') {
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return undefined;
}

/** Frame markers that carry the image dimensions; DHT/DAC/RST are skipped. */
const JPEG_SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegSize(b: Buffer): Size | undefined {
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return undefined;

  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1]!;
    if (JPEG_SOF.has(marker)) {
      return { height: b.readUInt16BE(offset + 5), width: b.readUInt16BE(offset + 7) };
    }
    offset += 2 + b.readUInt16BE(offset + 2);
  }
  return undefined;
}

function svgSize(b: Buffer): Size | undefined {
  const text = b.toString('utf8', 0, Math.min(b.length, 2048));
  if (!/<svg[\s>]/i.test(text)) return undefined;

  const viewBox = /viewBox\s*=\s*"[\d.\-\s]*?([\d.]+)[\s,]+([\d.]+)\s*"/i.exec(text);
  if (viewBox) return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) };

  const width = /\bwidth\s*=\s*"(\d+)/i.exec(text);
  const height = /\bheight\s*=\s*"(\d+)/i.exec(text);
  if (width && height) return { width: Number(width[1]), height: Number(height[1]) };
  return undefined;
}
