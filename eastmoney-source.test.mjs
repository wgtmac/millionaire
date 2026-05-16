import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEastmoneyUrl,
  buildLegacyEastmoneyUrl,
  fetchEastmoneyRecords,
  parseEastmoneyRecords,
  parseLegacyEastmoneyResponse,
  recordsAfterDate,
} from './tools/eastmoney-source.mjs';

const eastmoneyFixture = {
  Data: {
    LSJZList: [
      { FSRQ: '2026-05-15', DWJZ: '5.0560', JZZZL: '-2.41' },
      { FSRQ: '2026-05-14', DWJZ: '5.1810', JZZZL: '-1.73' },
      { FSRQ: '2026-05-13', DWJZ: '5.2720', JZZZL: '3.51' },
    ],
  },
  ErrCode: 0,
  TotalCount: 501,
};

test('parseEastmoneyRecords maps API records to canonical ascending records', () => {
  assert.deepEqual(parseEastmoneyRecords(eastmoneyFixture), [
    { date: '2026-05-13', nav: 5.272, change: 3.51 },
    { date: '2026-05-14', nav: 5.181, change: -1.73 },
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);
});

test('parseEastmoneyRecords rejects API errors', () => {
  assert.throws(
    () => parseEastmoneyRecords({ ErrCode: 500, ErrMsg: 'bad gateway' }),
    /Eastmoney API error: bad gateway/,
  );
});

test('recordsAfterDate returns only missing newer records in ascending order', () => {
  const records = parseEastmoneyRecords(eastmoneyFixture);

  assert.deepEqual(recordsAfterDate(records, '2026-05-13'), [
    { date: '2026-05-14', nav: 5.181, change: -1.73 },
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);
});

test('buildEastmoneyUrl sets the fund code and pagination params', () => {
  const url = buildEastmoneyUrl({ fundCode: '021313', pageIndex: 2, pageSize: 50 });

  assert.equal(url.searchParams.get('fundCode'), '021313');
  assert.equal(url.searchParams.get('pageIndex'), '2');
  assert.equal(url.searchParams.get('pageSize'), '50');
});

test('parseLegacyEastmoneyResponse maps F10DataApi script to canonical records and metadata', () => {
  const text = `var apidata={ content:"<table><tbody><tr><td>2026-05-15</td><td class='tor bold'>5.0560</td><td class='tor bold'>5.0560</td><td class='tor bold grn'>-2.41%</td><td>开放申购</td><td>开放赎回</td><td></td></tr><tr><td>2024-04-19</td><td class='tor bold'>2.2380</td><td class='tor bold'>2.2380</td><td class='tor bold bck'></td><td>限制大额申购</td><td>开放赎回</td><td></td></tr></tbody></table>",records:501,pages:101,curpage:1};`;

  assert.deepEqual(parseLegacyEastmoneyResponse(text), {
    records: [
      { date: '2024-04-19', nav: 2.238, change: 0 },
      { date: '2026-05-15', nav: 5.056, change: -2.41 },
    ],
    totalRecords: 501,
    pages: 101,
    currentPage: 1,
  });
});

test('buildLegacyEastmoneyUrl sets legacy F10 query params', () => {
  const url = buildLegacyEastmoneyUrl({ fundCode: '021313', pageIndex: 3, pageSize: 20 });

  assert.equal(url.searchParams.get('type'), 'lsjz');
  assert.equal(url.searchParams.get('code'), '021313');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(url.searchParams.get('per'), '20');
});

test('fetchEastmoneyRecords uses the complete legacy paginated source', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url.searchParams.get('page'));
    const page = url.searchParams.get('page');
    const body =
      page === '1'
        ? `var apidata={ content:"<table><tbody><tr><td>2026-05-15</td><td>5.0560</td><td>5.0560</td><td>-2.41%</td></tr></tbody></table>",records:2,pages:2,curpage:1};`
        : `var apidata={ content:"<table><tbody><tr><td>2024-04-19</td><td>2.2380</td><td>2.2380</td><td></td></tr></tbody></table>",records:2,pages:2,curpage:2};`;
    return {
      ok: true,
      status: 200,
      text: async () => body,
    };
  };

  assert.deepEqual(await fetchEastmoneyRecords({ fetchImpl, pageSize: 1 }), [
    { date: '2024-04-19', nav: 2.238, change: 0 },
    { date: '2026-05-15', nav: 5.056, change: -2.41 },
  ]);
  assert.deepEqual(calls, ['1', '2']);
});
