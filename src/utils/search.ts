import type { SearchQuery, ExpressionInfoSimple } from "@/db/interface";

export function parseSearchQuery(input: string): SearchQuery {
    const query: SearchQuery = {};
    const tokens = input.trim().split(/\s+/).filter(Boolean);

    for (const token of tokens) {
        if (token.startsWith("tag:")) {
            (query.tags ??= []).push(token.slice(4));
        } else if (token.startsWith("-tag:")) {
            (query.tagsExclude ??= []).push(token.slice(5));
        } else if (token.startsWith("status:")) {
            query.status = token
                .slice(7)
                .split(",")
                .map(Number)
                .filter((n) => !isNaN(n) && n >= 0 && n <= 4);
        } else if (token.startsWith("regex:")) {
            query.regex = token.slice(6);
        } else if (token === "has:note") {
            query.hasNotes = true;
        } else if (token === "has:sentence") {
            query.hasSentences = true;
        } else if (token.startsWith("type:")) {
            query.type = token.slice(5).toUpperCase();
        } else {
            query.text = (query.text ? query.text + " " : "") + token;
        }
    }

    return query;
}

export function applySearchFilter(
    rows: ExpressionInfoSimple[],
    query: SearchQuery
): ExpressionInfoSimple[] {
    let result = rows;

    if (query.status && query.status.length > 0) {
        result = result.filter((r) => query.status!.includes(r.status));
    }

    if (query.tags && query.tags.length > 0) {
        result = result.filter((r) =>
            query.tags!.every((tag) => r.tags.includes(tag))
        );
    }

    if (query.tagsExclude && query.tagsExclude.length > 0) {
        result = result.filter((r) =>
            !query.tagsExclude!.some((tag) => r.tags.includes(tag))
        );
    }

    if (query.hasNotes) {
        result = result.filter((r) => r.note_num > 0);
    }

    if (query.hasSentences) {
        result = result.filter((r) => r.sen_num > 0);
    }

    if (query.type) {
        result = result.filter((r) => r.t === query.type);
    }

    if (query.regex) {
        try {
            const re = new RegExp(query.regex, "i");
            result = result.filter((r) => re.test(r.expression));
        } catch {
            // 无效正则，忽略
        }
    }

    if (query.text) {
        const lower = query.text.toLowerCase();
        result = result.filter((r) => r.expression.toLowerCase().includes(lower));
    }

    return result;
}
