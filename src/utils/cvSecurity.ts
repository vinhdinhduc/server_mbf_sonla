import path from 'path';

export function isWithinCvDirectory(directory: string, target: string) {
  const relative = path.relative(directory, target);
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/** Structural inspection only; rejects active PDF content, macros and unsafe ZIP entries. */
export function isSafeCvContent(buffer: Buffer, filename: string): boolean {
  if (/\.pdf$/i.test(filename)) {
    return (
      buffer.subarray(0, 5).toString('ascii') === '%PDF-' &&
      !/\/(?:JavaScript|OpenAction|Launch|EmbeddedFile)\b|\/JS\s/i.test(buffer.toString('latin1'))
    );
  }
  if (!/\.docx$/i.test(filename) || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50)
    return false;
  // Inspect the central directory without expanding any archive data.
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (
      buffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0)
    return false;
  const count = buffer.readUInt16LE(end + 10);
  const size = buffer.readUInt32LE(end + 12);
  const start = buffer.readUInt32LE(end + 16);
  if (count < 2 || count > 2000 || start + size !== end) return false;
  const names = new Set<string>();
  let offset = start;
  let expanded = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return false;
    const flags = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const entrySize =
      46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
    if (
      offset + entrySize > end ||
      (flags & 1) !== 0 ||
      uncompressed > 25 * 1024 * 1024 ||
      (uncompressed > 1024 * 1024 && uncompressed > compressed * 200)
    )
      return false;
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8')
      .replace(/\\/g, '/');
    if (
      !name ||
      name.startsWith('/') ||
      name.includes(':') ||
      name.split('/').includes('..') ||
      /vbaProject|\.(exe|dll|js|vbs|bat|cmd|ps1)$/i.test(name) ||
      names.has(name)
    )
      return false;
    names.add(name);
    expanded += uncompressed;
    if (expanded > 25 * 1024 * 1024) return false;
    offset += entrySize;
  }
  return offset === end && names.has('[Content_Types].xml') && names.has('word/document.xml');
}
