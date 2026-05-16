import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateStockDataScript,
  mergeRecords,
  normalizeRecord,
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
  const script = generateStockDataScript([
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);

  assert.match(script, /window\.STOCK_RECORDS/);
  assert.match(script, /module\.exports\.records/);
  assert.match(script, /"date": "2026-05-15"/);
  assert.match(script, /"nav": 5.056/);
  assert.match(script, /"change": -2.41/);
});
