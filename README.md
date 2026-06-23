# 基金均线图

这是一个可直接打开的静态网页，用来分页查看基金 `000979`、`016858`、`009478` 的净值、30 日均线和可切换的 60 日均线。

## 打开页面

双击打开：

```bash
open /Users/gangwu/Projects/jingshun-ma30-chart/index.html
```

## 最简单更新方式

在 Finder 里双击项目根目录下的：

```bash
update.command
```

它会自动执行数据更新，更新完成后打开图表页面。这个方式不需要启动服务，也不会定时后台运行。

如果 macOS 提示无法打开，可以在终端里运行一次：

```bash
cd /Users/gangwu/Projects/jingshun-ma30-chart
chmod +x update.command
./update.command
```

运行依赖只有 Node.js。可以用下面命令检查是否已安装：

```bash
node --version
```

## 数据文件

原始净值数据维护在：

```bash
data/records.json
```

网页实际读取的是：

```bash
stock-data.js
```

每次更新 `data/records.json` 后，工具会自动重新生成 `stock-data.js`。如果只想手动重新生成一次，可以运行：

```bash
node tools/generate-stock-data.mjs
```

## 人工添加某一天

```bash
node tools/add-record.mjs --date 2026-05-18 --nav 5.1234 --change 1.23
```

默认补到 `000979`。需要指定基金时：

```bash
node tools/add-record.mjs --fund 016858 --date 2026-05-18 --nav 5.1234 --change 1.23
```

如果日期已经存在，默认会拒绝覆盖。确认要覆盖时加 `--force`：

```bash
node tools/add-record.mjs --date 2026-05-18 --nav 5.1234 --change 1.23 --force
```

## 自动补缺失数据

日常推荐直接双击 `update.command`。如果你想用命令行，先预览会添加多少条：


```bash
node tools/update-data.mjs --dry-run
```

确认后自动补齐本地最后日期之后的已发布数据：

```bash
node tools/update-data.mjs
```

回填某个日期之后的历史数据，并用接口数据覆盖同日旧值：

```bash
node tools/update-data.mjs --since 2024-04-19
```

回填近三年的可用历史数据：

```bash
node tools/update-data.mjs --backfill-years 3
```

默认会更新页面展示的三只基金：`000979`、`016858`、`009478`。需要只更新单只基金时：

```bash
node tools/update-data.mjs --fund 016858
```

自动数据源当前使用东方财富/天天基金历史净值接口。周末或节假日不会有当天交易净值，工具会更新到接口里最新已发布的交易日。当前接口最早可查到 `2024-04-19`。

## GitHub Pages 自动更新

仓库里已经包含 GitHub Actions 工作流：

```bash
.github/workflows/update-fund-data.yml
```

它会在每天北京时间 `23:37` 自动运行。GitHub Actions 的 cron 使用 UTC，所以配置里写的是 `15:37 UTC`：

```bash
node tools/update-data.mjs
```

如果 `data/records.json` 或 `stock-data.js` 有变化，工作流会自动提交并推送。GitHub Pages 如果设置为从 `main` 分支根目录发布，就会随着这次推送自动刷新网页。

首次上传到 GitHub 后，需要检查两处设置：

1. `Settings` -> `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`

2. `Settings` -> `Actions` -> `General`
   - Workflow permissions: `Read and write permissions`

也可以手动触发一次更新：

1. 打开 GitHub 仓库的 `Actions` 页面
2. 选择 `Update fund data`
3. 点击 `Run workflow`

说明：GitHub Actions 的定时任务可能会有几分钟延迟。当前数据源通常在交易日北京时间 `16:00` 到 `23:00` 更新当日净值，所以工作流安排在北京时间 `23:37`。

## 验证

```bash
node --test
node --check app.js
node --check chart-helpers.js
node --check stock-data.js
node --check tools/data-store.mjs
node --check tools/generate-stock-data.mjs
node --check tools/add-record.mjs
node --check tools/eastmoney-source.mjs
node --check tools/update-data.mjs
```
