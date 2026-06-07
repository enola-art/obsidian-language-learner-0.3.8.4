/**
 * ECDICT 变体正向映射 — 构建时内联进 main.js
 *
 * 数据文件: variants.json (~3.1MB, ~16K 词条)
 * 原始数据来源: ECDICT SQLite
 */

import type { VariantInfo } from '@/utils/variant-generator';
import variantsRaw from './variants.json';

const _map: ReadonlyMap<string, VariantInfo[]> = new Map(
    Object.entries(variantsRaw as Record<string, VariantInfo[]>)
) as ReadonlyMap<string, VariantInfo[]>;

export async function loadForwardVariantData(_jsonText?: string): Promise<void> {
    // 已内联，无需运行时加载。保留签名以兼容旧调用。
}

export function getEcdictVariants(lemma: string): VariantInfo[] {
    const key = lemma.toLowerCase().trim();
    return _map.get(key) ?? [];
}

export function isForwardVariantDataLoaded(): boolean {
    return true;
}
