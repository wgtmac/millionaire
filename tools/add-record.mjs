import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_FUND_CODE,
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

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseAddRecordArgs(args) {
  const options = { force: false, fundCode: DEFAULT_FUND_CODE };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--force') {
      options.force = true;
    } else if (arg === '--fund') {
      options.fundCode = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === '--date') {
      options.date = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === '--nav') {
      options.nav = readFlagValue(args, index, arg);
      index += 1;
    } else if (arg === '--change') {
      options.change = readFlagValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  for (const required of ['date', 'nav', 'change']) {
    if (options[required] == null) {
      throw new Error(`Missing required option --${required}`);
    }
  }

  return options;
}

export async function writeStockDataFile(records, stockDataPath = DEFAULT_STOCK_DATA_PATH) {
  await writeFile(stockDataPath, generateStockDataScript(records), 'utf8');
}

async function recordsFileHasFundMap(recordsPath) {
  try {
    const parsed = JSON.parse(await readFile(recordsPath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export async function addRecordToFiles(options) {
  const recordsPath = options.recordsPath || DEFAULT_RECORDS_PATH;
  const stockDataPath = options.stockDataPath || DEFAULT_STOCK_DATA_PATH;
  const fundCode = options.fundCode || DEFAULT_FUND_CODE;
  const hasFundMap = await recordsFileHasFundMap(recordsPath);
  const fundRecords = hasFundMap ? await readFundRecords(recordsPath) : [];
  const activeFund = fundRecords.find((fund) => fund.code === fundCode);
  const existingRecords = hasFundMap ? activeFund?.records || [] : await readRecords(recordsPath, fundCode);
  const record = normalizeRecord(options);
  const existingDate = existingRecords.some((item) => item.date === record.date);
  const merged = mergeRecords(existingRecords, [record], { overwrite: Boolean(options.force) });

  if (hasFundMap) {
    const retainedFunds = fundRecords.filter((fund) => fund.code !== fundCode);
    const updatedFunds = [...retainedFunds, { code: fundCode, name: activeFund?.name, records: merged }];
    await writeFundRecords(updatedFunds, recordsPath);
    await writeStockDataFile(updatedFunds, stockDataPath);
  } else {
    await writeRecords(merged, recordsPath);
    await writeStockDataFile(merged, stockDataPath);
  }

  return {
    added: existingDate ? 0 : 1,
    overwritten: existingDate && options.force ? 1 : 0,
    total: merged.length,
  };
}

function printUsage() {
  console.log('Usage: node tools/add-record.mjs [--fund 000979] --date YYYY-MM-DD --nav 5.0560 --change -2.41 [--force]');
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
      printUsage();
      return;
    }

    const options = parseAddRecordArgs(args);
    const result = await addRecordToFiles(options);
    console.log(
      `Manual update complete: added ${result.added}, overwritten ${result.overwritten}, total ${result.total}.`,
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
