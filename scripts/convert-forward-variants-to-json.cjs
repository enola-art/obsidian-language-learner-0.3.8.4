/**
 * 将 ecdict-variants.ts (3.4MB) 中的巨型 Map 转为 JSON 文件
 * 原理同 convert-variants-to-json.cjs
 */

const fs = require('fs');
const path = require('path');

const tsFile = path.join(__dirname, '../src/data/ecdict-variants.ts');
const jsonFile = path.join(__dirname, '../variants.json');

console.log('读取:', tsFile);
const content = fs.readFileSync(tsFile, 'utf-8');

// 提取 new Map([ ... ]) 中的数组内容
const startMarker = 'new Map([';
const endMarker = ']);';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
    console.error('未找到 new Map([...]) 结构');
    process.exit(1);
}

const arrayStart = startIdx + startMarker.length;
const arrayContent = content.substring(arrayStart, endIdx);

// 格式: ['lemma', [{ variant: '...', label: '...', labelZh: '...', pos: '...' }, ...]]
// 这个格式比 reverse 更复杂, 需要解析嵌套对象
// 策略: 逐行提取, 用正则匹配每个顶层条目

// 每个条目的结构:
//   ['lemma', [{ variant: '...', label: '...', labelZh: '...', pos: '...' }, ...]],
const entryPattern = /\['((?:[^'\\]|\\.)*)',\s*\[([\s\S]*?)\]\s*\](?=\s*,|\s*\])/g;

const result = {};
let match;
let count = 0;

while ((match = entryPattern.exec(arrayContent)) !== null) {
    const lemma = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const variantsStr = match[2];

    // 解析变体数组: { variant: '...', label: '...', labelZh: '...', pos: '...' }
    const variantPattern = /\{\s*variant:\s*'((?:[^'\\]|\\.)*)'\s*,\s*label:\s*'([^']*)'\s*,\s*labelZh:\s*'((?:[^'\\]|\\.)*)'\s*,\s*pos:\s*'([^']*)'\s*\}/g;
    const variants = [];
    let vm;
    while ((vm = variantPattern.exec(variantsStr)) !== null) {
        variants.push({
            variant: vm[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
            label: vm[2],
            labelZh: vm[3].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
            pos: vm[4],
        });
    }

    if (variants.length > 0) {
        result[lemma] = variants;
        count++;
    }
}

console.log(`解析到 ${count} 条词条映射`);
console.log('写入:', jsonFile);
fs.writeFileSync(jsonFile, JSON.stringify(result), 'utf-8');

const sizeKB = (fs.statSync(jsonFile).size / 1024).toFixed(1);
console.log(`完成! JSON 文件大小: ${sizeKB} KB`);
