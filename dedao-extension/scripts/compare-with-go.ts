#!/usr/bin/env npx tsx
/**
 * EPUB 对比测试脚本
 * 
 * 对比 Go 生成的 EPUB 和 JS 生成的 EPUB，输出差异报告
 * 
 * 用法:
 *   npx tsx scripts/compare-with-go.ts <go-epub-path> <js-epub-path>
 *   npx tsx scripts/compare-with-go.ts --generate <bookId> <enid>  # 先生成再对比
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';

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
    execSync(`unzip -q "${epubPath}" -d "${outputDir}"`);
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
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

function readFileContent(basePath: string, relativePath: string): string {
    const fullPath = path.join(basePath, relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
}

function readFileBinary(basePath: string, relativePath: string): Buffer {
    const fullPath = path.join(basePath, relativePath);
    return fs.readFileSync(fullPath);
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
    
    // 检查 Go 有但 JS 没有的文件
    for (const file of goFiles) {
        if (!jsSet.has(file)) {
            diffs.push({ file, type: 'missing_in_js' });
        }
    }
    
    // 检查 JS 有但 Go 没有的文件
    for (const file of jsFiles) {
        if (!goSet.has(file)) {
            diffs.push({ file, type: 'missing_in_go' });
        }
    }
    
    // 对比共有文件的内容
    const commonFiles = goFiles.filter(f => jsSet.has(f));
    for (const file of commonFiles) {
        const goContent = readFileBinary(goDir, file);
        const jsContent = readFileBinary(jsDir, file);
        
        if (!goContent.equals(jsContent)) {
            // 判断是文本还是二进制
            const isText = file.endsWith('.xml') || file.endsWith('.xhtml') || 
                          file.endsWith('.html') || file.endsWith('.css') ||
                          file.endsWith('.opf') || file.endsWith('.ncx');
            
            if (isText) {
                const goText = goContent.toString('utf-8');
                const jsText = jsContent.toString('utf-8');
                const diffDetails = generateTextDiff(goText, jsText, file);
                diffs.push({ file, type: 'content_diff', details: diffDetails });
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
        goHash: '', // 将在主函数中计算
        jsHash: '',
        goFileCount: goFiles.length,
        jsFileCount: jsFiles.length,
        diffs,
        identical: diffs.length === 0
    };
}

function generateTextDiff(goText: string, jsText: string, filename: string): string {
    const goLines = goText.split('\n');
    const jsLines = jsText.split('\n');
    
    const diffs: string[] = [];
    const maxLines = Math.max(goLines.length, jsLines.length);
    let diffCount = 0;
    const MAX_DIFFS = 10; // 只显示前10个差异
    
    for (let i = 0; i < maxLines && diffCount < MAX_DIFFS; i++) {
        const goLine = goLines[i] || '';
        const jsLine = jsLines[i] || '';
        
        if (goLine !== jsLine) {
            diffCount++;
            diffs.push(`  行 ${i + 1}:`);
            if (goLine) diffs.push(`    Go: ${goLine.substring(0, 100)}${goLine.length > 100 ? '...' : ''}`);
            if (jsLine) diffs.push(`    JS: ${jsLine.substring(0, 100)}${jsLine.length > 100 ? '...' : ''}`);
        }
    }
    
    if (diffCount >= MAX_DIFFS) {
        diffs.push(`  ... 还有更多差异 (Go: ${goLines.length} 行, JS: ${jsLines.length} 行)`);
    }
    
    return diffs.join('\n');
}

// ============================================
// 报告生成
// ============================================

function printReport(result: CompareResult, goPath: string, jsPath: string): void {
    console.log('\n' + '='.repeat(60));
    console.log('EPUB 对比报告');
    console.log('='.repeat(60));
    
    console.log(`\nGo EPUB: ${goPath}`);
    console.log(`JS EPUB: ${jsPath}`);
    
    console.log(`\n--- 文件统计 ---`);
    console.log(`Go 文件数: ${result.goFileCount}`);
    console.log(`JS 文件数: ${result.jsFileCount}`);
    
    console.log(`\n--- Hash 对比 ---`);
    console.log(`Go EPUB SHA256: ${result.goHash}`);
    console.log(`JS EPUB SHA256: ${result.jsHash}`);
    console.log(`Hash 一致: ${result.goHash === result.jsHash ? '✓ 是' : '✗ 否'}`);
    
    if (result.identical) {
        console.log('\n✓✓✓ EPUB 内容完全一致！ ✓✓✓\n');
        return;
    }
    
    console.log(`\n--- 差异详情 (${result.diffs.length} 处) ---`);
    
    // 按类型分组
    const missingInJs = result.diffs.filter(d => d.type === 'missing_in_js');
    const missingInGo = result.diffs.filter(d => d.type === 'missing_in_go');
    const contentDiffs = result.diffs.filter(d => d.type === 'content_diff');
    const binaryDiffs = result.diffs.filter(d => d.type === 'binary_diff');
    
    if (missingInJs.length > 0) {
        console.log(`\n[JS 缺失的文件] (${missingInJs.length} 个)`);
        missingInJs.forEach(d => console.log(`  - ${d.file}`));
    }
    
    if (missingInGo.length > 0) {
        console.log(`\n[Go 缺失的文件] (${missingInGo.length} 个)`);
        missingInGo.forEach(d => console.log(`  - ${d.file}`));
    }
    
    if (binaryDiffs.length > 0) {
        console.log(`\n[二进制文件差异] (${binaryDiffs.length} 个)`);
        binaryDiffs.forEach(d => console.log(`  - ${d.file}: ${d.details}`));
    }
    
    if (contentDiffs.length > 0) {
        console.log(`\n[文本内容差异] (${contentDiffs.length} 个)`);
        contentDiffs.forEach(d => {
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
        console.log(`
用法:
  npx tsx scripts/compare-with-go.ts <go-epub-path> <js-epub-path>
  
示例:
  npx tsx scripts/compare-with-go.ts "131902_庄子_庄子 著；孙雍长 译注.epub" dedao_131902.epub
`);
        process.exit(1);
    }
    
    const goEpubPath = path.resolve(args[0]);
    const jsEpubPath = path.resolve(args[1]);
    
    // 检查文件存在
    if (!fs.existsSync(goEpubPath)) {
        console.error(`错误: Go EPUB 不存在: ${goEpubPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(jsEpubPath)) {
        console.error(`错误: JS EPUB 不存在: ${jsEpubPath}`);
        process.exit(1);
    }
    
    // 创建临时目录
    const tempDir = path.resolve(__dirname, '../.compare-temp');
    const goDir = path.join(tempDir, 'go');
    const jsDir = path.join(tempDir, 'js');
    
    console.log('解压 EPUB 文件...');
    unzipToDir(goEpubPath, goDir);
    unzipToDir(jsEpubPath, jsDir);
    
    console.log('对比文件内容...');
    const result = compareEpubs(goDir, jsDir);
    
    // 计算整体 hash
    result.goHash = sha256(fs.readFileSync(goEpubPath));
    result.jsHash = sha256(fs.readFileSync(jsEpubPath));
    
    // 输出报告
    printReport(result, goEpubPath, jsEpubPath);
    
    // 清理临时目录（可选，保留用于调试）
    // fs.rmSync(tempDir, { recursive: true });
    
    // 返回退出码
    process.exit(result.identical ? 0 : 1);
}

main().catch(e => {
    console.error('错误:', e);
    process.exit(1);
});

