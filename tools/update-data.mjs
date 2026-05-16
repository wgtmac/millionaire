import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_RECORDS_PATH,
  DEFAULT_STOCK_DATA_PATH,
  generateStockDataScript,
  mergeRecords,
  normalizeRecord,
  readRecords,
  writeRecords,
} from './data-store.mjs';
import { DEFAULT_FUND_CODE, fetchEastmoneyRecords, recordsAfterDate } from './eastmoney-source.mjs';

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function latestDate(records) {
  return records.length === 0 ? null : records[records.length - 1].date;
}

function assertDate(value) {
  normalizeRecord({ date: value, nav: 1, change: 0 });
  return value;
}

export function sinceDateFromYears(years, baseDate = new Date()) {
  const count = Number(years);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('--backfill-years must be a positive integer');
  }

  const since = new Date(baseDate);
  since.setFullYear(since.getFullYear() - count);
  return since.toISOString().slice(0, 10);
}

function recordsSinceDate(records, since) {
  return mergeRecords([], records.filter((record) => record.date >= since));
}

function countOverwrites(existingRecords, incomingRecords) {
  const existingDates = new Set(existingRecords.map((record) => record.date));
  return incomingRecords.filter((record) => existingDates.has(record.date)).length;
}

export function parseUpdateArgs(args) {
  const options = {
    fundCode: DEFAULT_FUND_CODE,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--fund') {
      options.fundCode = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === '--since') {
      options.since = assertDate(readFlagValue(args, index, arg));
      index += 1;
    } else if (arg === '--backfill-years') {
      options.backfillYears = Number(readFlagValue(args, index, arg));
      options.since = sinceDateFromYears(options.backfillYears);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export async function updateDataFromSource(options = {}) {
  const recordsPath = options.recordsPath || DEFAULT_RECORDS_PATH;
  const stockDataPath = options.stockDataPath || DEFAULT_STOCK_DATA_PATH;
  const fundCode = options.fundCode || DEFAULT_FUND_CODE;
  const dryRun = Boolean(options.dryRun);
  const fetchRecords = options.fetchRecords || fetchEastmoneyRecords;
  const since = options.since || (options.backfillYears ? sinceDateFromYears(options.backfillYears) : null);

  const localRecords = await readRecords(recordsPath);
  const latestLocalDate = latestDate(localRecords);
  const remoteRecords = await fetchRecords({ fundCode });
  const latestRemoteDate = latestDate(remoteRecords);
  const incomingRecords = since ? recordsSinceDate(remoteRecords, since) : recordsAfterDate(remoteRecords, latestLocalDate);
  const overwritten = since ? countOverwrites(localRecords, incomingRecords) : 0;
  const added = incomingRecords.length - overwritten;
  const retainedLocalRecords = since ? localRecords.filter((record) => record.date < since) : localRecords;
  const merged = mergeRecords(retainedLocalRecords, incomingRecords, { overwrite: Boolean(since) });

  if (!dryRun) {
    await writeRecords(merged, recordsPath);
    await writeFile(stockDataPath, generateStockDataScript(merged), 'utf8');
  }

  return {
    added,
    dryRun,
    latestLocalDate,
    latestRemoteDate,
    overwritten,
    total: merged.length,
  };
}

function printUsage() {
  console.log('Usage: node tools/update-data.mjs [--fund 021313] [--dry-run] [--since YYYY-MM-DD | --backfill-years 3]');
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
      printUsage();
      return;
    }

    const options = parseUpdateArgs(args);
    const result = await updateDataFromSource(options);
    const mode = result.dryRun ? 'Dry run' : 'Auto update';
    console.log(
      `${mode} complete: added ${result.added}, overwritten ${result.overwritten}, total ${result.total}, local latest ${result.latestLocalDate || 'none'}, remote latest ${result.latestRemoteDate || 'none'}.`,
    );
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
