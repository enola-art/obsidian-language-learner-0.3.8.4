/**
 * ECDICT 考试词汇级别映射 — 运行时从 JSON 加载
 *
 * 数据文件: exam-vocab.json (~280KB, ~14.9K 词条)
 * 由 scripts/convert-exam-vocab-to-json.cjs 生成
 * 原始数据: src/data/exam-vocab.ts (ECDICT SQLite)
 *
 * 架构说明:
 *   此前 14.9K 条 Map 硬编码在 TS 中 (567KB),
 *   编译进 main.js 导致 bundle 膨胀至 2.5MB。
 *   现在改为运行时异步加载 JSON, main.js 预计减少 ~400KB。
 */

import type { ExamLevelKey } from '../utils/exam-levels';

let _map: ReadonlyMap<string, ExamLevelKey[]> | null = null;
let _loadPromise: Promise<void> | null = null;

/**
 * 异步加载考试词汇数据 JSON。
 * 幂等: 多次调用只加载一次。
 */
export async function loadExamVocabData(jsonText: string): Promise<void> {
    if (_map) return;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
        const data: Record<string, ExamLevelKey[]> = JSON.parse(jsonText);
        _map = new Map(Object.entries(data)) as ReadonlyMap<string, ExamLevelKey[]>;
    })();

    return _loadPromise;
}

/**
 * 查询单词的最高考试级别 (按优先级排序)
 * 若数据尚未加载, 返回 null
 */
export function getWordExamLevel(word: string): ExamLevelKey | null {
    const levels = _map?.get(word.toLowerCase().trim());
    return levels ? levels[0] : null;
}

/**
 * 查询单词的所有考试级别
 */
export function getWordExamLevels(word: string): ExamLevelKey[] {
    return _map?.get(word.toLowerCase().trim()) ?? [];
}

/** 检查单词是否属于指定级别 */
export function isWordInLevel(word: string, level: ExamLevelKey): boolean {
    return _map?.get(word.toLowerCase().trim())?.includes(level) ?? false;
}

/** 检查单词是否在词表中 */
export function hasExamVocabWord(word: string): boolean {
    return _map?.has(word.toLowerCase().trim()) ?? false;
}

/** 考试词汇数据是否已加载 */
export function isExamVocabDataLoaded(): boolean {
    return _map !== null;
}
