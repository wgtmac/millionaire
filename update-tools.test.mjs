import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { addRecordToFiles, parseAddRecordArgs } from './tools/add-record.mjs';
import { readRecords, stringifyRecords } from './tools/data-store.mjs';
import { parseUpdateArgs, updateDataFromSource } from './tools/update-data.mjs';

async function createTempDataFiles(records) {
  const dir = await mkdtemp(join(tmpdir(), 'jingshun-data-'));
  const recordsPath = join(dir, 'records.json');
  const stockDataPath = join(dir, 'stock-data.js');
  await writeFile(recordsPath, stringifyRecords(records), 'utf8');
  await writeFile(stockDataPath, '', 'utf8');
  return { recordsPath, stockDataPath };
}

test('parseAddRecordArgs reads required manual record flags', () => {
  assert.deepEqual(
    parseAddRecordArgs(['--date', '2026-05-15', '--nav', '5.0560', '--change', '-2.41', '--force']),
    { date: '2026-05-15', nav: '5.0560', change: '-2.41', force: true },
  );
});

test('addRecordToFiles appends a new record and regenerates browser data', async () => {
  const { recordsPath, stockDataPath } = await createTempDataFiles([
    { date: '2026-05-14', nav: 5.181, change: -1.73 },
  ]);

  const result = await addRecordToFiles({
    date: '2026-05-15',
    nav: 5.056,
    change: -2.41,
    recordsPath,
    stockDataPath,
  });

  assert.deepEqual(result, { added: 1, overwritten: 0, total: 2 });
  assert.deepEqual((await readRecords(recordsPath)).map((record) => record.date), [
    '2026-05-14',
    '2026-05-15',
  ]);
  assert.match(await readFile(stockDataPath, 'utf8'), /window\.STOCK_RECORDS/);
  assert.match(await readFile(stockDataPath, 'utf8'), /2026-05-15/);
});

test('addRecordToFiles rejects duplicates without force', async () => {
  const { recordsPath, stockDataPath } = await createTempDataFiles([
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);

  await assert.rejects(
    () =>
      addRecordToFiles({
        date: '2026-05-15',
        nav: 5.1,
        change: 0.87,
        recordsPath,
        stockDataPath,
      }),
    /Duplicate record for 2026-05-15/,
  );
});

test('addRecordToFiles overwrites duplicates with force', async () => {
  const { recordsPath, stockDataPath } = await createTempDataFiles([
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);

  const result = await addRecordToFiles({
    date: '2026-05-15',
    nav: 5.1,
    change: 0.87,
    force: true,
    recordsPath,
    stockDataPath,
  });

  assert.deepEqual(result, { added: 0, overwritten: 1, total: 1 });
  assert.deepEqual(await readRecords(recordsPath), [{ date: '2026-05-15', nav: 5.1, change: 0.87 }]);
});

test('parseUpdateArgs reads fund and dry-run flags', () => {
  assert.deepEqual(parseUpdateArgs(['--fund', '021313', '--dry-run']), {
    fundCode: '021313',
    dryRun: true,
  });
});

test('updateDataFromSource appends missing newer remote records and regenerates browser data', async () => {
  const { recordsPath, stockDataPath } = await createTempDataFiles([
    { date: '2026-05-13', nav: 5.272, change: 3.51 },
  ]);

  const result = await updateDataFromSource({
    recordsPath,
    stockDataPath,
    fetchRecords: async () => [
      { date: '2026-05-13', nav: 5.272, change: 3.51 },
      { date: '2026-05-14', nav: 5.181, change: -1.73 },
      { date: '2026-05-15', nav: 5.056, change: -2.41 },
    ],
  });

  assert.deepEqual(result, {
    added: 2,
    dryRun: false,
    latestLocalDate: '2026-05-13',
    latestRemoteDate: '2026-05-15',
    overwritten: 0,
    total: 3,
  });
  assert.deepEqual((await readRecords(recordsPath)).map((record) => record.date), [
    '2026-05-13',
    '2026-05-14',
    '2026-05-15',
  ]);
  assert.match(await readFile(stockDataPath, 'utf8'), /2026-05-15/);
});

test('updateDataFromSource dry-run reports missing records without writing files', async () => {
  const { recordsPath, stockDataPath } = await createTempDataFiles([
    { date: '2026-05-13', nav: 5.272, change: 3.51 },
  ]);

  const result = await updateDataFromSource({
    dryRun: true,
    recordsPath,
    stockDataPath,
    fetchRecords: async () => [
      { date: '2026-05-13', nav: 5.272, change: 3.51 },
      { date: '2026-05-14', nav: 5.181, change: -1.73 },
    ],
  });

  assert.equal(result.added, 1);
  assert.deepEqual(await readRecords(recordsPath), [{ date: '2026-05-13', nav: 5.272, change: 3.51 }]);
  assert.equal(await readFile(stockDataPath, 'utf8'), '');
});

test('parseUpdateArgs reads since and backfill-years flags', () => {
  assert.deepEqual(parseUpdateArgs(['--since', '2023-05-16', '--backfill-years', '3']), {
    backfillYears: 3,
    dryRun: false,
    fundCode: '021313',
    since: '2023-05-16',
  });
});

test('updateDataFromSource backfills since date and overwrites same-day remote values', async () => {
  const { recordsPath, stockDataPath } = await createTempDataFiles([
    { date: '2026-05-14', nav: 1, change: 0 },
  ]);

  const result = await updateDataFromSource({
    since: '2026-05-13',
    recordsPath,
    stockDataPath,
    fetchRecords: async () => [
      { date: '2026-05-12', nav: 5.093, change: 0.87 },
      { date: '2026-05-13', nav: 5.272, change: 3.51 },
      { date: '2026-05-14', nav: 5.181, change: -1.73 },
      { date: '2026-05-15', nav: 5.056, change: -2.41 },
    ],
  });

  assert.deepEqual(result, {
    added: 2,
    dryRun: false,
    latestLocalDate: '2026-05-14',
    latestRemoteDate: '2026-05-15',
    overwritten: 1,
    total: 3,
  });
  assert.deepEqual(await readRecords(recordsPath), [
    { date: '2026-05-13', nav: 5.272, change: 3.51 },
    { date: '2026-05-14', nav: 5.181, change: -1.73 },
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);
});
