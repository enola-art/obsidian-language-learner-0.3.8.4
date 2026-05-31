import { logger } from "./logger";
import type { ExpressionInfoSimple } from "@/db/interface";

const GARBLED_PATTERNS = {
    partOfSpeech: /^(n\.|v\.|adj\.|adv\.|conj\.|prep\.|pron\.|\d+\.|【)/i,
    chineseHeavy: /[\u4e00-\u9fff]{3,}/,
    multipleMeanings: /[;；]/,
    mixedContent: /^[a-z]*\./i,
    tooLong: /^.{50,}$/,
    startsWithNumber: /^\d+\./,
    containsBrackets: /[【】\[\]]/,
    definitionLike: /^(完全|非常|广泛|充分|彻底|确实)/,
};

export interface GarbledWordResult {
    total: number;
    garbled: ExpressionInfoSimple[];
    reasons: Map<string, number>;
}

export function isGarbledExpression(expression: string): string | null {
    if (!expression || !expression.trim()) {
        return "empty";
    }

    const expr = expression.trim();

    if (GARBLED_PATTERNS.partOfSpeech.test(expr)) {
        return "starts_with_part_of_speech";
    }

    if (GARBLED_PATTERNS.chineseHeavy.test(expr)) {
        return "contains_heavy_chinese";
    }

    if (GARBLED_PATTERNS.multipleMeanings.test(expr)) {
        return "contains_multiple_meanings";
    }

    if (GARBLED_PATTERNS.mixedContent.test(expr) && expr.length > 10) {
        return "mixed_content_format";
    }

    if (GARBLED_PATTERNS.tooLong.test(expr)) {
        return "too_long";
    }

    if (GARBLED_PATTERNS.startsWithNumber.test(expr)) {
        return "starts_with_number";
    }

    if (GARBLED_PATTERNS.containsBrackets.test(expr)) {
        return "contains_brackets";
    }

    if (GARBLED_PATTERNS.definitionLike.test(expr)) {
        return "looks_like_definition";
    }

    const nonWordChars = expr.replace(/[a-zA-Z\s\-']/g, "");
    if (nonWordChars.length > expr.length * 0.3) {
        return "too_many_special_chars";
    }

    if (expr.includes(" ") && expr.split(" ").length > 5) {
        return "too_many_words";
    }

    return null;
}

export async function detectGarbledWords(
    words: ExpressionInfoSimple[]
): Promise<GarbledWordResult> {
    const garbled: ExpressionInfoSimple[] = [];
    const reasons = new Map<string, number>();

    for (const word of words) {
        const reason = isGarbledExpression(word.expression);
        if (reason) {
            garbled.push(word);
            reasons.set(reason, (reasons.get(reason) || 0) + 1);
        }
    }

    logger.log(`Garbled word detection: ${garbled.length}/${words.length} corrupted`);

    return {
        total: words.length,
        garbled,
        reasons,
    };
}

export function getReasonDescription(reason: string): string {
    const descriptions: Record<string, string> = {
        empty: "空值",
        starts_with_part_of_speech: "以词性标记开头 (n./v./adj.等)",
        contains_heavy_chinese: "包含大量中文（应为英文单词）",
        contains_multiple_meanings: "包含多个释义（分号分隔）",
        mixed_content_format: "混合内容格式",
        too_long: "过长（超过50字符）",
        starts_with_number: "以数字编号开头",
        contains_brackets: "包含中文括号",
        looks_like_definition: "看起来像释义而非单词",
        too_many_special_chars: "包含过多特殊字符",
        too_many_words: "单词数过多（超过5个）",
    };

    return descriptions[reason] || reason;
}

export function formatGarbledReport(result: GarbledWordResult): string {
    if (result.garbled.length === 0) {
        return "✅ 未发现乱码数据";
    }

    let report = `⚠️ 发现 ${result.garbled.length} 条乱码数据（共 ${result.total} 条）：\n\n`;

    result.reasons.forEach((count, reason) => {
        report += `• ${getReasonDescription(reason)}: ${count} 条\n`;
    });

    report += `\n📝 示例（前10条）：\n`;
    const examples = result.garbled.slice(0, 10);
    examples.forEach((word, index) => {
        const reason = isGarbledExpression(word.expression);
        report += `${index + 1}. [${word.expression.slice(0, 40)}${word.expression.length > 40 ? '...' : ''}] (${getReasonDescription(reason)})\n`;
    });

    if (result.garbled.length > 10) {
        report += `... 等共 ${result.garbled.length} 条\n`;
    }

    return report;
}
