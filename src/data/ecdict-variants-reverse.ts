/**
 * ECDICT 变体反向索引 — 构建时内联进 main.js
 *
 * 数据文件: variants-reverse.json (~732KB, ~31K 条目)
 * 原始数据来源: ECDICT SQLite
 */

import variantsReverseRaw from './variants-reverse.json';

const _map: ReadonlyMap<string, string> = new Map(
    Object.entries(variantsReverseRaw as Record<string, string>)
) as ReadonlyMap<string, string>;

export async function loadVariantData(_jsonText?: string): Promise<void> {
    // 已内联，无需运行时加载。保留签名以兼容旧调用。
}

export function findLemmaByVariant(variant: string): string | null {
    return _map.get(variant.toLowerCase().trim()) ?? null;
}

export function isVariantDataLoaded(): boolean {
    return true;
}
