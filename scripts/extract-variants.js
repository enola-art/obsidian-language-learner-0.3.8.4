const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/ecdict-sqlite-28/ecdict.db');
const outputPath = path.join(__dirname, '../src/data/ecdict-variants.ts');
const outputPathReverse = path.join(__dirname, '../src/data/ecdict-variants-reverse.ts');
const fileBuffer = fs.readFileSync(dbPath);

// 支持所有词性变体
const PREFIX_MAP = {
    'p': { label: 'ed',    labelZh: '过去式',        pos: 'v.' },
    'd': { label: 'ed',    labelZh: '过去分词',      pos: 'v.' },
    'i': { label: 'ing',   labelZh: '现在分词',      pos: 'v.' },
    '3': { label: '3sg',   labelZh: '第三人称单数',   pos: 'v.' },
    's': { label: 'pl',    labelZh: '名词复数',       pos: 'n.' },
    'r': { label: 'er',    labelZh: '比较级',         pos: 'a.' },
    't': { label: 'est',   labelZh: '最高级',         pos: 'a.' },
};

// 判断是否为规则名词复数（如 book→books, car→cars 可由规则推导）
function isRegularPlural(word, plural) {
    if (!plural.endsWith('s')) return false;
    const base = plural.replace(/ses?$/i, '').replace(/ies$/i, 'y').replace(/ves$/i, 'f').replace(/ves$/i, 'fe');
    if (word === base) return true;
    // 直接 +s 或 +es 的情况
    if (plural.toLowerCase() === word.toLowerCase() + 's') return true;
    if (plural.toLowerCase() === word.toLowerCase() + 'es') return true;
    // y → ies
    if (word.toLowerCase().endsWith('y') && plural.toLowerCase() === word.toLowerCase().slice(0, -1) + 'ies') return true;
    // f/fe → ves
    if ((word.toLowerCase().endsWith('f') || word.toLowerCase().endsWith('fe')) && plural.toLowerCase().startsWith(word.toLowerCase().slice(0, -1)) && plural.toLowerCase().endsWith('ves')) return true;
    return false;
}

function parseExchange(exchangeStr, lemma) {
    if (!exchangeStr || typeof exchangeStr !== 'string') return [];
    const variants = [];
    const parts = exchangeStr.split('/');
    for (const part of parts) {
        if (!part || part.length < 2) continue;
        const colonIdx = part.indexOf(':');
        if (colonIdx < 1 || colonIdx >= part.length - 1) continue;
        const prefix = part[0];
        const info = PREFIX_MAP[prefix];
        if (!info) continue;
        const variant = part.slice(colonIdx + 1).trim();
        if (!variant || variant.length < 2) continue;
        if (!/^[a-zA-Z]/.test(variant)) continue;

        // 名词复数(s): 只保留不规则形式，规则复数跳过（可由代码生成）
        if (prefix === 's' && isRegularPlural(lemma, variant)) continue;

        variants.push({
            variant: variant.toLowerCase(),
            label: info.label,
            labelZh: info.labelZh,
            pos: info.pos,
        });
    }
    return variants;
}

async function main() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(fileBuffer);

    console.log('正在从 ECDICT 提取变体数据...');
    console.log('  动词(p/d/i/3): 全部保留');
    console.log('  名词复数(s): 仅保留不规则形式');
    console.log('  形容词(r/t): 全部保留');

    const result = db.exec(
        "SELECT word, exchange FROM stardict " +
        "WHERE exchange IS NOT NULL AND exchange != '' " +
        "AND (word LIKE 'a%' OR word LIKE 'b%' OR word LIKE 'c%' OR word LIKE 'd%' OR " +
        "word LIKE 'e%' OR word LIKE 'f%' OR word LIKE 'g%' OR word LIKE 'h%' OR " +
        "word LIKE 'i%' OR word LIKE 'j%' OR word LIKE 'k%' OR word LIKE 'l%' OR " +
        "word LIKE 'm%' OR word LIKE 'n%' OR word LIKE 'o%' OR word LIKE 'p%' OR " +
        "word LIKE 'q%' OR word LIKE 'r%' OR word LIKE 's%' OR word LIKE 't%' OR " +
        "word LIKE 'u%' OR word LIKE 'v%' OR word LIKE 'w%' OR word LIKE 'x%' OR " +
        "word LIKE 'y%' OR word LIKE 'z%' OR word LIKE 'A%' OR word LIKE 'B%' OR " +
        "word LIKE 'C%' OR word LIKE 'D%' OR word LIKE 'E%' OR word LIKE 'F%' OR " +
        "word LIKE 'G%' OR word LIKE 'H%' OR word LIKE 'I%' OR word LIKE 'J%' OR " +
        "word LIKE 'K%' OR word LIKE 'L%' OR word LIKE 'M%' OR word LIKE 'N%' OR " +
        "word LIKE 'O%' OR word LIKE 'P%' OR word LIKE 'Q%' OR word LIKE 'R%' OR " +
        "word LIKE 'S%' OR word LIKE 'T%' OR word LIKE 'U%' OR word LIKE 'V%' OR " +
        "word LIKE 'W%' OR word LIKE 'X%' OR word LIKE 'Y%' OR word LIKE 'Z%')"
    );

    if (!result.length || !result[0].values.length) {
        console.error('没有找到数据！');
        db.close();
        return;
    }

    const rows = result[0].values;
    console.log(`\n共 ${rows.length} 条原始记录`);

    const lemmaMap = new Map();
    const reverseMap = new Map();
    let totalVariants = 0;
    let skippedRegularPlurals = 0;

    for (let idx = 0; idx < rows.length; idx++) {
        const [word, exchange] = rows[idx];
        const lower = String(word).toLowerCase().trim();
        if (!lower || lower.length > 60) continue;

        const variants = parseExchange(String(exchange), lower);
        if (variants.length === 0) continue;

        lemmaMap.set(lower, variants);
        totalVariants += variants.length;

        for (const v of variants) {
            if (v.variant !== lower && !reverseMap.has(v.variant)) {
                reverseMap.set(v.variant, lower);
            }
        }
    }

    console.log(`\n唯一词条数: ${lemmaMap.size}`);
    console.log(`总变体数: ${totalVariants}`);
    console.log(`反向索引条目: ${reverseMap.size}`);

    for (const w of ['call', 'consider', 'work', 'go', 'book', 'car', 'child', 'man', 'big', 'good', 'happy']) {
        const v = lemmaMap.get(w);
        console.log(`  "${w}": ${v ? v.map(x => `${x.variant}(${x.labelZh})`).join(', ') : '❌ 未找到'}`);
    }

    // ====== 生成正向映射文件 ======
    const lines = [
        '/**',
        ' * 自动生成 - 来源于 ECDICT exchange 字段',
        ' * 包含: 动词变形(p/d/i/3) + 不规则名词复数(s) + 形容词比较级/最高级(r/t)',
        ' * 规则名词复数(books/cars等)由 variant-generator.ts 代码生成',
        ' * 生成时间: ' + new Date().toISOString(),
        ' */',
        '',
        "import type { VariantInfo } from '@/utils/variant-generator';",
        '',
        'export const ECDICT_VARIANTS: ReadonlyMap<string, VariantInfo[]> = new Map([',
    ];

    const sortedLemmas = [...lemmaMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [lemma, variants] of sortedLemmas) {
        const arrStr = variants.map(v =>
            `{ variant: '${escapeStr(v.variant)}', label: '${v.label}', labelZh: '${escapeStr(v.labelZh)}', pos: '${v.pos}' }`
        ).join(', ');
        lines.push(`  ['${escapeStr(lemma)}', [${arrStr}]],`);
    }

    lines.push(']);');
    lines.push('');
    lines.push('export function getEcdictVariants(lemma: string): VariantInfo[] {');
    lines.push('  return ECDICT_VARIANTS.get(lemma.toLowerCase().trim()) ?? [];');
    lines.push('}');
    lines.push('');
    lines.push(`// ${lemmaMap.size} 个词条, ${totalVariants} 个变体`);

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`\n✅ 正向映射: ${outputPath} (${sizeKB} KB)`);

    // ====== 生成反向索引 ======
    const revLines = [
        '/**',
        ' * 自动生成 - ECDICT 变体反向索引',
        ' * 生成时间: ' + new Date().toISOString(),
        ' */',
        '',
        'export const VARIANT_TO_LEMMA: ReadonlyMap<string, string> = new Map([',
    ];
    const sortedRev = [...reverseMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [variant, lemma] of sortedRev) {
        revLines.push(`  ['${escapeStr(variant)}', '${escapeStr(lemma)}'],`);
    }
    revLines.push(']);');
    revLines.push('');
    revLines.push('export function findLemmaByVariant(variant: string): string | null {');
    revLines.push('  return VARIANT_TO_LEMMA.get(variant.toLowerCase().trim()) ?? null;');
    revLines.push('}');
    revLines.push('');
    revLines.push(`// ${reverseMap.size} 条反向索引`);

    fs.writeFileSync(outputPathReverse, revLines.join('\n'), 'utf-8');
    const revSizeKB = (fs.statSync(outputPathReverse).size / 1024).toFixed(1);
    console.log(`✅ 反向索引: ${outputPathReverse} (${revSizeKB} KB)`);

    db.close();
}

function escapeStr(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

main().catch(console.error);
