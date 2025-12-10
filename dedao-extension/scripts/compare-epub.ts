import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { diffLines } from 'diff';

async function compareEpub(refPath: string, genPath: string) {
    console.log(`Comparing EPUBs:\nReference: ${refPath}\nGenerated: ${genPath}\n`);

    if (!fs.existsSync(refPath)) {
        console.error(`Reference file not found: ${refPath}`);
        process.exit(1);
    }
    if (!fs.existsSync(genPath)) {
        console.error(`Generated file not found: ${genPath}`);
        process.exit(1);
    }

    const refData = fs.readFileSync(refPath);
    const genData = fs.readFileSync(genPath);

    const refZip = await JSZip.loadAsync(refData);
    const genZip = await JSZip.loadAsync(genData);

    const refFiles = Object.keys(refZip.files).sort();
    const genFiles = Object.keys(genZip.files).sort();

    // 1. Compare File Structure
    console.log('--- 1. File Structure Comparison ---');
    const missingInGen = refFiles.filter(f => !genFiles.includes(f) && !f.endsWith('/')); // Ignore folder entries if zip treats them differently
    const extraInGen = genFiles.filter(f => !refFiles.includes(f) && !f.endsWith('/'));

    if (missingInGen.length > 0) {
        console.log('Missing files in generated EPUB:', missingInGen);
    } else {
        console.log('No missing files.');
    }

    if (extraInGen.length > 0) {
        console.log('Extra files in generated EPUB:', extraInGen);
    } else {
        console.log('No extra files.');
    }

    // 2. Compare Specific Files Content
    console.log('\n--- 2. Content Comparison ---');
    
    // Check CSS Path
    console.log('Checking CSS location...');
    if (genZip.file('EPUB/css/cover.css')) {
        console.log('PASS: EPUB/css/cover.css exists.');
    } else {
        console.log('FAIL: EPUB/css/cover.css missing.');
    }

    // Check Image Naming
    console.log('Checking Image naming...');
    const genImages = genFiles.filter(f => f.startsWith('EPUB/images/'));
    const hasCorrectImageNaming = genImages.some(f => /image_\d{3}\./.test(path.basename(f)));
    if (hasCorrectImageNaming) {
        console.log('PASS: Image naming follows image_XXX.ext pattern.');
    } else {
        console.log('FAIL: Image naming pattern mismatch.', genImages.slice(0, 5));
    }

    // Compare Chapter Content (Sample)
    // Try to find a common chapter file
    const commonChapter = refFiles.find(f => f.includes('Chapter_1_1') && f.endsWith('.xhtml'));
    if (commonChapter && genZip.file(commonChapter)) {
        console.log(`\nComparing content of ${commonChapter}:`);
        const refContent = await refZip.file(commonChapter)!.async('string');
        const genContent = await genZip.file(commonChapter)!.async('string');

        // Normalize newlines
        const refLines = refContent.replace(/\r\n/g, '\n');
        const genLines = genContent.replace(/\r\n/g, '\n');

        if (refLines === genLines) {
            console.log('PASS: Content is identical.');
        } else {
            console.log('FAIL: Content differs.');
            const diff = diffLines(refLines, genLines);
            let diffCount = 0;
            diff.forEach(part => {
                if (part.added || part.removed) {
                    if (diffCount < 5) { // Show first 5 diffs
                         const prefix = part.added ? '+ ' : '- ';
                         console.log(`${prefix}${part.value.trim().substring(0, 100)}...`);
                    }
                    diffCount++;
                }
            });
            console.log(`Total differences: ${diffCount} chunks.`);
        }
    } else {
        console.log('Skipping chapter content comparison (common chapter not found).');
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/compare-epub.ts <ref.epub> <gen.epub>');
    process.exit(1);
}

compareEpub(args[0], args[1]).catch(err => console.error(err));
