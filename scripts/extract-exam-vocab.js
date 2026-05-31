const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/ecdict-sqlite-28/ecdict.db');
const outputPath = path.join(__dirname, '../src/data/exam-vocab.ts');
const fileBuffer = fs.readFileSync(dbPath);

// ECDICT tag → 内部级别key 映射
const TAG_MAP = {
    'zk': 'hs',      // 初中 → hs(高中，合并处理)
    'gk': 'hs',      // 高中 → hs
    'cet4': 'cet4',
    'cet6': 'cet6',
    'ky': 'kaoyan',  // 考研 → kaoyan
    'ielts': 'ielts',
    'toefl': 'toefl',
    'gre': 'gre',
};

// 我们关心的目标级别（按优先级从高到低）
const LEVELS = ['gre', 'toefl', 'ielts', 'cet6', 'cet4', 'kaoyan', 'hs'];

async function main() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(fileBuffer);

    console.log('正在查询所有带标签的词条...');

    // 查询所有有tag的单词
    const result = db.exec("SELECT word, tag FROM stardict WHERE tag != '' AND tag IS NOT NULL");
    if (!result.length || !result[0].values.length) {
        console.error('没有找到数据！');
        db.close();
        return;
    }

    const rows = result[0].values;
    console.log(`共 ${rows.length} 条带标签记录`);

    // 构建 word → levels[] 映射
    const wordMap = new Map(); // word(lower) → Set<levelKey>
    let totalTags = 0;

    for (const [word, tagStr] of rows) {
        const lower = word.toLowerCase().trim();
        if (!lower || lower.length > 60) continue;

        const tags = tagStr.split(/\s+/).filter(Boolean);
        const matchedLevels = [];

        for (const t of tags) {
            const mapped = TAG_MAP[t];
            if (mapped && !matchedLevels.includes(mapped)) {
                matchedLevels.push(mapped);
            }
        }

        if (matchedLevels.length > 0) {
            // 按优先级排序（高级别在前）
            matchedLevels.sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));
            wordMap.set(lower, matchedLevels);
            totalTags += matchedLevels.length;
        }
    }

    console.log(`唯一词汇数: ${wordMap.size}`);
    console.log(`总标签分配数: ${totalTags}`);

    // 统计各级别词数
    const stats = {};
    for (const lvl of LEVELS) stats[lvl] = 0;
    for (const [, levels] of wordMap) {
        for (const l of levels) stats[l]++;
    }
    console.log('\n各级别统计:');
    for (const lvl of LEVELS) {
        console.log(`  ${lvl}: ${stats[lvl]}`);
    }

    // 生成 TypeScript 文件
    console.log('\n正在生成 exam-vocab.ts ...');

    const lines = [
        '/**',
        ' * 自动生成文件 - 来源于 ECDICT (ecdict-sqlite-28)',
        ' * 各考试级别词汇表，用于自动检测单词所属级别',
        ' * 生成时间: ' + new Date().toISOString(),
        ' */',
        '',
        'import type { ExamLevelKey } from \'../utils/exam-levels\';',
        '',
        '/**',
        ' * 单词 → 考试级别映射表',
        ' * key: 单词小写, value: 该词所属的所有级别数组（按优先级排序）',
        ' */',
        'export const EXAM_VOCAB_MAP: ReadonlyMap<string, ExamLevelKey[]> = new Map([',
    ];

    // 按 word 排序输出，保证稳定性
    const sortedWords = [...wordMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [word, levels] of sortedWords) {
        const levelsStr = levels.map(l => `'${l}'`).join(', ');
        lines.push(`  ['${escapeStr(word)}', [${levelsStr}]],`);
    }

    lines.push(']);');
    lines.push('');
    lines.push('/**');
    lines.push(' * 查询单词的最高考试级别（优先返回更高级别）');
    lines.push(' * @param word 待查单词（会自动转小写）');
    lines.push(' * @returns 最高级别key，未找到返回 null');
    lines.push(' */');
    lines.push('export function getWordExamLevel(word: string): ExamLevelKey | null {');
    lines.push('  const levels = EXAM_VOCAB_MAP.get(word.toLowerCase().trim());');
    lines.push('  return levels ? levels[0] : null;');
    lines.push('}');
    lines.push('');
    lines.push('/**');
    lines.push(' * 查询单词的所有考试级别');
    lines.push(' */');
    lines.push('export function getWordExamLevels(word: string): ExamLevelKey[] {');
    lines.push('  return EXAM_VOCAB_MAP.get(word.toLowerCase().trim()) ?? [];');
    lines.push('}');
    lines.push('');
    lines.push('/** 快捷：检查单词是否属于指定级别 */');
    lines.push('export function isWordInLevel(word: string, level: ExamLevelKey): boolean {');
    lines.push('  return EXAM_VOCAB_MAP.get(word.toLowerCase().trim())?.includes(level) ?? false;');
    lines.push('}');
    lines.push('');
    lines.push(`// 总计 ${wordMap.size} 个词汇`);

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

    const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`✅ 生成完成: ${outputPath}`);
    console.log(`   文件大小: ${fileSizeKB} KB`);
    console.log(`   词汇数量: ${wordMap.size}`);

    db.close();
}

function escapeStr(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

main().catch(console.error);
