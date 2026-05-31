import { requestUrl, RequestUrlParam, moment } from "obsidian";
import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    BatchResult, LemmaMatchResult
} from "./interface";

import DbProvider from "./base";
import { logger } from "@/utils/logger";


export class WebDb extends DbProvider {
    host: string;
    port: number;
    prefix: string = "/lr";
    https: boolean;
    apiKey: string;
    
    get baseHeaders(): Record<string, string> {
        return {
            "LR-API-Key": this.apiKey ? this.apiKey : undefined
        }
    }
    get proto(): string {
        return this.https? "https" : "http"
    }

    constructor(host: string, port: number, https: boolean, apiKey: string) {
        super();
        this.host = host;
        this.port = port;
        this.https = https;
        this.apiKey = apiKey;
    }

    async open() { }

    close() { }

    // 寻找页面中已经记录过的单词和词组
    async getStoredWords(
        payload: ArticleWords
    ): Promise<WordsPhrase> {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/word_phrase`,
            method: "POST",
            body: JSON.stringify(payload),
            contentType: "application/json",
            headers: this.baseHeaders,
        };
        

        try {
            let response = await requestUrl(request);
            let data: WordsPhrase = response.json;
            return data;
        } catch (e) {
            logger.warn("Error when getting parse info from server:" + e);
        }
    }

    // 获取单词/词组的详细信息
    async getExpression(
        expression: string
    ): Promise<ExpressionInfo> {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/word`,
            method: "POST",
            body: JSON.stringify(expression.toLowerCase()),
            contentType: "application/json",
            headers: this.baseHeaders,
        };

        try {
            let response = await requestUrl(request);
            return response.json;
        } catch (e) {
            logger.warn("Error while getting data from server." + e);
        }
    }

    async getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]> {
        expressions = expressions.map(v => v.toLowerCase());
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/words_simple`,
            method: "POST",
            body: JSON.stringify(expressions),
            contentType: "application/json",
            headers: this.baseHeaders,
        };

        try {
            let response = await requestUrl(request);
            return response.json;
        } catch (e) {
            logger.error("Error getting simple data from server: " + e);
        }
    }


    // 获取某一时间之后的所有单词的详细信息
    async getExpressionAfter(time: string): Promise<ExpressionInfo[]> {
        let unixStamp = moment.utc(time).unix();
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/words/after`,
            method: "POST",
            body: JSON.stringify(unixStamp),
            contentType: "application/json",
            headers: this.baseHeaders,
        };
        try {
            let response = await requestUrl(request);
            return response.json;
        } catch (e) {
            logger.warn("Error getting exprs after time from server" + e);
        }
    }


    async getExpressionCount(): Promise<number> {
        try {
            let request: RequestUrlParam = {
                url: `${this.proto}://${this.host}:${this.port}${this.prefix}/count`,
                method: "GET",
                headers: this.baseHeaders,
            };
            const res = await requestUrl(request);
            return JSON.parse(res.text).count || 0;
        } catch (e) {
            logger.warn("Error getting expression count from server: " + e);
            return 0;
        }
    }


    // 通过status查询单词/词组,获取简略信息
    async getAllExpressionSimple(
        ignores?: boolean
    ): Promise<ExpressionInfoSimple[]> {
        let mode = ignores ? "all" : "no_ignore";

        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/words_simple/${mode}`,
            method: "GET",
            headers: this.baseHeaders,
        };

        try {
            let response = await requestUrl(request);

            return response.json;
        } catch (e) {
            logger.warn("Error while getting all simple data from server." + e);
        }
    }

    // 添加或更新单词/词组的信息
    async postExpression(payload: ExpressionInfo, preserveDate: boolean = true): Promise<number> {
        let body = { ...payload };
        if (preserveDate) {
            (body as any).preserve_date = true;
        }
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/update`,
            method: "POST",
            body: JSON.stringify(body),
            contentType: "application/json",
            headers: this.baseHeaders,
        };
        try {
            let response = await requestUrl(request);
            return response.status;
        } catch (e) {
            logger.warn("Error while saving data to server." + e);
        }
    }

    // 获取所有的tag
    async getTags(): Promise<string[]> {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/tags`,
            method: "GET",
            headers: this.baseHeaders,
        };

        try {
            let response = await requestUrl(request);
            return response.json;
        } catch (e) {
            logger.warn("Error getting tags from server." + e);
        }
    }

    // 发送所有忽略的新词
    async postIgnoreWords(payload: string[]) {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/ignores`,
            method: "POST",
            body: JSON.stringify(payload),
            contentType: "application/json",
            headers: this.baseHeaders,
        };

        try {
            await requestUrl(request);
        } catch (e) {
            logger.warn("Error sending ignore words" + e);
        }
    }

    // 尝试查询已存在的例句
    async tryGetSen(text: string): Promise<Sentence> {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/sentence`,
            method: "POST",
            body: JSON.stringify(text),
            contentType: "application/json",
            headers: this.baseHeaders,
        };

        try {
            let res = await requestUrl(request);
            return res.json;
        } catch (e) {
            logger.warn("Error trying to get sentence" + e);
        }
    }

    // 统计部分
    // 获取各种类型的单词/词组类型
    async getCount(): Promise<CountInfo> {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/count_all`,
            method: "GET",
            headers: this.baseHeaders,
        };
        try {
            let response = await requestUrl(request);
            let wordsCount: CountInfo = response.json;
            return wordsCount;
        } catch (e) {
            logger.warn("Error getting words count" + e);
        }
    }


    // 获取包括今天在内的7天内每一天的新单词量和累计单词量
    async countSeven(): Promise<WordCount[]> {
        let spans: Span[] = [];

        spans = [0, 1, 2, 3, 4, 5, 6].map((i) => {
            let start = moment().subtract(6, "days").startOf("day");
            let from = start.add(i, "days");
            return {
                from: from.unix(),
                to: from.endOf("day").unix(),
            };
        });

        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/count_time`,
            method: "POST",
            body: JSON.stringify(spans),
            contentType: "application/json",
            headers: this.baseHeaders,
        };

        try {
            let res = await requestUrl(request);
            return res.json;
        } catch (e) { }
    }

    async importDB() { }

    async exportDB() { }

    async destroyAll() {
        // 什么也没有发生
    }

    async diagnoseAndFixDatabase(): Promise<number> {
        // 服务器模式下，诊断和修复功能在服务器端
        return 0;
    }

    async deleteExpression(expression: string): Promise<void> {
        let request: RequestUrlParam = {
            url: `${this.proto}://${this.host}:${this.port}${this.prefix}/delete`,
            method: "POST",
            body: JSON.stringify({ expression }),
            contentType: "application/json",
            headers: this.baseHeaders,
        };
        try {
            await requestUrl(request);
        } catch (e) {
            logger.warn("Error deleting expression: " + e);
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
        return result;
    }

    async batchUpdateStatus(expressions: string[], newStatus: number): Promise<BatchResult> {
        const result: BatchResult = { success: 0, failed: 0, errors: [] };
        for (const expr of expressions) {
            try {
                let request: RequestUrlParam = {
                    url: `${this.proto}://${this.host}:${this.port}${this.prefix}/update`,
                    method: "POST",
                    body: JSON.stringify({ expression: expr, status: newStatus }),
                    contentType: "application/json",
                    headers: this.baseHeaders,
                };
                await requestUrl(request);
                result.success++;
            } catch (e) {
                result.failed++;
                result.errors.push({ expression: expr, error: String(e) });
            }
        }
        return result;
    }

    async batchAddTag(expressions: string[], tag: string): Promise<BatchResult> {
        const result: BatchResult = { success: 0, failed: 0, errors: [] };
        for (const expr of expressions) {
            try {
                let request: RequestUrlParam = {
                    url: `${this.proto}://${this.host}:${this.port}${this.prefix}/tag`,
                    method: "POST",
                    body: JSON.stringify({ expression: expr, tag }),
                    contentType: "application/json",
                    headers: this.baseHeaders,
                };
                await requestUrl(request);
                result.success++;
            } catch (e) {
                result.failed++;
                result.errors.push({ expression: expr, error: String(e) });
            }
        }
        return result;
    }

    async findExpression(word: string): Promise<LemmaMatchResult> {
        try {
            let request: RequestUrlParam = {
                url: `${this.proto}://${this.host}:${this.port}${this.prefix}/find`,
                method: "POST",
                body: JSON.stringify({ word }),
                contentType: "application/json",
                headers: this.baseHeaders,
            };

            const response = await requestUrl(request);
            const result = JSON.parse(response.text) as LemmaMatchResult;

            logger.log(`WebDb.findExpression("${word}"):`, result);
            return result;
        } catch (error) {
            logger.error(`WebDb.findExpression failed for "${word}":`, error);
            return {
                found: false,
                expression: word.toLowerCase(),
                display_text: `${word} 远程查询失败`
            };
        }
    }

    async addVariantToExpression(expression: string, variant: string, meta?: {label?: string, labelZh?: string, meaning_cn?: string}): Promise<boolean> {
        try {
            let request: RequestUrlParam = {
                url: `${this.proto}://${this.host}:${this.port}${this.prefix}/add-variant`,
                method: "POST",
                body: JSON.stringify({ expression, variant, meta }),
                contentType: "application/json",
                headers: this.baseHeaders,
            };

            const response = await requestUrl(request);
            const result = JSON.parse(response.text) as { success: boolean };

            logger.log(`WebDb.addVariantToExpression("${expression}", "${variant}"):`, result);
            return result.success;
        } catch (error) {
            logger.error(`WebDb.addVariantToExpression failed:`, error);
            return false;
        }
    }

    async removeVariantFromExpression(expression: string, variant: string): Promise<boolean> {
        try {
            let request: RequestUrlParam = {
                url: `${this.proto}://${this.host}:${this.port}${this.prefix}/remove-variant`,
                method: "POST",
                body: JSON.stringify({ expression, variant }),
                contentType: "application/json",
                headers: this.baseHeaders,
            };

            const response = await requestUrl(request);
            const result = JSON.parse(response.text) as { success: boolean };

            logger.log(`WebDb.removeVariantFromExpression("${expression}", "${variant}"):`, result);
            return result.success;
        } catch (error) {
            logger.error(`WebDb.removeVariantFromExpression failed:`, error);
            return false;
        }
    }

    async importFromWordDB(_wordDBText: string): Promise<number> {
        logger.warn("WebDb.importFromWordDB: import from wordDB is not supported in remote mode");
        return 0;
    }

    async getLevelStats(): Promise<Record<string, number>> {
        logger.warn("WebDb.getLevelStats: not supported in remote mode, returning empty");
        return {};
    }

    async getByLevel(_level: string): Promise<ExpressionInfoSimple[]> {
        logger.warn("WebDb.getByLevel: not supported in remote mode, returning empty array");
        return [];
    }

}