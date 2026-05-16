# 景顺长城沪港深精选股票C 均线图

这是一个可直接打开的静态网页，用来查看基金 `021313` 的净值、30 日均线和可切换的 60 日均线。

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

默认基金代码是 `021313`。需要指定时：

```bash
node tools/update-data.mjs --fund 021313
```

自动数据源当前使用东方财富/天天基金历史净值接口。周末或节假日不会有当天交易净值，工具会更新到接口里最新已发布的交易日。当前接口最早可查到 `2024-04-19`。

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
