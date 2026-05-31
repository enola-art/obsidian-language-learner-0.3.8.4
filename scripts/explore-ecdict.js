const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/ecdict-sqlite-28/ecdict.db');
console.log('DB Path:', dbPath);
console.log('File size:', (fs.statSync(dbPath).size / 1024 / 1024).toFixed(1), 'MB');

const fileBuffer = fs.readFileSync(dbPath);

async function main() {
    const SQL = await initSqlJs();
    const db = new SQL.Database(fileBuffer);

    // 1. 查看表结构
    console.log('\n=== 表结构 ===');
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tablesResult[0]?.values);

    // 2. 查看 stardict 表的列
    console.log('\n=== stardict 列信息 ===');
    const colsResult = db.exec("PRAGMA table_info(stardict)");
    colsResult[0].values.forEach(c => console.log(`  ${c[1]} (${c[2]})`));

    // 3. 查看 tag 字段的样例值
    console.log('\n=== tag 字段样例（前30条非空）===');
    const tagSamples = db.exec("SELECT word, tag FROM stardict WHERE tag != '' AND tag IS NOT NULL LIMIT 30");
    if (tagSamples.length > 0) {
        tagSamples[0].values.forEach(r => console.log(`  ${r[0]}: [${r[1]}]`));
    }

    // 4. 统计各级别词汇数量
    console.log('\n=== 各级别词汇统计 ===');
    const levels = ['cet4', 'cet6', 'ielts', 'toefl', 'gre'];
    for (const level of levels) {
        const countResult = db.exec(`SELECT COUNT(*) as cnt FROM stardict WHERE tag LIKE '%${level}%'`);
        console.log(`  ${level}: ${countResult[0].values[0][0]}`);
    }

    // 5. 多标签样例
    console.log('\n=== 多标签样例（同时有cet4和ielts）===');
    const multiTag = db.exec("SELECT word, tag FROM stardict WHERE tag LIKE '%cet4%' AND tag LIKE '%ielts%' LIMIT 10");
    if (multiTag.length > 0) {
        multiTag[0].values.forEach(r => console.log(`  ${r[0]}: [${r[1]}]`));
    }

    // 6. 总词数
    console.log('\n=== 总词数 ===');
    const totalResult = db.exec("SELECT COUNT(*) FROM stardict");
    console.log('Total words:', totalResult[0].values[0][0]);

    db.close();
}

main().catch(console.error);
