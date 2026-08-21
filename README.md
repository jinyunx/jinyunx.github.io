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
# 本地预览（-D 表示显示草稿），改文件自动刷新
hugo server -D

# 新建一篇
hugo new content post/my-first-trip/index.md

# 发布
git add . && git commit -m "post: 标题" && git push
```

排版、放照片、设封面的完整写法见站内文章《写作速查：这个博客怎么用》
（文件在 `content/post/how-to-write/index.md`，用熟了可以删）。

## 目录结构

```
blog/
├── config/_default/       配置（分文件，改哪块找哪个）
│   ├── hugo.yaml          站点级：地址、标题、语言、URL 结构
│   ├── params.yaml        主题级：侧边栏、评论、图片处理
│   ├── menu.yaml          社交链接
│   └── markup.yaml        Markdown 渲染
├── content/
│   ├── post/              ← 文章都放这儿，一篇一个文件夹
│   └── page/              固定页：关于 / 归档 / 搜索
├── assets/img/            头像、favicon 放这里
├── static/                原样拷贝的文件（如 CNAME、robots）
├── archetypes/post.md     新文章模板
└── themes/                主题（git submodule，别手改）
```

**一篇文章一个文件夹**（`post/xxx/index.md`）是刻意的：照片和正文放在一起，
删文章时图片一并删掉，仓库不会堆积孤儿图片。

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
