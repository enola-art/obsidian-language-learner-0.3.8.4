/**
 * ECDICT 变体正向映射 — 运行时从 JSON 加载
 *
 * 数据文件: variants.json (3.1MB, 16K+ 词条)
 * 由 scripts/convert-forward-variants-to-json.cjs 生成
 * 原始数据来源: ECDICT SQLite → scripts/extract-variants.js
 *
 * 架构说明:
 *   此前 16K 条 Map<lemma, VariantInfo[]> 硬编码在 TS 中,
 *   约 3.4MB 源码编译进 main.js, 是导致 6.5MB bundle 的主要原因之一。
 *   现在改为运行时异步加载 JSON, main.js 体积大幅缩减。
 */

import type { VariantInfo } from '@/utils/variant-generator';

let _map: ReadonlyMap<string, VariantInfo[]> | null = null;
let _loadPromise: Promise<void> | null = null;

/**
 * 异步加载变体数据 JSON。
 * 幂等: 多次调用只加载一次。
 */
export async function loadForwardVariantData(jsonText: string): Promise<void> {
    if (_map) return;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
        const data: Record<string, VariantInfo[]> = JSON.parse(jsonText);
        _map = new Map(Object.entries(data)) as ReadonlyMap<string, VariantInfo[]>;
    })();

    return _loadPromise;
}

/**
 * 查询某个词条的 ECDICT 变体列表
 * 若数据尚未加载, 返回空数组 — 调用方可回退到规则生成
 */
export function getEcdictVariants(lemma: string): VariantInfo[] {
    if (!_map) return [];
    const key = lemma.toLowerCase().trim();
    return _map.get(key) ?? [];
}

/**
 * 变体数据是否已加载
 */
export function isForwardVariantDataLoaded(): boolean {
    return _map !== null;
}
