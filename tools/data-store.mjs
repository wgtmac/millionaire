import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TOOL_DIR, '..');

export const DEFAULT_RECORDS_PATH = resolve(PROJECT_ROOT, 'data', 'records.json');
export const DEFAULT_STOCK_DATA_PATH = resolve(PROJECT_ROOT, 'stock-data.js');

function roundTo(value, digits) {
  const scale = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
}

function assertValidDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date must use YYYY-MM-DD');
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`date is not a valid calendar date: ${date}`);
  }
}

function assertFiniteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${field} must be a finite number`);
  }
  return number;
}

export function normalizeRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('record must be an object');
  }

  assertValidDate(record.date);
  const nav = assertFiniteNumber(record.nav, 'nav');
  const change = assertFiniteNumber(record.change, 'change');

  return {
    date: record.date,
    nav: roundTo(nav, 4),
    change: roundTo(change, 2),
  };
}

function sortRecords(records) {
  return [...records].sort((left, right) => left.date.localeCompare(right.date));
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) {
    throw new Error('records JSON must be an array');
  }

  const normalized = records.map((record) => normalizeRecord(record));
  const seen = new Set();
  for (const record of normalized) {
    if (seen.has(record.date)) {
      throw new Error(`Duplicate record for ${record.date}`);
    }
    seen.add(record.date);
  }
  return sortRecords(normalized);
}

export function readRecordsFromText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`records JSON is invalid: ${error.message}`);
  }
  return normalizeRecords(parsed);
}

export async function readRecords(filePath = DEFAULT_RECORDS_PATH) {
  return readRecordsFromText(await readFile(filePath, 'utf8'));
}

export function stringifyRecords(records) {
  return `${JSON.stringify(normalizeRecords(records), null, 2)}\n`;
}

export async function writeRecords(records, filePath = DEFAULT_RECORDS_PATH) {
  await writeFile(filePath, stringifyRecords(records), 'utf8');
}

export function generateStockDataScript(records) {
  const normalized = normalizeRecords(records);
  return `(function (root) {
  const records = ${JSON.stringify(normalized, null, 2)};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports.records = records;
  }

  if (typeof window !== 'undefined') {
    window.STOCK_RECORDS = records;
  } else if (root) {
    root.STOCK_RECORDS = records;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;
}

export function mergeRecords(existingRecords, incomingRecords, options = {}) {
  const existing = normalizeRecords(existingRecords);
  const incoming = normalizeRecords(incomingRecords);
  const mergedByDate = new Map(existing.map((record) => [record.date, record]));

  for (const record of incoming) {
    if (mergedByDate.has(record.date) && !options.overwrite) {
      throw new Error(`Duplicate record for ${record.date}`);
    }
    mergedByDate.set(record.date, record);
  }

  return sortRecords([...mergedByDate.values()]);
}
