/**
 * 将 exam-vocab.ts 中的 EXAM_VOCAB_MAP 提取为 JSON 文件
 *
 * 产物: exam-vocab.json
 * 用法: node scripts/convert-exam-vocab-to-json.cjs
 */

const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'src', 'data', 'exam-vocab.ts');
const outPath = path.join(__dirname, '..', 'exam-vocab.json');

const content = fs.readFileSync(srcPath, 'utf-8');

// 提取 "new Map([ ... ]);" 中的数组部分
const match = content.match(/export const EXAM_VOCAB_MAP[\s\S]*?= new Map\(\[([\s\S]*?)\]\);/);
if (!match) {
    console.error('错误: 无法在 exam-vocab.ts 中找到 EXAM_VOCAB_MAP');
    process.exit(1);
}

// 构造合法 JSON 数组
const arrayStr = '[' + match[1] + ']';
const entries = eval(arrayStr);

// 转为普通对象
const obj = {};
for (const [key, value] of entries) {
    obj[key] = value;
}

fs.writeFileSync(outPath, JSON.stringify(obj));
console.log(`✅ 成功: 写入 ${Object.keys(obj).length} 条词级映射 → ${outPath}`);
console.log(`   文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
