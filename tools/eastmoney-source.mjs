import { mergeRecords } from './data-store.mjs';

export const DEFAULT_FUND_CODE = '021313';
export const EASTMONEY_HISTORY_ENDPOINT = 'https://api.fund.eastmoney.com/f10/lsjz';
export const EASTMONEY_LEGACY_HISTORY_ENDPOINT = 'https://fundf10.eastmoney.com/F10DataApi.aspx';

export function buildEastmoneyUrl(options = {}) {
  const url = new URL(EASTMONEY_HISTORY_ENDPOINT);
  url.searchParams.set('fundCode', options.fundCode || DEFAULT_FUND_CODE);
  url.searchParams.set('pageIndex', String(options.pageIndex || 1));
  url.searchParams.set('pageSize', String(options.pageSize || 100));
  url.searchParams.set('startDate', options.startDate || '');
  url.searchParams.set('endDate', options.endDate || '');
  return url;
}

export function buildLegacyEastmoneyUrl(options = {}) {
  const url = new URL(EASTMONEY_LEGACY_HISTORY_ENDPOINT);
  url.searchParams.set('type', 'lsjz');
  url.searchParams.set('code', options.fundCode || DEFAULT_FUND_CODE);
  url.searchParams.set('page', String(options.pageIndex || 1));
  url.searchParams.set('per', String(options.pageSize || 50));
  return url;
}

export function parseEastmoneyRecords(payload) {
  if (payload?.ErrCode && payload.ErrCode !== 0) {
    throw new Error(`Eastmoney API error: ${payload.ErrMsg || payload.ErrCode}`);
  }

  const list = payload?.Data?.LSJZList;
  if (!Array.isArray(list)) {
    throw new Error('Eastmoney API response did not contain Data.LSJZList');
  }

  return mergeRecords(
    [],
    list.map((item) => ({
      date: item.FSRQ,
      nav: item.DWJZ,
      change: item.JZZZL,
    })),
  );
}

export function recordsAfterDate(records, latestLocalDate) {
  const incoming = latestLocalDate ? records.filter((record) => record.date > latestLocalDate) : records;
  return mergeRecords([], incoming);
}

function decodeLegacyContent(content) {
  return content
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\//g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '').replace(/%/g, '').trim();
}

function readNumberOrZero(value) {
  if (value === '') {
    return 0;
  }
  return value;
}

export function parseLegacyEastmoneyResponse(text) {
  const contentMatch = text.match(/content:"([\s\S]*?)",records:/);
  if (!contentMatch) {
    throw new Error('Eastmoney legacy response did not contain content');
  }

  const content = decodeLegacyContent(contentMatch[1]);
  const rowMatches = [...content.matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const records = rowMatches
    .map((rowMatch) => [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => stripTags(cell[1])))
    .filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0]))
    .map((cells) => ({
      date: cells[0],
      nav: cells[1],
      change: readNumberOrZero(cells[3] || ''),
    }));

  const recordsMatch = text.match(/records:(\d+)/);
  const pagesMatch = text.match(/pages:(\d+)/);
  const currentPageMatch = text.match(/curpage:(\d+)/);

  return {
    records: mergeRecords([], records),
    totalRecords: recordsMatch ? Number(recordsMatch[1]) : records.length,
    pages: pagesMatch ? Number(pagesMatch[1]) : 1,
    currentPage: currentPageMatch ? Number(currentPageMatch[1]) : 1,
  };
}

export async function fetchEastmoneyRecords(options = {}) {
  const fundCode = options.fundCode || DEFAULT_FUND_CODE;
  const pageSize = options.pageSize || 50;
  const maxPages = options.maxPages || 200;
  const fetchImpl = options.fetchImpl || fetch;
  let allRecords = [];

  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
    const url = buildLegacyEastmoneyUrl({ fundCode, pageIndex, pageSize });
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'text/javascript,text/html,*/*',
        Referer: `https://fundf10.eastmoney.com/jjjz_${fundCode}.html`,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Eastmoney request failed with HTTP ${response.status}`);
    }

    const payload = parseLegacyEastmoneyResponse(await response.text());
    const pageRecords = payload.records;
    if (pageRecords.length === 0) {
      break;
    }

    allRecords = mergeRecords(allRecords, pageRecords);
    if (pageIndex >= payload.pages) {
      break;
    }
  }

  return allRecords;
}
