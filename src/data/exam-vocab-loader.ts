/**
 * ECDICT 考试词汇级别映射 — 构建时内联进 main.js
 *
 * 数据文件: exam-vocab.json (~444KB, ~14.9K 词条)
 * 原始数据来源: ECDICT SQLite
 */

import type { ExamLevelKey } from '../utils/exam-levels';
import examVocabRaw from './exam-vocab.json';

const _map: ReadonlyMap<string, ExamLevelKey[]> = new Map(
    Object.entries(examVocabRaw as Record<string, ExamLevelKey[]>)
) as ReadonlyMap<string, ExamLevelKey[]>;

export async function loadExamVocabData(_jsonText?: string): Promise<void> {
    // 已内联，无需运行时加载。保留签名以兼容旧调用。
}

export function getWordExamLevel(word: string): ExamLevelKey | null {
    const levels = _map.get(word.toLowerCase().trim());
    return levels ? levels[0] : null;
}

export function getWordExamLevels(word: string): ExamLevelKey[] {
    return _map.get(word.toLowerCase().trim()) ?? [];
}

export function isWordInLevel(word: string, level: ExamLevelKey): boolean {
    return _map.get(word.toLowerCase().trim())?.includes(level) ?? false;
}

export function hasExamVocabWord(word: string): boolean {
    return _map.has(word.toLowerCase().trim());
}

export function isExamVocabDataLoaded(): boolean {
    return true;
}
