#!/bin/zsh
set -u

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || exit 1

echo "景顺长城沪港深精选股票C 数据更新"
echo "项目目录: $PROJECT_DIR"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js 后再运行。"
  echo "可以从 https://nodejs.org/ 下载。"
  echo
  if [ -t 0 ]; then
    echo "按任意键关闭窗口..."
    read -k 1
  fi
  exit 1
fi

echo "正在从东方财富/天天基金接口更新缺失数据..."
node tools/update-data.mjs
STATUS=$?

echo
if [ "$STATUS" -eq 0 ]; then
  echo "更新完成，正在打开图表页面..."
  open "$PROJECT_DIR/index.html"
else
  echo "更新失败，请查看上面的错误信息。"
fi

if [ -t 0 ]; then
  echo
  echo "按任意键关闭窗口..."
  read -k 1
fi
exit "$STATUS"
