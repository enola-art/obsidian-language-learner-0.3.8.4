const initSqlJs = require('sql.js');
const fs = require('fs');
const dbPath = './data/ecdict-sqlite-28/ecdict.db';
const fileBuffer = fs.readFileSync(dbPath);

(async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database(fileBuffer);

    console.log('=== stardict 表结构 ===');
    const cols = db.exec('PRAGMA table_info(stardict)');
    cols[0].values.forEach(c => console.log('  ' + c[1] + ' (' + c[2] + ')'));

    console.log('\n=== exchange 字段样例（动词） ===');
    const ex = db.exec("SELECT word, exchange FROM stardict WHERE word IN ('call','consider','collaborate','work','go','take','be','have','do','say','make','get','write','read','think','know','give','find','tell','feel','leave','keep','put','set','cut','hit','hurt','cost')");
    if (ex.length > 0) ex[0].values.forEach(r => console.log('  ' + r[0] + ' => ' + r[1]));

    console.log('\n=== exchange 统计 ===');
    const cnt = db.exec('SELECT COUNT(*) as total, SUM(CASE WHEN exchange IS NOT NULL AND exchange != "" THEN 1 ELSE 0 END) as has_exchange FROM stardict');
    console.log('  总词数:', cnt[0].values[0][0], ', 有exchange字段:', cnt[0].values[0][1]);

    console.log('\n=== exchange 格式样例（前20条非空） ===');
    const samples = db.exec("SELECT word, exchange FROM stardict WHERE exchange IS NOT NULL AND exchange != '' LIMIT 20");
    if (samples.length > 0) samples[0].values.forEach(r => console.log('  ' + r[0] + ' => ' + r[1]));

    db.close();
})().catch(console.error);
