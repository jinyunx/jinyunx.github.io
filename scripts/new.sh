#!/usr/bin/env bash
# 一键新建文章：./scripts/new.sh "文章标题"
#
# 做了什么：
#   1. 用日期生成文件夹和网址短名（post/2026-09-28/），不用想英文名
#   2. 自动填好标题、日期、短名，不带 draft 标记 —— publish 即发布
#   3. 用系统默认编辑器打开文件，直接开写
#
# 写完以后：./scripts/publish.sh

set -euo pipefail
cd "$(dirname "$0")/.."

TITLE="${1:-}"
if [[ -z "$TITLE" ]]; then
    echo "用法：./scripts/new.sh \"文章标题\""
    exit 1
fi

# 网址短名：当天日期；同日多篇则追加 -2、-3
SLUG="$(date +%F)"
N=1
while [[ -e "content/post/$SLUG" ]]; do
    N=$((N + 1))
    SLUG="$(date +%F)-$N"
done

DIR="content/post/$SLUG"
mkdir -p "$DIR"

cat > "$DIR/index.md" <<EOF
---
title: "$TITLE"
slug: "$SLUG"
date: $(date +%Y-%m-%dT%H:%M:%S%z)
---

在这儿开始写。

EOF

echo "已创建：$DIR/index.md"
echo "网址将是：https://jinyunx.github.io/p/$SLUG/"
echo
echo "写完以后运行 ./scripts/publish.sh 即可上线"

# 用系统默认关联程序打开（Typora/VSCode/文本编辑皆可）
open "$DIR/index.md"
