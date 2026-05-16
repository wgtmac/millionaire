# Data Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split chart data into an editable JSON source and add manual plus automatic update commands.

**Architecture:** `data/records.json` becomes the canonical dataset. Node tools read and validate that JSON, merge new records, then regenerate `stock-data.js` so `index.html` still works as a static file. The browser app keeps using `window.STOCK_RECORDS`, so chart rendering remains unchanged.

**Tech Stack:** Static HTML/CSS/JS, Node.js built-in `node:test`, Node.js built-in `fetch`, no third-party dependencies.

---

### Task 1: Canonical Data File

**Files:**
- Create: `/Users/gangwu/Projects/jingshun-ma30-chart/data/records.json`
- Create: `/Users/gangwu/Projects/jingshun-ma30-chart/tools/data-store.mjs`
- Test: `/Users/gangwu/Projects/jingshun-ma30-chart/data-store.test.mjs`

- [ ] **Step 1: Write failing tests for record validation and merging**

Add tests that import `normalizeRecord`, `mergeRecords`, and `readRecordsFromText` from `tools/data-store.mjs`. The tests should prove that records are sorted by date, duplicate dates require explicit overwrite, and malformed records throw useful errors.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test data-store.test.mjs`
Expected: FAIL because `tools/data-store.mjs` does not exist.

- [ ] **Step 3: Implement `tools/data-store.mjs`**

Export functions for validating records, reading JSON text, merging records, and writing pretty JSON. Accept `date`, `nav`, and `change`; coerce numeric strings to numbers; round `nav` to 4 decimals and `change` to 2 decimals.

- [ ] **Step 4: Create `data/records.json`**

Convert the current `stock-data.js` array into JSON using the same records and date order.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test data-store.test.mjs`
Expected: PASS.

### Task 2: Generator

**Files:**
- Create: `/Users/gangwu/Projects/jingshun-ma30-chart/tools/generate-stock-data.mjs`
- Modify: `/Users/gangwu/Projects/jingshun-ma30-chart/stock-data.js`
- Test: `/Users/gangwu/Projects/jingshun-ma30-chart/data-store.test.mjs`

- [ ] **Step 1: Write failing test for browser script generation**

Add a test proving generated JS contains `window.STOCK_RECORDS` data and preserves record values.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test data-store.test.mjs`
Expected: FAIL because `generateStockDataScript` is not exported.

- [ ] **Step 3: Implement generator**

Add `generateStockDataScript(records)` to `tools/data-store.mjs` and CLI script `tools/generate-stock-data.mjs` that writes `stock-data.js` from `data/records.json`.

- [ ] **Step 4: Regenerate `stock-data.js`**

Run: `node tools/generate-stock-data.mjs`
Expected: `stock-data.js` contains generated data matching `data/records.json`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test data-store.test.mjs ma.test.mjs`
Expected: PASS.

### Task 3: Manual Add Command

**Files:**
- Create: `/Users/gangwu/Projects/jingshun-ma30-chart/tools/add-record.mjs`
- Test: `/Users/gangwu/Projects/jingshun-ma30-chart/update-tools.test.mjs`

- [ ] **Step 1: Write failing test for manual add behavior**

Add tests for adding a new record, rejecting duplicates without `--force`, and overwriting duplicates with `--force`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test update-tools.test.mjs`
Expected: FAIL because `tools/add-record.mjs` does not exist.

- [ ] **Step 3: Implement manual add CLI**

Support `node tools/add-record.mjs --date YYYY-MM-DD --nav 5.1234 --change 1.23 [--force]`. After writing JSON, regenerate `stock-data.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test update-tools.test.mjs`
Expected: PASS.

### Task 4: Automatic Update Command

**Files:**
- Create: `/Users/gangwu/Projects/jingshun-ma30-chart/tools/eastmoney-source.mjs`
- Create: `/Users/gangwu/Projects/jingshun-ma30-chart/tools/update-data.mjs`
- Test: `/Users/gangwu/Projects/jingshun-ma30-chart/eastmoney-source.test.mjs`

- [ ] **Step 1: Write failing tests for API parsing and missing-record filtering**

Use fixture JSON shaped like Eastmoney `LSJZList` and prove parsing returns `{ date, nav, change }`. Prove records newer than the local latest date are selected and sorted ascending.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test eastmoney-source.test.mjs`
Expected: FAIL because `tools/eastmoney-source.mjs` does not exist.

- [ ] **Step 3: Implement Eastmoney source module**

Export `parseEastmoneyRecords`, `recordsAfterDate`, and `fetchEastmoneyRecords`. Fetch `https://api.fund.eastmoney.com/f10/lsjz?fundCode=021313&pageIndex=1&pageSize=100&startDate=&endDate=` with browser-like headers.

- [ ] **Step 4: Implement update CLI**

Support `node tools/update-data.mjs [--fund 021313] [--dry-run]`. It reads local records, fetches remote records, merges only missing newer records, regenerates `stock-data.js`, and prints a concise summary.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test eastmoney-source.test.mjs update-tools.test.mjs data-store.test.mjs ma.test.mjs`
Expected: PASS.

### Task 5: Final Verification

**Files:**
- Modify: `/Users/gangwu/Projects/jingshun-ma30-chart/README.md`

- [ ] **Step 1: Add usage documentation**

Create a short README with commands for manual add, automatic update, regeneration, and opening the page.

- [ ] **Step 2: Run full verification**

Run:
`node --test`
`node --check app.js && node --check chart-helpers.js && node --check stock-data.js && node --check tools/data-store.mjs && node --check tools/generate-stock-data.mjs && node --check tools/add-record.mjs && node --check tools/eastmoney-source.mjs && node --check tools/update-data.mjs`

Expected: all commands exit 0.
