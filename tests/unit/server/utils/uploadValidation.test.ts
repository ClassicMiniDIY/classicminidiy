/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import {
  isZipMagic,
  isStepHeader,
  isPdfMagic,
  isStlAsciiPrefix,
  isStlBinarySizeMatch,
  sniffModelFile,
} from '~/server/utils/uploadValidation';

// --- Fixtures ---------------------------------------------------------------
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const ZIP_EMPTY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1');
const STEP = Buffer.from('ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION', 'latin1');
const STEP_BOM = Buffer.from('﻿ISO-10303-21;', 'utf8');
const ASCII_STL = Buffer.from('solid cube\n  facet normal 0 0 0\n', 'latin1');
const ASCII_STL_NEWLINE = Buffer.from('solid\nfacet', 'latin1');

/** Build a binary STL head: 80-byte header + uint32LE triangle count. */
function binaryStlHead(triangleCount: number): Buffer {
  const head = Buffer.alloc(84);
  head.write('binary stl model header padding', 0, 'latin1');
  head.writeUInt32LE(triangleCount, 80);
  return head;
}

describe('server/utils/uploadValidation — magic predicates', () => {
  it('isZipMagic accepts standard and empty zip headers', () => {
    expect(isZipMagic(ZIP)).toBe(true);
    expect(isZipMagic(ZIP_EMPTY)).toBe(true);
    expect(isZipMagic(PDF)).toBe(false);
    expect(isZipMagic(Buffer.from([0x50, 0x4b]))).toBe(false); // too short
  });

  it('isPdfMagic matches %PDF only', () => {
    expect(isPdfMagic(PDF)).toBe(true);
    expect(isPdfMagic(ZIP)).toBe(false);
    expect(isPdfMagic(Buffer.from('PDF', 'latin1'))).toBe(false);
  });

  it('isStepHeader matches ISO-10303-21 with or without a BOM', () => {
    expect(isStepHeader(STEP)).toBe(true);
    expect(isStepHeader(STEP_BOM)).toBe(true);
    expect(isStepHeader(Buffer.from('  ISO-10303-21;', 'latin1'))).toBe(true);
    expect(isStepHeader(PDF)).toBe(false);
    expect(isStepHeader(Buffer.from('NOT-ISO', 'latin1'))).toBe(false);
  });

  it('isStlAsciiPrefix requires "solid" + whitespace', () => {
    expect(isStlAsciiPrefix(ASCII_STL)).toBe(true);
    expect(isStlAsciiPrefix(ASCII_STL_NEWLINE)).toBe(true);
    expect(isStlAsciiPrefix(Buffer.from('solid', 'latin1'))).toBe(true); // exactly 5 bytes
    expect(isStlAsciiPrefix(Buffer.from('solidify', 'latin1'))).toBe(false); // no whitespace after
    expect(isStlAsciiPrefix(PDF)).toBe(false);
  });

  it('isStlBinarySizeMatch enforces 84 + 50*count and a non-zero count', () => {
    expect(isStlBinarySizeMatch(binaryStlHead(1), 134)).toBe(true);
    expect(isStlBinarySizeMatch(binaryStlHead(100), 84 + 50 * 100)).toBe(true);
    expect(isStlBinarySizeMatch(binaryStlHead(1), 999)).toBe(false); // wrong total
    expect(isStlBinarySizeMatch(binaryStlHead(0), 84)).toBe(false); // empty rejected
    expect(isStlBinarySizeMatch(Buffer.alloc(40), 40)).toBe(false); // too short
  });
});

describe('server/utils/uploadValidation — sniffModelFile', () => {
  it('passes zip-container formats with a zip header', () => {
    for (const ext of ['3mf', 'f3d', 'f3z']) {
      expect(sniffModelFile({ ext, head: ZIP, size: 1000 }).ok).toBe(true);
    }
  });

  it('fails a zip-container format when bytes are not a zip', () => {
    const res = sniffModelFile({ ext: '3mf', head: PDF, size: 1000 });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('expected-zip');
  });

  it('passes step/stp with the ISO token and fails otherwise', () => {
    expect(sniffModelFile({ ext: 'step', head: STEP, size: 1000 }).ok).toBe(true);
    expect(sniffModelFile({ ext: 'stp', head: STEP_BOM, size: 1000 }).ok).toBe(true);
    expect(sniffModelFile({ ext: 'step', head: ZIP, size: 1000 }).ok).toBe(false);
  });

  it('passes pdf with %PDF and fails otherwise', () => {
    expect(sniffModelFile({ ext: 'pdf', head: PDF, size: 1000 }).ok).toBe(true);
    expect(sniffModelFile({ ext: 'pdf', head: ZIP, size: 1000 }).ok).toBe(false);
  });

  it('passes ascii OR binary STL, fails a disguised file', () => {
    expect(sniffModelFile({ ext: 'stl', head: ASCII_STL, size: 5000 }).ok).toBe(true);
    expect(sniffModelFile({ ext: 'stl', head: binaryStlHead(2), size: 184 }).ok).toBe(true);
    const bad = sniffModelFile({ ext: 'stl', head: PDF, size: 1000 });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('not-ascii-or-binary-stl');
  });

  it('passes plain-text CAD formats on best-effort (no magic)', () => {
    for (const ext of ['obj', 'scad', 'dxf', 'iges', 'igs']) {
      expect(sniffModelFile({ ext, head: Buffer.from('whatever', 'latin1'), size: 10 }).ok).toBe(true);
    }
  });

  it('is case-insensitive on the extension', () => {
    expect(sniffModelFile({ ext: 'PDF', head: PDF, size: 1000 }).ok).toBe(true);
  });
});
