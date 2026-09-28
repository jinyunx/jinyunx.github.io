#!/usr/bin/env node
/**
 * 文章内容加密工具
 *
 * 作用：把 content/post/ 下带 encrypt: true 的文章正文加密，
 *      产出到 content-encrypted/，Hugo 构建这份密文版本。
 *      明文始终留在 content/，不进入构建产物、不上传仓库。
 *
 * 加密方案（与浏览器端 Web Crypto API 对齐）：
 *   密钥派生：PBKDF2-SHA256，60 万次迭代，16 字节随机盐
 *   内容加密：AES-256-GCM，12 字节随机 IV，自带完整性校验
 *
 * 为什么迭代次数拉到 60 万：
 *   密文是公开的，攻击者可离线暴力破解，不受任何速率限制。
 *   高迭代让每次尝试都变慢（本机约 0.3 秒），把字典攻击成本抬高若干个数量级。
 *   但这改变不了「弱密码必被破」的事实 —— 密码强度才是真正的安全边界。
 *
 * 用法：
 *   BLOG_PASSWORD='你的密码' node scripts/encrypt-content.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;

const SRC_DIR = 'content';
const OUT_DIR = 'content-encrypted';
const DATA_DIR = 'data';
const ITERATIONS = 600000;
// 加密文章里的图片也加密：输出 <原名>.enc，二进制格式为
//   [16 字节盐][12 字节 IV][AES-256-GCM 密文]
// 明文图片不进入产物。浏览器端解密脚本（content.html）按同一格式解开。
// 与正文密文共用同一套参数，迭代次数改动时两处必须同步。
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg']);
// 全站门禁的哨兵明文：门禁用密码尝试解密哨兵密文，
// 能解开即密码正确。这样门禁是真校验而非明文比对，
// 且页面上不出现密码本身
const SENTINEL_TEXT = 'blog-gate-ok';

const password = process.env.BLOG_PASSWORD;
if (!password) {
    console.error('错误：未设置 BLOG_PASSWORD 环境变量');
    console.error("用法：BLOG_PASSWORD='你的密码' node scripts/encrypt-content.mjs");
    process.exit(1);
}

// 弱密码直接拒绝 —— 加密方案下密码就是唯一防线
if (password.length < 12) {
    console.error(`错误：密码仅 ${password.length} 位，至少需要 12 位。`);
    console.error('密文对外公开，攻击者可离线无限次尝试，短密码会被字典攻击秒破。');
    process.exit(1);
}

/** 拆分 front matter 与正文。返回 { fm, body }，fm 含首尾的 --- 分隔线 */
function splitFrontMatter(raw) {
    // 仅支持 YAML front matter（本站统一用 ---）
    if (!raw.startsWith('---')) return { fm: '', body: raw };
    const end = raw.indexOf('\n---', 3);
    if (end === -1) return { fm: '', body: raw };
    const fmEnd = raw.indexOf('\n', end + 1) + 1;
    return { fm: raw.slice(0, fmEnd), body: raw.slice(fmEnd) };
}

/** 从 front matter 文本里读一个标量字段（避免为此引入 YAML 依赖） */
function readField(fm, key) {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
}

async function encrypt(plaintext) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const baseKey = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
    );

    const b64 = (u8) => Buffer.from(u8).toString('base64');
    return {
        salt: b64(salt),
        iv: b64(iv),
        data: b64(new Uint8Array(cipher)),
        iterations: ITERATIONS,
    };
}

/** 加密二进制文件，返回 Buffer：[盐 16][IV 12][密文]（与浏览器端约定一致） */
async function encryptBinary(buf) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const baseKey = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new Uint8Array(buf)
    );

    return Buffer.concat([Buffer.from(salt), Buffer.from(iv), Buffer.from(new Uint8Array(cipher))]);
}

/** 把正文里指向本目录图片的引用改写为 .enc 路径（加密前调用）。
 *  只处理本地相对路径且文件确实存在的图片，外链 / 绝对路径不动 */
function rewriteImageRefs(body, dir) {
    const toEnc = (url) => {
        if (/^(https?:)?\/\//.test(url) || url.startsWith('/') || url.startsWith('data:')) return url;
        const name = url.split('/').pop();
        const p = join(dir, name);
        if (!existsSync(p) || !IMAGE_EXTS.has(extname(name).toLowerCase())) return url;
        return url + '.enc';
    };
    return body
        .replace(/!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
            (m, alt, url, title) => `![${alt}](${toEnc(url)}${title})`)
        .replace(/<img([^>]*?\s)src="([^"]+)"/g,
            (m, pre, url) => `<img${pre}src="${toEnc(url)}"`);
}

/** 递归收集所有文件 */
function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

// 每次全量重建，避免删掉的文章在产物里残留
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// 第一遍：找出加密文章所在目录，并记下其封面图文件名。
// 封面图会显示在公开的首页卡片上，即使加密也无法避免公开，
// 因此封面保持明文（在 front matter 里用 image: 指定才有此例外）
const encryptedDirs = new Map(); // dir -> cover 文件名（无则 null）
for (const src of walk(SRC_DIR)) {
    if (extname(src).toLowerCase() !== '.md') continue;
    const raw = readFileSync(src, 'utf8');
    const { fm } = splitFrontMatter(raw);
    if (readField(fm, 'encrypt') === 'true') {
        encryptedDirs.set(dirname(src), readField(fm, 'image'));
    }
}

let encrypted = 0, plain = 0, assets = 0, images = 0;

for (const src of walk(SRC_DIR)) {
    const rel = relative(SRC_DIR, src);
    const dir = dirname(src);
    const encInfo = encryptedDirs.get(dir);

    // 非 Markdown 文件
    if (extname(src).toLowerCase() !== '.md') {
        const name = src.split('/').pop();
        // 加密文章目录里的图片（封面除外）：加密为 .enc，明文不进入产物
        if (encInfo !== undefined && name !== encInfo && IMAGE_EXTS.has(extname(name).toLowerCase())) {
            const dst = join(OUT_DIR, rel) + '.enc';
            mkdirSync(dirname(dst), { recursive: true });
            writeFileSync(dst, await encryptBinary(readFileSync(src)));
            images++;
            console.log(`  加密图片 ${rel}`);
            continue;
        }
        // 其余资源（含封面图、普通文章的图片）原样拷贝
        const dst = join(OUT_DIR, rel);
        mkdirSync(dirname(dst), { recursive: true });
        copyFileSync(src, dst);
        assets++;
        continue;
    }

    const dst = join(OUT_DIR, rel);
    mkdirSync(dirname(dst), { recursive: true });

    const raw = readFileSync(src, 'utf8');
    const { fm, body } = splitFrontMatter(raw);

    // 只加密显式标记 encrypt: true 的文章
    if (readField(fm, 'encrypt') !== 'true') {
        copyFileSync(src, dst);
        plain++;
        continue;
    }

    const payload = await encrypt(rewriteImageRefs(body.trim(), dir));

    // 密文以 front matter 字段形式携带，正文置空。
    // 正文留空是关键：这样 .Content / .Summary / .Plain 全都取不到原文，
    // 搜索索引、meta description、RSS 自然也拿不到明文。
    const extra =
        `encrypted_salt: "${payload.salt}"\n` +
        `encrypted_iv: "${payload.iv}"\n` +
        `encrypted_data: "${payload.data}"\n` +
        `encrypted_iterations: ${payload.iterations}\n`;

    // 插到 front matter 结束分隔线之前
    const lines = fm.trimEnd().split('\n');
    lines.pop(); // 去掉结尾的 ---
    const newFm = lines.join('\n') + '\n' + extra + '---\n';

    writeFileSync(dst, newFm);
    encrypted++;
    console.log(`  加密 ${rel}`);
}

console.log(`\n完成：加密 ${encrypted} 篇，明文 ${plain} 篇，加密图片 ${images} 个，明文资源 ${assets} 个`);

// 生成全站门禁用的哨兵密文，供模板读取（data/gate.json）。
// 门禁拿用户输入的密码去解密它，能解开就放行 —— 真校验，
// 且不需要在页面上放密码或密码哈希之外的任何线索。
mkdirSync(DATA_DIR, { recursive: true });
const sentinel = await encrypt(SENTINEL_TEXT);
writeFileSync(
    join(DATA_DIR, 'gate.json'),
    JSON.stringify({ ...sentinel, probe: SENTINEL_TEXT }, null, 2) + '\n'
);
console.log(`门禁哨兵：${DATA_DIR}/gate.json`);
console.log(`产物目录：${OUT_DIR}/（供 Hugo 构建，勿手改）`);
