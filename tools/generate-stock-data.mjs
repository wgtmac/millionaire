import { writeFile } from 'node:fs/promises';

import {
  DEFAULT_STOCK_DATA_PATH,
  generateStockDataScript,
  readRecords,
} from './data-store.mjs';

const records = await readRecords();
await writeFile(DEFAULT_STOCK_DATA_PATH, generateStockDataScript(records), 'utf8');
console.log(`Generated stock-data.js with ${records.length} records.`);
