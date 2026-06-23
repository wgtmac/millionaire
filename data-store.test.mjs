import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_FUNDS,
  generateStockDataScript,
  mergeRecords,
  normalizeRecord,
  normalizeFundRecords,
  readRecordsFromText,
} from './tools/data-store.mjs';

test('normalizeRecord validates and rounds record fields', () => {
  assert.deepEqual(
    normalizeRecord({ date: '2026-05-15', nav: '5.05604', change: '-2.414' }),
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  );
});

test('normalizeRecord rejects malformed records with useful messages', () => {
  assert.throws(
    () => normalizeRecord({ date: '2026/05/15', nav: 5.056, change: -2.41 }),
    /date must use YYYY-MM-DD/,
  );
  assert.throws(
    () => normalizeRecord({ date: '2026-05-15', nav: 'bad', change: -2.41 }),
    /nav must be a finite number/,
  );
  assert.throws(
    () => normalizeRecord({ date: '2026-05-15', nav: 5.056, change: 'bad' }),
    /change must be a finite number/,
  );
});

test('readRecordsFromText parses a JSON array and sorts by date', () => {
  const records = readRecordsFromText(
    JSON.stringify([
      { date: '2026-05-15', nav: 5.056, change: -2.41 },
      { date: '2026-05-14', nav: 5.181, change: -1.73 },
    ]),
  );

  assert.deepEqual(records.map((record) => record.date), ['2026-05-14', '2026-05-15']);
});

test('normalizeFundRecords accepts keyed fund records and fills metadata', () => {
  const fundRecords = normalizeFundRecords({
    '009478': [{ date: '2026-05-15', nav: 1.23456, change: '-0.123' }],
    '000979': [{ date: '2026-05-14', nav: 5.181, change: -1.73 }],
  });

  assert.deepEqual(
    fundRecords.map((fund) => ({ code: fund.code, name: fund.name, count: fund.records.length })),
    [
      { code: '000979', name: DEFAULT_FUNDS[0].name, count: 1 },
      { code: '009478', name: DEFAULT_FUNDS[2].name, count: 1 },
    ],
  );
  assert.equal(fundRecords[1].records[0].nav, 1.2346);
  assert.equal(fundRecords[1].records[0].change, -0.12);
});

test('mergeRecords appends new dates and keeps ascending order', () => {
  const merged = mergeRecords(
    [{ date: '2026-05-14', nav: 5.181, change: -1.73 }],
    [{ date: '2026-05-15', nav: 5.056, change: -2.41 }],
  );

  assert.deepEqual(merged, [
    { date: '2026-05-14', nav: 5.181, change: -1.73 },
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);
});

test('mergeRecords rejects duplicate dates unless overwrite is enabled', () => {
  assert.throws(
    () =>
      mergeRecords(
        [{ date: '2026-05-15', nav: 5.056, change: -2.41 }],
        [{ date: '2026-05-15', nav: 5.1, change: 0.87 }],
      ),
    /Duplicate record for 2026-05-15/,
  );

  assert.deepEqual(
    mergeRecords(
      [{ date: '2026-05-15', nav: 5.056, change: -2.41 }],
      [{ date: '2026-05-15', nav: 5.1, change: 0.87 }],
      { overwrite: true },
    ),
    [{ date: '2026-05-15', nav: 5.1, change: 0.87 }],
  );
});

test('generateStockDataScript creates browser data script', () => {
  const script = generateStockDataScript({
    '000979': [{ date: '2026-05-15', nav: 5.056, change: -2.41 }],
    '016858': [{ date: '2026-05-14', nav: 1.234, change: 0.12 }],
  });

  assert.match(script, /window\.STOCK_RECORDS/);
  assert.match(script, /window\.STOCK_FUNDS/);
  assert.match(script, /module\.exports\.records/);
  assert.match(script, /module\.exports\.funds/);
  assert.match(script, /"code": "016858"/);
  assert.match(script, /"date": "2026-05-15"/);
  assert.match(script, /"nav": 5.056/);
  assert.match(script, /"change": -2.41/);
});
