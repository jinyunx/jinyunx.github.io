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
const ITERATIONS = 600000;

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

let encrypted = 0, plain = 0, assets = 0;

for (const src of walk(SRC_DIR)) {
    const rel = relative(SRC_DIR, src);
    const dst = join(OUT_DIR, rel);
    mkdirSync(dirname(dst), { recursive: true });

    // 非 Markdown（图片等）原样拷贝
    if (extname(src).toLowerCase() !== '.md') {
        copyFileSync(src, dst);
        assets++;
        continue;
    }

    const raw = readFileSync(src, 'utf8');
    const { fm, body } = splitFrontMatter(raw);

    // 只加密显式标记 encrypt: true 的文章
    if (readField(fm, 'encrypt') !== 'true') {
        copyFileSync(src, dst);
        plain++;
        continue;
    }

    const payload = await encrypt(body.trim());

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

console.log(`\n完成：加密 ${encrypted} 篇，明文 ${plain} 篇，资源 ${assets} 个`);
console.log(`产物目录：${OUT_DIR}/（供 Hugo 构建，勿手改）`);
