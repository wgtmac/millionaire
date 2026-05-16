import test from 'node:test';
import assert from 'node:assert/strict';
import helpers from './chart-helpers.js';

const { computeMovingAverage, computeMovingAverageSeries } = helpers;

test('computeMovingAverage returns null until the 30th point, then averages the last 30 values', () => {
  const values = Array.from({ length: 31 }, (_, i) => i + 1);
  const result = computeMovingAverage(values, 30);

  assert.equal(result.length, 31);
  assert.equal(result[0], null);
  assert.equal(result[28], null);
  assert.equal(result[29], 15.5);
  assert.equal(result[30], 16.5);
});

test('computeMovingAverageSeries returns 30-day and 60-day series together', () => {
  const values = Array.from({ length: 61 }, (_, i) => i + 1);
  const series = computeMovingAverageSeries(values, [30, 60]);

  assert.equal(series[30][29], 15.5);
  assert.equal(series[30][30], 16.5);
  assert.equal(series[60][59], 30.5);
  assert.equal(series[60][60], 31.5);
});
