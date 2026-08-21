#!/usr/bin/env bash
# 发布脚本：加密 → 构建校验 → 提交 → 推送
#
# 为什么需要这个脚本：
#   仓库里存的是密文（content-encrypted/），明文只在本地（content/）。
#   直接 git commit 会漏掉「先加密」这一步，导致改动没生效；
#   更糟的是若误把明文加进暂存区，内容会公开且永久留在 git 历史里。
#   本脚本把正确顺序固化下来，并在推送前做防泄露自检。
#
# 用法：
#   ./scripts/publish.sh "post: 今天去了海边"
#
# 密码来源（二者其一）：
#   1. 环境变量 BLOG_PASSWORD
#   2. 项目根目录 .env 文件中写 BLOG_PASSWORD=xxx（该文件已 gitignore）

set -euo pipefail

cd "$(dirname "$0")/.."

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
    echo "用法：./scripts/publish.sh \"提交说明\""
    exit 1
fi

# 读取密码
if [[ -z "${BLOG_PASSWORD:-}" && -f .env ]]; then
    # shellcheck disable=SC1091
    set -a; source .env; set +a
fi
if [[ -z "${BLOG_PASSWORD:-}" ]]; then
    echo "错误：未找到密码。"
    echo "请设置环境变量 BLOG_PASSWORD，或在项目根目录建 .env 写入："
    echo "  BLOG_PASSWORD=你的密码"
    exit 1
fi

echo "==> 1/4 加密文章"
BLOG_PASSWORD="$BLOG_PASSWORD" node scripts/encrypt-content.mjs

echo "==> 2/4 构建校验"
hugo --gc --minify --quiet

echo "==> 3/4 防泄露自检"
# 逐篇取出明文里的一段特征文本，确认它没出现在构建产物中。
# 这是发布前最后一道防线：万一模板改坏导致明文外泄，这里会拦下。
LEAK=0
while IFS= read -r f; do
    # 取正文（跳过 front matter）中第一段足够长的文本作为指纹
    probe=$(awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2 && length($0)>12 {print; exit}' "$f" | head -c 40)
    [[ -z "$probe" ]] && continue
    if grep -rqF "$probe" public/ 2>/dev/null; then
        echo "  !! 明文泄露：$f"
        echo "     泄露片段：$probe"
        LEAK=1
    fi
done < <(grep -rl '^encrypt: true' content/ --include='*.md' 2>/dev/null || true)

if [[ "$LEAK" == "1" ]]; then
    echo
    echo "已中止发布：构建产物中发现加密文章的明文。"
    echo "请检查 layouts/ 下的模板改动，修复后重试。"
    exit 1
fi
echo "  通过：产物中未发现加密文章明文"

echo "==> 4/4 提交并推送"
# 明文目录已 gitignore，此处只会纳入密文与配置
git add -A
if git diff --cached --quiet; then
    echo "  无改动可提交"
    exit 0
fi

# 兜底：确认暂存区没有明文目录（防止 gitignore 被误改）
if git diff --cached --name-only | grep -q '^content/'; then
    echo "  !! 暂存区包含明文目录 content/，已中止。"
    echo "     请检查 .gitignore 是否被修改。"
    git reset
    exit 1
fi

git commit -q -m "$MSG"
git push -q origin main
echo
echo "完成。约 30 秒后线上生效：https://jinyunx.github.io/"
