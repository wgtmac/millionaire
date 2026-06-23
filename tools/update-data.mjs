import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_FUND_CODES,
  DEFAULT_RECORDS_PATH,
  DEFAULT_STOCK_DATA_PATH,
  generateStockDataScript,
  mergeRecords,
  normalizeRecord,
  readFundRecords,
  readRecords,
  writeFundRecords,
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

async function recordsFileHasFundMap(recordsPath) {
  try {
    const parsed = JSON.parse(await readFile(recordsPath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function parseUpdateArgs(args) {
  const options = {
    dryRun: false,
    fundCodes: [...DEFAULT_FUND_CODES],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--fund') {
      options.fundCode = readFlagValue(args, index, arg);
      options.fundCodes = [options.fundCode];
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

function mergeRemoteRecords(localRecords, remoteRecords, since) {
  const latestLocalDate = latestDate(localRecords);
  const latestRemoteDate = latestDate(remoteRecords);
  const incomingRecords = since ? recordsSinceDate(remoteRecords, since) : recordsAfterDate(remoteRecords, latestLocalDate);
  const overwritten = since ? countOverwrites(localRecords, incomingRecords) : 0;
  const added = incomingRecords.length - overwritten;
  const retainedLocalRecords = since ? localRecords.filter((record) => record.date < since) : localRecords;
  const merged = mergeRecords(retainedLocalRecords, incomingRecords, { overwrite: Boolean(since) });

  return {
    added,
    latestLocalDate,
    latestRemoteDate,
    overwritten,
    records: merged,
    total: merged.length,
  };
}

export async function updateDataFromSource(options = {}) {
  const recordsPath = options.recordsPath || DEFAULT_RECORDS_PATH;
  const stockDataPath = options.stockDataPath || DEFAULT_STOCK_DATA_PATH;
  const fundCodes = options.fundCodes || (options.fundCode ? [options.fundCode] : [DEFAULT_FUND_CODE]);
  const dryRun = Boolean(options.dryRun);
  const fetchRecords = options.fetchRecords || fetchEastmoneyRecords;
  const since = options.since || (options.backfillYears ? sinceDateFromYears(options.backfillYears) : null);

  if (fundCodes.length === 1) {
    const fundCode = fundCodes[0];
    const hasFundMap = await recordsFileHasFundMap(recordsPath);
    const localFunds = hasFundMap ? await readFundRecords(recordsPath) : [];
    const localFund = localFunds.find((fund) => fund.code === fundCode);
    const localRecords = hasFundMap ? localFund?.records || [] : await readRecords(recordsPath, fundCode);
    const remoteRecords = await fetchRecords({ fundCode });
    const result = mergeRemoteRecords(localRecords, remoteRecords, since);

    if (!dryRun) {
      if (hasFundMap) {
        const retainedFunds = localFunds.filter((fund) => fund.code !== fundCode);
        const updatedFunds = [...retainedFunds, { code: fundCode, name: localFund?.name, records: result.records }];
        await writeFundRecords(updatedFunds, recordsPath);
        await writeFile(stockDataPath, generateStockDataScript(updatedFunds), 'utf8');
      } else {
        await writeRecords(result.records, recordsPath);
        await writeFile(stockDataPath, generateStockDataScript(result.records), 'utf8');
      }
    }

    return {
      added: result.added,
      dryRun,
      latestLocalDate: result.latestLocalDate,
      latestRemoteDate: result.latestRemoteDate,
      overwritten: result.overwritten,
      total: result.total,
    };
  }

  const localFunds = await readFundRecords(recordsPath);
  const localByCode = new Map(localFunds.map((fund) => [fund.code, fund]));
  const updatedFunds = [];
  const results = [];

  for (const fundCode of fundCodes) {
    const localFund = localByCode.get(fundCode);
    const remoteRecords = await fetchRecords({ fundCode });
    const result = mergeRemoteRecords(localFund?.records || [], remoteRecords, since);
    const nextFund = {
      code: fundCode,
      name: localFund?.name,
      records: result.records,
    };

    updatedFunds.push(nextFund);
    results.push({
      added: result.added,
      dryRun,
      fundCode,
      latestLocalDate: result.latestLocalDate,
      latestRemoteDate: result.latestRemoteDate,
      overwritten: result.overwritten,
      total: result.total,
    });
  }

  if (!dryRun) {
    await writeFundRecords(updatedFunds, recordsPath);
    await writeFile(stockDataPath, generateStockDataScript(updatedFunds), 'utf8');
  }

  return {
    added: results.reduce((total, item) => total + item.added, 0),
    dryRun,
    funds: results,
    latestLocalDate: results[0]?.latestLocalDate || null,
    latestRemoteDate: results[0]?.latestRemoteDate || null,
    overwritten: results.reduce((total, item) => total + item.overwritten, 0),
    total: results.reduce((total, item) => total + item.total, 0),
  };
}

function printUsage() {
  console.log('Usage: node tools/update-data.mjs [--fund 000979] [--dry-run] [--since YYYY-MM-DD | --backfill-years 3]');
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
    if (result.funds) {
      console.log(`${mode} complete: added ${result.added}, overwritten ${result.overwritten}, total ${result.total}.`);
      for (const fund of result.funds) {
        console.log(
          `  ${fund.fundCode}: added ${fund.added}, overwritten ${fund.overwritten}, total ${fund.total}, local latest ${fund.latestLocalDate || 'none'}, remote latest ${fund.latestRemoteDate || 'none'}.`,
        );
      }
    } else {
      console.log(
        `${mode} complete: added ${result.added}, overwritten ${result.overwritten}, total ${result.total}, local latest ${result.latestLocalDate || 'none'}, remote latest ${result.latestRemoteDate || 'none'}.`,
      );
    }
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
