/**
 * ECDICT 变体反向索引 — 运行时从 JSON 加载
 *
 * 数据文件: variants-reverse.json (731KB, 31K+ 条目)
 * 由 scripts/convert-variants-to-json.cjs 生成
 * 原始数据来源: ECDICT SQLite → scripts/extract-variants.js
 *
 * 架构说明:
 *   此前 31K 条 Map 硬编码在 TS 中, 导致 esbuild bundle 后 main.js 膨胀至 6.5MB,
 *   V8 解析/编译阻塞 Obsidian 启动主线程数秒。
 *   现在改为运行时异步 fetch JSON, main.js 体积骤降至几百 KB。
 */

let _map: ReadonlyMap<string, string> | null = null;
let _loadPromise: Promise<void> | null = null;

/**
 * 异步加载变体数据 JSON。
 * 幂等: 多次调用只加载一次。
 * 应在插件 onLayoutReady 中调用 (此时 vault adapter 已就绪)。
 *
 * @param jsonText - JSON 文本内容 (通过 vault adapter 读取)
 */
export async function loadVariantData(jsonText: string): Promise<void> {
    if (_map) return;
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
        const data: Record<string, string> = JSON.parse(jsonText);
        _map = new Map(Object.entries(data)) as ReadonlyMap<string, string>;
    })();

    return _loadPromise;
}

/**
 * 变体→词条反向查找 (O(1))
 * 若数据尚未加载, 返回 null — 调用方应回退到全表扫描
 */
export function findLemmaByVariant(variant: string): string | null {
    if (!_map) return null;
    return _map.get(variant.toLowerCase().trim()) ?? null;
}

/**
 * 变体数据是否已加载
 */
export function isVariantDataLoaded(): boolean {
    return _map !== null;
}
