#!/usr/bin/env npx tsx
/**
 * EPUB 对比测试脚本 (增强版)
 * 
 * 对比 Go 生成的 EPUB 和 JS 生成的 EPUB，提供标准化的差异报告
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import * as Diff from 'diff';

// ============================================
// 工具函数
// ============================================

function sha256(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function unzipToDir(epubPath: string, outputDir: string): void {
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    try {
        execSync(`unzip -q "${epubPath}" -d "${outputDir}"`);
    } catch (e) {
        // Ignore unzip errors for non-existent files if we handle them later
    }
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
    if (!fs.existsSync(dir)) return [];
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath, baseDir));
        } else {
            files.push(path.relative(baseDir, fullPath));
        }
    }
    return files.sort();
}

/**
 * 规范化 HTML/XML 内容以进行结构化对比
 */
function normalizeXml(content: string): string {
    return content
        .replace(/>\s+</g, '><') // 移除标签间的空白
        .replace(/\s+/g, ' ')    // 合并连续空白
        .replace(/ xmlns:[^=]+="[^"]*"/g, '') // 移除命名空间定义
        .replace(/ epub:type="[^"]*"/g, '')   // 移除 epub 类型
        .trim();
}

// ============================================
// 差异检测
// ============================================

interface FileDiff {
    file: string;
    type: 'missing_in_js' | 'missing_in_go' | 'content_diff' | 'binary_diff';
    details?: string;
}

interface CompareResult {
    goHash: string;
    jsHash: string;
    goFileCount: number;
    jsFileCount: number;
    diffs: FileDiff[];
    identical: boolean;
}

function compareEpubs(goDir: string, jsDir: string): CompareResult {
    const goFiles = getAllFiles(goDir);
    const jsFiles = getAllFiles(jsDir);
    
    const goSet = new Set(goFiles);
    const jsSet = new Set(jsFiles);
    
    const diffs: FileDiff[] = [];
    
    for (const file of goFiles) {
        if (!jsSet.has(file)) {
            diffs.push({ file, type: 'missing_in_js' });
        }
    }
    
    for (const file of jsFiles) {
        if (!goSet.has(file)) {
            diffs.push({ file, type: 'missing_in_go' });
        }
    }
    
    const commonFiles = goFiles.filter(f => jsSet.has(f));
    for (const file of commonFiles) {
        const goPath = path.join(goDir, file);
        const jsPath = path.join(jsDir, file);
        
        const goContent = fs.readFileSync(goPath);
        const jsContent = fs.readFileSync(jsPath);
        
        if (!goContent.equals(jsContent)) {
            const isText = file.endsWith('.xml') || file.endsWith('.xhtml') || 
                          file.endsWith('.html') || file.endsWith('.css') ||
                          file.endsWith('.opf') || file.endsWith('.ncx');
            
            if (isText) {
                const goText = goContent.toString('utf-8');
                const jsText = jsContent.toString('utf-8');
                
                // 再次尝试规范化后对比
                if (normalizeXml(goText) !== normalizeXml(jsText)) {
                    const diffDetails = generateDetailedDiff(goText, jsText, file);
                    diffs.push({ file, type: 'content_diff', details: diffDetails });
                }
            } else {
                diffs.push({ 
                    file, 
                    type: 'binary_diff',
                    details: `Go: ${goContent.length} bytes, JS: ${jsContent.length} bytes`
                });
            }
        }
    }
    
    return {
        goHash: '', 
        jsHash: '',
        goFileCount: goFiles.length,
        jsFileCount: jsFiles.length,
        diffs,
        identical: diffs.length === 0
    };
}

function generateDetailedDiff(oldStr: string, newStr: string, filename: string): string {
    const diff = Diff.diffLines(oldStr, newStr);
    const result: string[] = [];
    let diffCount = 0;
    const MAX_CHUNKS = 5;

    diff.forEach((part) => {
        if (part.added || part.removed) {
            if (diffCount < MAX_CHUNKS) {
                const prefix = part.added ? '+ ' : '- ';
                const color = part.added ? '\x1b[32m' : '\x1b[31m';
                const reset = '\x1b[0m';
                result.push(`${color}${prefix}${part.value.substring(0, 200).trim()}${part.value.length > 200 ? '...' : ''}${reset}`);
            }
            diffCount++;
        }
    });

    if (diffCount > MAX_CHUNKS) {
        result.push(`\x1b[33m... 还有 ${diffCount - MAX_CHUNKS} 处差异\x1b[0m`);
    }

    return result.join('\n');
}

// ============================================
// 报告生成
// ============================================

function printReport(result: CompareResult, goPath: string, jsPath: string): void {
    console.log('\n' + '='.repeat(60));
    console.log('EPUB 对比报告 (结构化)');
    console.log('='.repeat(60));
    
    console.log(`\nGo EPUB: ${goPath}`);
    console.log(`JS EPUB: ${jsPath}`);
    
    console.log(`\n--- 统计 ---`);
    console.log(`Go 文件数: ${result.goFileCount}`);
    console.log(`JS 文件数: ${result.jsFileCount}`);
    console.log(`Hash 一致: ${result.goHash === result.jsHash ? '\x1b[32m✓ 是\x1b[0m' : '\x1b[31m✗ 否\x1b[0m'}`);
    
    if (result.identical) {
        console.log('\n\x1b[32m✓✓✓ 核心内容完全一致！\x1b[0m\n');
        return;
    }
    
    console.log(`\n--- 差异项 (${result.diffs.length}) ---`);
    
    const groups = {
        missing_in_js: result.diffs.filter(d => d.type === 'missing_in_js'),
        missing_in_go: result.diffs.filter(d => d.type === 'missing_in_go'),
        binary_diff: result.diffs.filter(d => d.type === 'binary_diff'),
        content_diff: result.diffs.filter(d => d.type === 'content_diff'),
    };

    if (groups.missing_in_js.length) {
        console.log(`\n[JS 缺失]`);
        groups.missing_in_js.forEach(d => console.log(`  - ${d.file}`));
    }
    if (groups.missing_in_go.length) {
        console.log(`\n[Go 缺失]`);
        groups.missing_in_go.forEach(d => console.log(`  - ${d.file}`));
    }
    if (groups.binary_diff.length) {
        console.log(`\n[二进制差异]`);
        groups.binary_diff.forEach(d => console.log(`  - ${d.file}: ${d.details}`));
    }
    if (groups.content_diff.length) {
        console.log(`\n[内容差异]`);
        groups.content_diff.forEach(d => {
            console.log(`\n  文件: ${d.file}`);
            console.log(d.details);
        });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
}

// ============================================
// 主函数
// ============================================

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log(`用法: npx tsx scripts/compare-with-go.ts <go-epub> <js-epub>`);
        process.exit(1);
    }
    
    const goEpubPath = path.resolve(args[0]);
    const jsEpubPath = path.resolve(args[1]);
    
    if (!fs.existsSync(goEpubPath)) throw new Error(`Go EPUB not found: ${goEpubPath}`);
    if (!fs.existsSync(jsEpubPath)) throw new Error(`JS EPUB not found: ${jsEpubPath}`);
    
    const tempDir = path.resolve(__dirname, '../.compare-temp');
    const goDir = path.join(tempDir, 'go');
    const jsDir = path.join(tempDir, 'js');
    
    console.log('正在解压并对比...');
    unzipToDir(goEpubPath, goDir);
    unzipToDir(jsEpubPath, jsDir);
    
    const result = compareEpubs(goDir, jsDir);
    result.goHash = sha256(fs.readFileSync(goEpubPath));
    result.jsHash = sha256(fs.readFileSync(jsEpubPath));
    
    printReport(result, goEpubPath, jsEpubPath);
    process.exit(result.identical ? 0 : 1);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
