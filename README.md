# 生活记录

基于 [Hugo](https://gohugo.io) + [Stack 主题](https://github.com/CaiJimmy/hugo-theme-stack) 的个人博客。
纯静态站点，托管在免费平台上，**除域名外零成本**。

## 上线前要改的 3 处

1. **`config/_default/hugo.yaml`** → `title`：站点名
2. **`config/_default/params.yaml`** → `sidebar.subtitle`：一句话简介
3. **`content/page/about/index.md`**：自我介绍

`baseURL` 在 GitHub Pages 部署时会被自动覆盖，暂时可以不管；绑了自己域名后再改成域名。

## 日常使用

```bash
# 本地预览（-D 显示草稿）。注意 --contentDir content 指向明文目录，
# 否则预览的是密文版本，加密文章会显示为待解锁状态
hugo server -D --contentDir content

# 新建一篇
hugo new content post/my-first-trip/index.md

# 发布（自动完成：加密 → 构建 → 防泄露自检 → 提交 → 推送）
./scripts/publish.sh "post: 标题"
```

**不要直接 `git commit && git push`** —— 会漏掉加密步骤。始终用 `publish.sh`。

排版、放照片、设封面的完整写法见站内文章《写作速查：这个博客怎么用》
（文件在 `content/post/how-to-write/index.md`，用熟了可以删）。

## 访问密码与文章加密

**进站要输一次密码，之后本次会话浏览任何文章都不再询问。**

- 门禁在 `layouts/_partials/head/custom.html`，全站生效
- 校验方式是拿密码解密哨兵密文 `data/gate.json`（由加密脚本生成），
  不是明文比对 —— 页面上不出现密码
- 通过后密码存入 `sessionStorage`，加密文章读取它自动解密
- 关掉标签页即失效，下次打开重新询问

给任何文章的 front matter 加一行就会加密其正文：

```yaml
encrypt: true
```

不加这行的文章正文是公开的（但仍需过门禁才能浏览页面）。

**加密强度**：正文 AES-256-GCM，密钥由密码经 PBKDF2-SHA256 迭代 60 万次派生。
没有密码在数学上无法还原 —— `curl` 抓页面只能得到 base64 密文。

**仍然公开的部分**：标题、日期、分类、标签（首页需要列出文章）。只有正文加密。
门禁能挡住普通访客看到这些，但爬虫不执行 JS，所以 `robots.txt` 已设为
`Disallow: /` 禁止收录。

**密码存放**：项目根目录 `.env` 里的 `BLOG_PASSWORD`（已 gitignore，权限 600）。
建议同时存进 macOS 钥匙串或密码管理器兜底。页面上只放**提示**不放密码
（配置在 `params.yaml` 的 `encrypt.hint`）—— 站点公开可访问，
写明文密码等于加密失效。

**改密码**：改 `.env` 后重新 `./scripts/publish.sh "chore: 换密码"`，
所有加密文章与门禁哨兵会用新密码重新生成。

**自己被挡在外面时**：浏览器控制台执行
`sessionStorage.setItem('blogPassword','你的密码')` 后刷新。

## 目录结构

```
blog/
├── config/_default/       配置（分文件，改哪块找哪个）
│   ├── hugo.yaml          站点级：地址、标题、语言、URL 结构
│   ├── params.yaml        主题级：侧边栏、加密、音乐、评论
│   ├── menu.yaml          社交链接
│   └── markup.yaml        Markdown 渲染
├── content/               ← 明文，你在这里写。已 gitignore，不进仓库
│   ├── post/              文章，一篇一个文件夹
│   └── page/              固定页：关于 / 归档 / 搜索
├── content-encrypted/     ← 密文，由脚本生成，仓库里存的是这份
├── scripts/
│   ├── encrypt-content.mjs  加密工具
│   └── publish.sh           发布脚本（含防泄露自检）
├── layouts/               覆盖主题的自定义模板
├── assets/img/            头像、favicon
├── assets/music/          背景音乐
├── archetypes/post.md     新文章模板
└── themes/                主题（git submodule，别手改）
```

**明文与密文分离**是这套方案的核心：`content/` 永不进仓库，
仓库里只有 `content-encrypted/`。所以即使仓库公开，正文也不泄露。

**一篇文章一个文件夹**（`post/xxx/index.md`）：照片和正文放在一起，
删文章时图片一并删掉。

## 部署

主题以 git submodule 引入，两个平台都要注意拉取子模块。

### 方案 A：GitHub Pages（`.github/workflows/deploy.yml` 已配好）

1. 在 GitHub 建一个仓库（公开或私有都行），把本目录推上去
2. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**
3. 之后每次 `git push` 自动构建部署，地址 `https://<用户名>.github.io/<仓库名>/`

### 方案 B：Cloudflare Pages（国内访问通常更快）

在 Cloudflare Pages 连接 GitHub 仓库，构建设置填：

| 项 | 值 |
|---|---|
| 构建命令 | `hugo --minify` |
| 输出目录 | `public` |
| 环境变量 | `HUGO_VERSION` = `0.165.0` |

用这个方案的话 `.github/workflows/deploy.yml` 可以删掉。

## 可选增强

- **背景音乐**：把 mp3 放进 `assets/music/`，再把 `params.yaml` 里 `music.enable`
  改成 `true`、`music.file` 改成实际文件名即可。右下角会出现悬浮播放按钮。
  注意浏览器禁止自动播放有声音频（Chrome/Safari 的 Autoplay Policy），
  只能点击触发，这是平台限制无法绕过。细节见 `assets/music/README.txt`。
- **绑自己的域名**：Cloudflare Registrar 按成本价售卖（`.com` 约 70 元/年，无续费溢价）。
  GitHub Pages 需在 `static/CNAME` 里写域名；Cloudflare Pages 在控制台加 Custom domain 即可。
- **评论**：推荐 [giscus](https://giscus.app)（基于 GitHub Discussions，免费无广告），
  配置方法见 `params.yaml` 里 `comments` 一节的注释。
- **访问统计**：Cloudflare Web Analytics 免费、不用 cookie，把它给的一行 script
  放进 `layouts/_partials/head/custom.html` 即可。
- **头像**：图片存为 `assets/img/avatar.png`，然后取消 `params.yaml` 里 `avatar` 那行的注释。

## 备份说明

内容就是这个 Git 仓库里的 Markdown 和图片，不依赖任何平台的数据库。
换托管商只需改一处构建配置，文章永远在自己手里。
