import { closeSync, fstatSync, openSync, readSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const READ_CHUNK = 8 * 1024 * 1024;

export function listTranscripts(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

export function readFrom(path, offset, max = READ_CHUNK) {
  const fd = openSync(path, "r");
  try {
    const { size } = fstatSync(fd);
    const start = size < offset ? 0 : offset;
    const len = Math.min(size - start, max);
    const buf = Buffer.alloc(len);
    if (len > 0) readSync(fd, buf, 0, len, start);
    return { buf, start };
  } finally {
    closeSync(fd);
  }
}
