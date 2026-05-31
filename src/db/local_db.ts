import { moment } from "obsidian";
import { createAutomaton, Automaton } from "ac-auto";
import { exportDB, importInto } from "dexie-export-import";
import download from "downloadjs";

import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    BatchResult, LemmaMatchResult
} from "./interface";

import DbProvider from "./base";
import WordDB from "./idb";
import Plugin from "@/plugin";
import { logger } from "@/utils/logger";
import { lemmatize } from "@/utils/lemmatizer";
import { isGarbledExpression, getReasonDescription } from "@/utils/garbled-detector";
import { findLemmaByVariant } from '@/data/ecdict-variants-reverse';


export class LocalDb extends DbProvider {
    idb: WordDB;
    plugin: Plugin;
    constructor(plugin: Plugin) {
        super();
        this.plugin = plugin;
        this.idb = new WordDB(plugin);
    }

    async open() {
        await this.idb.open();
        return;
    }

    close() {
        this.idb.close();
    }

    // 寻找页面中已经记录过的单词和词组
    async getStoredWords(payload: ArticleWords): Promise<WordsPhrase> {
        let storedPhrases = new Map<string, number>();
        await this.idb.expressions
            .where("t").equals("PHRASE")
            .each(expr => storedPhrases.set(expr.expression, expr.status));

        let storedWords = (await this.idb.expressions
            .where("expression").anyOf(payload.words)
            .toArray()
        ).map(expr => {
            return { text: expr.expression, status: expr.status } as Word;
        });

        let ac = await createAutomaton([...storedPhrases.keys()]);
        let searchedPhrases = (await ac.search(payload.article)).map(match => {
            return { text: match[1], status: storedPhrases.get(match[1]), offset: match[0] } as Phrase;
        });

        return { words: storedWords, phrases: searchedPhrases };
    }

    async getExpression(expression: string): Promise<ExpressionInfo> {
        expression = expression.toLowerCase();
        let expr = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!expr) {
            return null;
        }

        let sentences = await this.idb.sentences
            .where("id").anyOf([...expr.sentences.values()])
            .toArray();

        return {
            expression: expr.expression,
            meaning: expr.meaning,
            meaning_en: expr.meaning_en || "",
            meaning_cn: expr.meaning_cn || "",
            status: expr.status,
            t: expr.t,
            notes: expr.notes,
            sentences,
            tags: [...expr.tags.keys()],
            lemma_variants: expr.lemma_variants,
            original_input: expr.original_input,
        };

    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map(e => e.toLowerCase());

        let exprs = await this.idb.expressions
            .where("expression")
            .anyOf(expressions)
            .toArray();

        return exprs.map(v => {
            return {
                id: v.id,
                expression: v.expression,
                meaning_en: v.meaning_en || "",
                meaning_cn: v.meaning_cn || "",
                status: v.status,
                t: v.t,
                tags: [...v.tags.keys()],
                sen_num: v.sentences.size,
                note_num: v.notes.length,
                date: v.date
            };
        });
    }

    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let wordsAfter = await this.idb.expressions
            .where("status").above(0)
            .and(expr => expr.date > unixStamp || !expr.date)
            .toArray();

        let res: ExpressionInfo[] = [];
        for (let expr of wordsAfter) {
            let sentences = await this.idb.sentences
                .where("id").anyOf([...expr.sentences.values()])
                .toArray();

            res.push({
                expression: expr.expression,
                meaning: expr.meaning,
                meaning_en: expr.meaning_en || "",
                meaning_cn: expr.meaning_cn || "",
                status: expr.status,
                t: expr.t,
                notes: expr.notes,
                sentences,
                tags: [...expr.tags.keys()],
            });
        }
        return res;
    }

    async getExpressionCount(): Promise<number> {
        return await this.idb.expressions.count();
    }

    async getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]> {
        let exprs: ExpressionInfoSimple[];
        let bottomStatus = ignores ? -1 : 0;
        exprs = (await this.idb.expressions
            .where("status").above(bottomStatus)
            .toArray()
        ).map((expr): ExpressionInfoSimple => {
            return {
                id: expr.id,
                expression: expr.expression,
                status: expr.status,
                meaning_en: expr.meaning_en || "",
                meaning_cn: expr.meaning_cn || "",
                t: expr.t,
                tags: [...expr.tags.keys()],
                note_num: expr.notes.length,
                sen_num: expr.sentences.size,
                date: expr.date,
            };
        });

        return exprs;
    }

    async postExpression(payload: ExpressionInfo, preserveDate: boolean = true): Promise<number> {
        let stored = await this.idb.expressions
            .where("expression").equals(payload.expression)
            .first();

        let sentences = new Set<number>();
        for (let sen of payload.sentences) {
            let searched = await this.idb.sentences.where("text").equals(sen.text).first();
            if (searched) {
                await this.idb.sentences.update(searched.id, sen);
                sentences.add(searched.id);
            } else {
                let id = await this.idb.sentences.add(sen);
                sentences.add(id);
            }
        }

        const currentDate = moment().unix();
        const finalDate = (preserveDate && stored?.date) ? stored.date : currentDate;

        let updatedWord = {
            expression: payload.expression,
            meaning: payload.meaning,
            meaning_en: payload.meaning_en || "",
            meaning_cn: payload.meaning_cn || "",
            status: payload.status,
            t: payload.t,
            notes: payload.notes,
            sentences,
            tags: new Set<string>(payload.tags),
            connections: new Map<string, string>(),
            date: finalDate,
            original_input: (payload as any).original_input || undefined,
            lemma_variants: payload.lemma_variants || (stored?.lemma_variants ?? undefined),
        };
        if (stored) {
            await this.idb.expressions.update(stored.id, updatedWord);
        } else {
            await this.idb.expressions.add(updatedWord);
        }

        dispatchEvent(new CustomEvent("obsidian-langr-data-change"));

        return 200;
    }

    async getTags(): Promise<string[]> {
        let allTags = new Set<string>();
        await this.idb.expressions.each(expr => {
            for (let t of expr.tags.values()) {
                allTags.add(t);
            }
        });

        return [...allTags.values()];
    }

    async postIgnoreWords(payload: string[]): Promise<void> {
        const toAdd: any[] = [];
        for (const expr of payload) {
            const lowerExpr = expr.toLowerCase();
            const existing = await this.idb.expressions
                .where("expression").equals(lowerExpr).first();
            if (!existing) {
                toAdd.push({
                    expression: lowerExpr,
                    meaning: "",
                    meaning_en: "",
                    meaning_cn: "",
                    status: 0,
                    t: "WORD",
                    notes: [],
                    sentences: new Set(),
                    tags: new Set(),
                    connections: new Map<string, string>(),
                    date: moment().unix()
                });
            }
        }
        if (toAdd.length > 0) {
            await this.idb.expressions.bulkAdd(toAdd);
        }
    }

    async deleteExpression(expression: string): Promise<void> {
        expression = expression.toLowerCase();
        const expr = await this.idb.expressions
            .where("expression").equals(expression).first();
        
        if (expr) {
            for (const senId of expr.sentences.values()) {
                await this.idb.sentences.delete(senId);
            }
            await this.idb.expressions.delete(expr.id);
            dispatchEvent(new CustomEvent("obsidian-langr-data-change"));
        }
    }

    async deleteExpressions(expressions: string[]): Promise<BatchResult> {
        const result: BatchResult = { success: 0, failed: 0, errors: [] };
        for (const expr of expressions) {
            try {
                await this.deleteExpression(expr);
                result.success++;
            } catch (e) {
                result.failed++;
                result.errors.push({ expression: expr, error: String(e) });
            }
        }
        if (result.success > 0) {
            dispatchEvent(new CustomEvent("obsidian-langr-data-change"));
        }
        return result;
    }

    async batchUpdateStatus(expressions: string[], newStatus: number): Promise<BatchResult> {
        const result: BatchResult = { success: 0, failed: 0, errors: [] };
        for (const expr of expressions) {
            try {
                const stored = await this.idb.expressions
                    .where("expression").equals(expr.toLowerCase())
                    .first();
                if (!stored) {
                    result.failed++;
                    result.errors.push({ expression: expr, error: "Not found" });
                    continue;
                }
                if (stored.status === newStatus) {
                    continue;
                }
                await this.idb.expressions.update(stored.id, { status: newStatus });
                result.success++;
            } catch (e) {
                result.failed++;
                result.errors.push({ expression: expr, error: String(e) });
            }
        }
        if (result.success > 0) {
            dispatchEvent(new CustomEvent("obsidian-langr-data-change"));
        }
        return result;
    }

    async batchAddTag(expressions: string[], tag: string): Promise<BatchResult> {
        const result: BatchResult = { success: 0, failed: 0, errors: [] };
        for (const expr of expressions) {
            try {
                const stored = await this.idb.expressions
                    .where("expression").equals(expr.toLowerCase())
                    .first();
                if (!stored) {
                    result.failed++;
                    result.errors.push({ expression: expr, error: "Not found" });
                    continue;
                }
                const tags = new Set(stored.tags);
                tags.add(tag);
                await this.idb.expressions.update(stored.id, { tags });
                result.success++;
            } catch (e) {
                result.failed++;
                result.errors.push({ expression: expr, error: String(e) });
            }
        }
        if (result.success > 0) {
            dispatchEvent(new CustomEvent("obsidian-langr-data-change"));
        }
        return result;
    }

    async tryGetSen(text: string): Promise<Sentence> {
        let stored = await this.idb.sentences.where("text").equals(text).first();
        return stored;
    }

    async getCount(): Promise<CountInfo> {
        let counts: { "WORD": number[], "PHRASE": number[]; } = {
            "WORD": new Array(5).fill(0),
            "PHRASE": new Array(5).fill(0),
        };
        await this.idb.expressions.each(expr => {
            counts[expr.t as "WORD" | "PHRASE"][expr.status]++;
        });

        return {
            word_count: counts.WORD,
            phrase_count: counts.PHRASE
        };
    }

    async countSeven(): Promise<WordCount[]> {
        const start = moment().subtract(6, "days").startOf("day");
        const allExprs = await this.idb.expressions
            .where("date").aboveOrEqual(start.unix())
            .toArray();

        let spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            let from = moment(start).add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        let res: WordCount[] = [];

        for (let span of spans) {
            let today = new Array(5).fill(0);
            let accumulated = new Array(5).fill(0);

            for (const expr of allExprs) {
                if (expr.t !== "WORD") continue;
                if (expr.date >= span.from && expr.date <= span.to) {
                    today[expr.status]++;
                }
                if (expr.date <= span.to) {
                    accumulated[expr.status]++;
                }
            }

            res.push({ today, accumulated });
        }

        return res;
    }

    async importDB(file: File) {
        try {
            await importInto(this.idb, file, {
                acceptNameDiff: true,
                clearTablesBeforeImport: true
            });
        } catch (e) {
            logger.error("error importing database", e);
            throw e;
        }
    }

    async exportDB() {
        let blob = await exportDB(this.idb);
        try {
            download(blob, `${this.idb.dbName}.json`, "application/json");
        } catch (e) {
            logger.error("error exporting database");
        }
    }

    async destroyAll() {
        return this.idb.delete();
    }

    async exportToBlob(): Promise<Blob> {
        return await exportDB(this.idb);
    }

    async importFromBlob(blob: Blob): Promise<void> {
        await this.idb.delete();
        await this.idb.open();
        await importInto(this.idb, blob, { acceptNameDiff: true });
    }

    async diagnoseAndFixDatabase(): Promise<number> {
        let fixedCount = 0;
        const meaningPrefixes = /^(n\.|v\.|adj\.|adv\.|conj\.|prep\.|pron\.|\d+\.|【)/i;

        const allExprs = await this.idb.expressions.toArray();
        const updates: Array<{id: number, expression: string, meaning: string, meaning_en: string, meaning_cn: string}> = [];

        for (const expr of allExprs) {
            let needsFix = false;
            let finalExpression = expr.expression;
            let finalMeaningEn = expr.meaning_en || "";
            let finalMeaningCn = expr.meaning_cn || "";
            let finalMeaning = expr.meaning;

            if (meaningPrefixes.test(expr.expression) && !meaningPrefixes.test(finalMeaningEn)) {
                needsFix = true;
                finalExpression = finalMeaningEn;
                finalMeaningEn = expr.expression;
                finalMeaning = finalMeaningCn || finalMeaningEn;
            }

            if (!expr.expression || expr.expression.trim() === "") {
                if (finalMeaningEn && finalMeaningEn.trim().length > 0 && !meaningPrefixes.test(finalMeaningEn)) {
                    finalExpression = finalMeaningEn;
                    finalMeaningEn = "";
                    needsFix = true;
                } else if (finalMeaning && finalMeaning.trim().length > 0 && !meaningPrefixes.test(finalMeaning)) {
                    finalExpression = finalMeaning;
                    finalMeaning = "";
                    needsFix = true;
                }
            }

            if (needsFix && expr.id) {
                updates.push({ id: expr.id, expression: finalExpression, meaning: finalMeaning, meaning_en: finalMeaningEn, meaning_cn: finalMeaningCn });
                fixedCount++;
            }
        }

        if (updates.length > 0) {
            const exprMap = new Map(allExprs.map(e => [e.id, e]));
            await this.idb.expressions.bulkPut(updates.map(u => {
                const orig = exprMap.get(u.id);
                return {
                    ...orig,
                    expression: u.expression,
                    meaning: u.meaning,
                    meaning_en: u.meaning_en,
                    meaning_cn: u.meaning_cn,
                } as any;
            }));
            dispatchEvent(new CustomEvent("obsidian-langr-data-change"));
        }

        return fixedCount;
    }

    async removeDuplicates(): Promise<number> {
        const allExprs = await this.idb.expressions.toArray();
        const seen = new Map<string, number>();
        const toDelete: number[] = [];
        const toUpdate: Array<{id: number, expression: string}> = [];
        const meaningPrefixes = /^(n\.|v\.|adj\.|adv\.|conj\.|prep\.|pron\.|\d+\.|【)/i;

        for (const expr of allExprs) {
            let cleanExpression = expr.expression.toLowerCase().trim();

            const commaIndex = cleanExpression.indexOf(",");
            if (commaIndex > 0) {
                cleanExpression = cleanExpression.substring(0, commaIndex).trim();
            }

            if (meaningPrefixes.test(cleanExpression)) {
                toDelete.push(expr.id);
                continue;
            }

            if (seen.has(cleanExpression)) {
                toDelete.push(expr.id);
            } else {
                seen.set(cleanExpression, expr.id);
                if (cleanExpression !== expr.expression) {
                    toUpdate.push({ id: expr.id, expression: cleanExpression });
                }
            }
        }

        if (toDelete.length > 0) {
            await this.idb.expressions.bulkDelete(toDelete);
        }
        if (toUpdate.length > 0) {
            const exprMap = new Map(allExprs.map(e => [e.id, e]));
            await this.idb.expressions.bulkPut(toUpdate.map(u => ({
                ...exprMap.get(u.id),
                expression: u.expression,
            }) as any));
        }

        if (toDelete.length > 0 || toUpdate.length > 0) {
            dispatchEvent(new CustomEvent("obsidian-langr-data-change"));
        }

        return toDelete.length;
    }

    async ensureDataImported(): Promise<boolean> {
        const count = await this.idb.expressions.count();
        if (count === 0) {
            console.log("IndexedDB 为空，需要从 wordDB.md 导入数据");
            return false;
        }
        return true;
    }

    async importFromWordDB(wordDBText: string): Promise<number> {
        const del = this.plugin.settings.col_delimiter;
        let count = 0;
        let skipped = 0;

        const statusMap = [
            "Ignore",
            "Learning",
            "Familiar",
            "Known",
            "Learned",
        ];
        const meaningPrefixes = /^(n\.|v\.|adj\.|adv\.|conj\.|prep\.|pron\.|\d+\.|【)/i;

        let currentStatus = -1;
        let lines = wordDBText.split("\n");
        let currentWord = "";
        let currentMeaningEn = "";

        const batchWords: Array<{expression: string, meaning: string, meaning_en: string, meaning_cn: string, status: number}> = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();

            if (line.startsWith("#### ")) {
                if (currentWord && currentWord !== "_SKIP_") {
                    batchWords.push({
                        expression: currentWord,
                        meaning: currentMeaningEn,
                        meaning_en: currentMeaningEn,
                        meaning_cn: "",
                        status: currentStatus,
                    });
                }

                const statusName = line.slice(5).trim();
                currentStatus = statusMap.findIndex(s =>
                    s.toLowerCase() === statusName.toLowerCase()
                );
                if (currentStatus === -1) currentStatus = 1;
                if (statusName === "反向查询") currentStatus = -1;

                currentWord = "";
                currentMeaningEn = "";
                continue;
            }

            if (currentStatus === -1) continue;

            if (!line) continue;

            if (!currentWord) {
                let word = line.trim().toLowerCase();

                const commaIndex = word.indexOf(",");
                if (commaIndex > 0) word = word.substring(0, commaIndex).trim();
                const delIndex = word.indexOf(del);
                if (delIndex > 0) word = word.substring(0, delIndex).trim();

                const garbledReason = isGarbledExpression(word);
                if (garbledReason) {
                    logger.warn(`Skipping garbled: [${word.slice(0, 50)}] ${getReasonDescription(garbledReason)}`);
                    skipped++;
                    currentWord = "_SKIP_";
                    currentMeaningEn = "";
                    continue;
                }
                if (!word || word.length < 1 || word.length > 50) {
                    skipped++;
                    currentWord = "_SKIP_";
                    currentMeaningEn = "";
                    continue;
                }

                currentWord = word;
            } else if (!currentMeaningEn) {
                if (currentWord === "_SKIP_") continue;
                currentMeaningEn = line.trim();
            } else {
                if (currentWord === "_SKIP_") {
                    currentWord = "";
                    currentMeaningEn = "";
                    continue;
                }

                const rawMeaningCn = line.trim();
                const meaning_en = currentMeaningEn === "空" ? "" : currentMeaningEn;
                const meaning_cn = rawMeaningCn === "空" ? "" : rawMeaningCn;

                let finalWord = currentWord;
                let finalMeaningEn = meaning_en;
                let finalMeaningCn = meaning_cn;

                if (meaningPrefixes.test(finalWord) && !meaningPrefixes.test(finalMeaningEn)) {
                    finalWord = meaning_en;
                    finalMeaningEn = currentWord;
                    finalMeaningCn = "";
                }

                const finalGarbledCheck = isGarbledExpression(finalWord);
                if (finalGarbledCheck) {
                    logger.warn(`Skipping garbled after process: [${finalWord.slice(0, 50)}]`);
                    skipped++;
                } else {
                    batchWords.push({
                        expression: finalWord,
                        meaning: finalMeaningCn || finalMeaningEn,
                        meaning_en: finalMeaningEn,
                        meaning_cn: finalMeaningCn,
                        status: currentStatus,
                    });
                }

                currentWord = "";
                currentMeaningEn = "";
            }
        }

        if (currentWord && currentWord !== "_SKIP_") {
            batchWords.push({
                expression: currentWord,
                meaning: currentMeaningEn,
                meaning_en: currentMeaningEn,
                meaning_cn: "",
                status: currentStatus,
            });
        }

        if (batchWords.length > 0) {
            const allExisting = await this.idb.expressions.toArray();
            const existingMap = new Map<string, number>();
            for (const e of allExisting) {
                existingMap.set(e.expression.toLowerCase(), e.id);
            }

            const toAdd: any[] = [];
            for (const w of batchWords) {
                const key = w.expression.toLowerCase();
                if (!existingMap.has(key)) {
                    toAdd.push({
                        expression: w.expression,
                        meaning: w.meaning,
                        meaning_en: w.meaning_en,
                        meaning_cn: w.meaning_cn,
                        status: w.status,
                        t: "WORD",
                        notes: [],
                        tags: new Set(),
                        sentences: new Set(),
                        connections: new Map(),
                        date: moment().unix(),
                    } as any);
                    count++;
                }
            }

            if (toAdd.length > 0) {
                await this.idb.expressions.bulkAdd(toAdd);
            }
        }

        if (count > 0 || skipped > 0) {
            logger.log(`Import completed: ${count} added, ${skipped} skipped`);
        }

        return count;
    }

    private async saveWordToIDB(word: string, meaningEn: string, status: number): Promise<void> {
        const expression = word.toLowerCase();
        const stored = await this.idb.expressions
            .where("expression").equals(expression).first();

        if (!stored) {
            await this.idb.expressions.add({
                expression: expression,
                meaning: meaningEn,
                meaning_en: meaningEn,
                meaning_cn: "",
                status: status,
                t: "WORD",
                notes: [],
                sentences: new Set(),
                tags: new Set(),
                connections: new Map(),
                date: moment().unix()
            });
        }
    }

    async findExpression(word: string): Promise<LemmaMatchResult> {
        const lowerWord = word.toLowerCase();

        try {
            // Step 1: 精确匹配
            const exactMatch = await this.idb.expressions
                .where("expression")
                .equals(lowerWord)
                .first();

            if (exactMatch) {
                return {
                    found: true,
                    expression: lowerWord,
                    matched_lemma: lowerWord,
                    match_type: 'exact',
                    status: exactMatch.status,
                    display_text: `${lowerWord} 已标记`
                };
            }

            // Step 2: 词形还原查询
            const lemmaResult = lemmatize(lowerWord);

            if (lemmaResult && lemmaResult.lemma !== lowerWord) {
                const lemmaMatch = await this.idb.expressions
                    .where("expression")
                    .equals(lemmaResult.lemma)
                    .first();

                if (lemmaMatch) {
                    // 更新变体列表
                    await this.addVariant(lemmaMatch.id, lowerWord);

                    return {
                        found: true,
                        expression: lowerWord,
                        matched_lemma: lemmaResult.lemma,
                        match_type: 'lemma',
                        status: lemmaMatch.status,
                        display_text: `${lowerWord} 已标记 (原形: ${lemmaResult.lemma})`
                    };
                }
            }

            // Step 3: 变体列表反向查询
            const variantMatch = await this.findByVariant(lowerWord);

            if (variantMatch) {
                return {
                    found: true,
                    expression: lowerWord,
                    matched_lemma: variantMatch.expression,
                    match_type: 'variant',
                    status: variantMatch.status,
                    display_text: `${lowerWord} 已标记 (原形: ${variantMatch.expression})`
                };
            }

            // 未找到
            return {
                found: false,
                expression: lowerWord,
                display_text: `${lowerWord} 未学习`
            };

        } catch (error) {
            logger.error(`findExpression failed for "${word}":`, error);
            return {
                found: false,
                expression: lowerWord,
                display_text: `${lowerWord} 查询失败`
            };
        }
    }

    // 兼容旧格式 (string[]) 和新格式 (VariantEntry[])
    private normalizeVariants(raw: any): Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}> {
        if (!raw || !Array.isArray(raw)) return [];
        if (raw.length === 0) return [];
        // 如果已经是新格式（对象数组）
        if (typeof raw[0] === 'object' && raw[0].variant) {
            return raw;
        }
        // 旧格式：纯字符串数组
        return (raw as string[]).map(v => ({ variant: String(v).toLowerCase() }));
    }

    private async addVariant(expressionId: number, newVariant: string, meta?: {label?: string, labelZh?: string, meaning_cn?: string}): Promise<void> {
        try {
            const record = await this.idb.expressions.get(expressionId);

            if (record) {
                const currentVariants = this.normalizeVariants(record.lemma_variants);
                const lowerVariant = newVariant.toLowerCase();

                if (!currentVariants.some(v => v.variant === lowerVariant)) {
                    const newEntry: any = { variant: lowerVariant };
                    if (meta?.label) newEntry.label = meta.label;
                    if (meta?.labelZh) newEntry.labelZh = meta.labelZh;
                    if (meta?.meaning_cn) newEntry.meaning_cn = meta.meaning_cn;

                    const updatedVariants = [...currentVariants, newEntry];
                    await this.idb.expressions.update(expressionId, {
                        lemma_variants: updatedVariants
                    });
                }
            }
        } catch (error) {
            logger.warn(`Failed to add variant "${newVariant}" to expression ${expressionId}:`, error);
        }
    }

    async addVariantToExpression(expression: string, newVariant: string, meta?: {label?: string, labelZh?: string, meaning_cn?: string}): Promise<boolean> {
        try {
            const record = await this.idb.expressions
                .where("expression")
                .equals(expression.toLowerCase())
                .first();

            if (record && record.id !== undefined) {
                await this.addVariant(record.id, newVariant, meta);
                return true;
            }

            logger.warn(`Expression "${expression}" not found for adding variant`);
            return false;
        } catch (error) {
            logger.error(`addVariantToExpression failed for "${expression}":`, error);
            return false;
        }
    }

    async removeVariantFromExpression(expression: string, variantToRemove: string): Promise<boolean> {
        try {
            const record = await this.idb.expressions
                .where("expression")
                .equals(expression.toLowerCase())
                .first();

            if (record && record.id !== undefined) {
                const currentVariants = this.normalizeVariants(record.lemma_variants);
                const lowerVariant = variantToRemove.toLowerCase();

                if (currentVariants.some(v => v.variant === lowerVariant)) {
                    const updatedVariants = currentVariants.filter(v => v.variant !== lowerVariant);
                    await this.idb.expressions.update(record.id, {
                        lemma_variants: updatedVariants
                    });
                    logger.log(`Removed variant "${lowerVariant}" from "${expression}"`);
                    return true;
                } else {
                    logger.log(`Variant "${lowerVariant}" not found in "${expression}"`);
                    return false;
                }
            }

            logger.warn(`Expression "${expression}" not found for removing variant`);
            return false;
        } catch (error) {
            logger.error(`removeVariantFromExpression failed for "${expression}":`, error);
            return false;
        }
    }

    private async findByVariant(variant: string): Promise<ExpressionInfoSimple | null> {
        try {
            const lowerVariant = variant.toLowerCase();

            // O(1) 反向索引查找
            const fromIndex = findLemmaByVariant(lowerVariant);
            if (fromIndex) {
                const exprInfo = await this.getExpression(fromIndex);
                if (exprInfo && exprInfo.status !== 0) {
                    return {
                        id: 0,
                        expression: exprInfo.expression,
                        meaning_en: exprInfo.meaning_en,
                        meaning_cn: exprInfo.meaning_cn,
                        status: exprInfo.status,
                        t: exprInfo.t,
                        tags: exprInfo.tags || [],
                        note_num: exprInfo.notes?.length || 0,
                        sen_num: exprInfo.sentences?.length || 0,
                        date: undefined,
                        lemma_variants: exprInfo.lemma_variants
                    };
                }
            }

            // 回退到全表扫描
            const allExpressions = await this.idb.expressions.toArray();

            const found = allExpressions.find(expr => {
                const variants = this.normalizeVariants(expr.lemma_variants);
                return variants.some(v => v.variant === lowerVariant);
            });

            if (!found) return null;

            // 转换为 ExpressionInfoSimple 格式
            return {
                id: found.id!,
                expression: found.expression,
                meaning_en: found.meaning_en,
                meaning_cn: found.meaning_cn,
                status: found.status,
                t: found.t,
                tags: Array.from(found.tags || []),
                note_num: found.notes?.length || 0,
                sen_num: (found.sentences?.size) || 0,
                date: found.date,
                lemma_variants: found.lemma_variants
            };
        } catch (error) {
            logger.warn(`findByVariant failed for "${variant}":`, error);
            return null;
        }
    }

    async getLevelStats(): Promise<Record<string, number>> {
        const all = await this.idb.expressions.toArray();
        const stats: Record<string, number> = { other: 0 };
        for (const expr of all) {
            if (expr.tags && expr.tags.size > 0) {
                let found = false;
                for (const tag of expr.tags) {
                    if (tag === 'cet4' || tag === 'cet6' || tag === 'ielts' || tag === 'toefl' || tag === 'gre' || tag === 'hs' || tag === 'kaoyan') {
                        stats[tag] = (stats[tag] || 0) + 1;
                        found = true;
                        break;
                    }
                }
                if (!found) stats.other++;
            } else {
                stats.other++;
            }
        }
        return stats;
    }

    async getByLevel(level: string): Promise<ExpressionInfoSimple[]> {
        const all = await this.idb.expressions.toArray();
        return all
            .filter(expr => expr.tags && expr.tags.has(level))
            .map(expr => ({
                id: expr.id,
                expression: expr.expression,
                meaning: expr.meaning,
                meaning_en: expr.meaning_en || "",
                meaning_cn: expr.meaning_cn || "",
                status: expr.status,
                t: expr.t,
                tags: Array.from(expr.tags || []),
                note_num: (expr.notes as any)?.length || 0,
                sen_num: (expr.sentences as any)?.length || 0,
                date: expr.date,
                lemma_variants: expr.lemma_variants
            }));
    }
}


