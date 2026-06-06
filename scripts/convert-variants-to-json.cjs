/**
 * 将 ecdict-variants-reverse.ts 中的巨型 Map 转为 JSON 文件
 *
 * 目的: 避免 937KB 的数据编译进 main.js (导致 6.5MB bundle)
 * 改为运行时异步加载 JSON
 */

const fs = require('fs');
const path = require('path');

const tsFile = path.join(__dirname, '../src/data/ecdict-variants-reverse.ts');
const jsonFile = path.join(__dirname, '../variants-reverse.json');

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

// 解析所有 ['key', 'value'] 对
// 正则匹配: 可能带缩进的 ['...', '...']
const entryPattern = /\['((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\]/g;
const result = {};
let match;
let count = 0;

while ((match = entryPattern.exec(arrayContent)) !== null) {
    // 解除转义: \' → '   \\ → \
    const key = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const value = match[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    result[key] = value;
    count++;
}

console.log(`解析到 ${count} 条映射`);
console.log('写入:', jsonFile);
fs.writeFileSync(jsonFile, JSON.stringify(result), 'utf-8');

const sizeKB = (fs.statSync(jsonFile).size / 1024).toFixed(1);
console.log(`完成! JSON 文件大小: ${sizeKB} KB`);
