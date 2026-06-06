/**
 * ECDICT 考试词汇级别 — 已迁移至运行时 JSON 加载
 *
 * ⚠️ 此文件已改为从 exam-vocab-loader 重新导出
 *    实际数据在 exam-vocab.json 中 (由 scripts/convert-exam-vocab-to-json.cjs 生成)
 *    运行时通过 plugin.ts → loadExamVocabData() 异步加载
 *
 * @see src/data/exam-vocab-loader.ts  (运行时加载器)
 * @see scripts/convert-exam-vocab-to-json.cjs  (JSON 生成脚本)
 */

// 重新导出所有 API，保持向后兼容
export {
    loadExamVocabData,
    getWordExamLevel,
    getWordExamLevels,
    isWordInLevel,
    hasExamVocabWord,
    isExamVocabDataLoaded,
} from './exam-vocab-loader';

// EXAM_VOCAB_MAP 不再静态导出 (异步加载中)
// 使用 hasExamVocabWord() 替代 .has() 调用
// 使用 getWordExamLevel() / getWordExamLevels() 替代 .get() 调用
