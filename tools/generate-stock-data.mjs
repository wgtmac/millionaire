import { writeFile } from 'node:fs/promises';

import {
  DEFAULT_STOCK_DATA_PATH,
  generateStockDataScript,
  readFundRecords,
} from './data-store.mjs';

const funds = await readFundRecords();
await writeFile(DEFAULT_STOCK_DATA_PATH, generateStockDataScript(funds), 'utf8');
console.log(
  `Generated stock-data.js with ${funds.length} funds and ${funds.reduce((total, fund) => total + fund.records.length, 0)} records.`,
);
