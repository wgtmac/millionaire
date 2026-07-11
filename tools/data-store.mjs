import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TOOL_DIR, '..');

export const DEFAULT_RECORDS_PATH = resolve(PROJECT_ROOT, 'data', 'records.json');
export const DEFAULT_STOCK_DATA_PATH = resolve(PROJECT_ROOT, 'stock-data.js');
export const DEFAULT_FUNDS = [
  { code: '000979', name: '景顺长城沪港深精选股票A' },
  { code: '016858', name: '国金量化多因子股票C' },
  { code: '009478', name: '中银上海金ETF联接C' },
  { code: '001235', name: '景顺长城新兴成长混合' },
];
export const DEFAULT_FUND_CODE = DEFAULT_FUNDS[0].code;
export const DEFAULT_FUND_CODES = DEFAULT_FUNDS.map((fund) => fund.code);

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

function normalizeFundCode(code) {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error(`fund code must be a 6 digit string: ${code}`);
  }
  return normalized;
}

function fundMeta(code, name) {
  const normalizedCode = normalizeFundCode(code);
  const defaultMeta = DEFAULT_FUNDS.find((fund) => fund.code === normalizedCode);
  return {
    code: normalizedCode,
    name: String(name || defaultMeta?.name || `基金 ${normalizedCode}`),
  };
}

function sortFunds(funds) {
  return [...funds].sort((left, right) => {
    const leftDefaultIndex = DEFAULT_FUND_CODES.indexOf(left.code);
    const rightDefaultIndex = DEFAULT_FUND_CODES.indexOf(right.code);
    const leftOrder = leftDefaultIndex === -1 ? Number.POSITIVE_INFINITY : leftDefaultIndex;
    const rightOrder = rightDefaultIndex === -1 ? Number.POSITIVE_INFINITY : rightDefaultIndex;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.code.localeCompare(right.code);
  });
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

function parseRecordsJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`records JSON is invalid: ${error.message}`);
  }
  return parsed;
}

export function normalizeFundRecords(value) {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item) && 'code' in item && 'records' in item)) {
      const funds = value.map((fund) => ({
        ...fundMeta(fund.code, fund.name),
        records: normalizeRecords(fund.records),
      }));
      const seen = new Set();
      for (const fund of funds) {
        if (seen.has(fund.code)) {
          throw new Error(`Duplicate fund code ${fund.code}`);
        }
        seen.add(fund.code);
      }
      return sortFunds(funds);
    }

    return [
      {
        ...fundMeta(DEFAULT_FUND_CODE),
        records: normalizeRecords(value),
      },
    ];
  }

  if (!value || typeof value !== 'object') {
    throw new Error('fund records JSON must be an array or object');
  }

  const sourceEntries = Array.isArray(value.funds)
    ? value.funds.map((fund) => [fund.code, fund])
    : Object.entries(value);
  const funds = sourceEntries
    .filter(([key]) => key !== 'funds')
    .map(([code, fundValue]) => {
      const records = Array.isArray(fundValue) ? fundValue : fundValue?.records;
      const name = Array.isArray(fundValue) ? null : fundValue?.name;
      return {
        ...fundMeta(code, name),
        records: normalizeRecords(records),
      };
    });

  const seen = new Set();
  for (const fund of funds) {
    if (seen.has(fund.code)) {
      throw new Error(`Duplicate fund code ${fund.code}`);
    }
    seen.add(fund.code);
  }

  return sortFunds(funds);
}

export function readRecordsFromText(text, fundCode = DEFAULT_FUND_CODE) {
  const parsed = parseRecordsJson(text);
  if (Array.isArray(parsed)) {
    return normalizeRecords(parsed);
  }

  const normalizedFundCode = normalizeFundCode(fundCode);
  const fund = normalizeFundRecords(parsed).find((item) => item.code === normalizedFundCode);
  return fund ? fund.records : [];
}

export function readFundRecordsFromText(text) {
  return normalizeFundRecords(parseRecordsJson(text));
}

export async function readRecords(filePath = DEFAULT_RECORDS_PATH, fundCode = DEFAULT_FUND_CODE) {
  return readRecordsFromText(await readFile(filePath, 'utf8'), fundCode);
}

export async function readFundRecords(filePath = DEFAULT_RECORDS_PATH) {
  return readFundRecordsFromText(await readFile(filePath, 'utf8'));
}

export function stringifyRecords(records) {
  return `${JSON.stringify(normalizeRecords(records), null, 2)}\n`;
}

export function stringifyFundRecords(fundRecords) {
  const normalized = normalizeFundRecords(fundRecords);
  const output = {};
  for (const fund of normalized) {
    output[fund.code] = fund.records;
  }
  return `${JSON.stringify(output, null, 2)}\n`;
}

export async function writeRecords(records, filePath = DEFAULT_RECORDS_PATH) {
  await writeFile(filePath, stringifyRecords(records), 'utf8');
}

export async function writeFundRecords(fundRecords, filePath = DEFAULT_RECORDS_PATH) {
  await writeFile(filePath, stringifyFundRecords(fundRecords), 'utf8');
}

export function generateStockDataScript(fundRecords) {
  const funds = normalizeFundRecords(fundRecords);
  const records = funds[0]?.records || [];
  return `(function (root) {
  const funds = ${JSON.stringify(funds, null, 2)};
  const records = funds[0] ? funds[0].records : [];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports.records = records;
    module.exports.funds = funds;
  }

  if (typeof window !== 'undefined') {
    window.STOCK_RECORDS = records;
    window.STOCK_FUNDS = funds;
  } else if (root) {
    root.STOCK_RECORDS = records;
    root.STOCK_FUNDS = funds;
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
