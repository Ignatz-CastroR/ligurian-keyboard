/*
 * zip.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:02:25, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Read the files inside a Keyman package [.kmp], which is a
 *           zip archive, so the tests can check what kmc put in it.
 * Contract: Test helper only. Handles what kmc writes: one archive, no
 *           encryption, entries stored [method 0] or deflated [method 8];
 *           anything else throws.
 */

import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY: number = 0x06054b50;
const CENTRAL_ENTRY: number = 0x02014b50;
const LOCAL_ENTRY: number = 0x04034b50;

export function readZip(archive: Buffer): Map<string, Buffer> {
  let end: number = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== END_OF_CENTRAL_DIRECTORY) {
    end -= 1;
  }
  if (end < 0) {
    throw new Error("not a zip archive: no end of central directory");
  }

  const count: number = archive.readUInt16LE(end + 10);
  let at: number = archive.readUInt32LE(end + 16);
  const files: Map<string, Buffer> = new Map();

  for (let i: number = 0; i < count; i += 1) {
    if (archive.readUInt32LE(at) !== CENTRAL_ENTRY) {
      throw new Error(`bad central directory entry at byte ${at}`);
    }
    const method: number = archive.readUInt16LE(at + 10);
    const compressedSize: number = archive.readUInt32LE(at + 20);
    const nameLength: number = archive.readUInt16LE(at + 28);
    const extraLength: number = archive.readUInt16LE(at + 30);
    const commentLength: number = archive.readUInt16LE(at + 32);
    const localAt: number = archive.readUInt32LE(at + 42);
    const name: string = archive.toString("utf8", at + 46, at + 46 + nameLength);

    if (archive.readUInt32LE(localAt) !== LOCAL_ENTRY) {
      throw new Error(`bad local header for ${name}`);
    }
    const dataAt: number = localAt + 30 + archive.readUInt16LE(localAt + 26) + archive.readUInt16LE(localAt + 28);
    const data: Buffer = archive.subarray(dataAt, dataAt + compressedSize);

    if (method === 0) {
      files.set(name, Buffer.from(data));
    } else if (method === 8) {
      files.set(name, inflateRawSync(data));
    } else {
      throw new Error(`unsupported compression method ${method} for ${name}`);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}
