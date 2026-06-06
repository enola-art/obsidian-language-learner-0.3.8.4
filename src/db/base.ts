import {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    BatchResult, LemmaMatchResult
} from "./interface";


abstract class DbProvider {
    abstract open(): Promise<void>;
    abstract close(): void;
    // 在文章中寻找之前记录过的单词和词组
    abstract getStoredWords(payload: ArticleWords): Promise<WordsPhrase>;
    // 查询单个单词/词组的全部信息
    abstract getExpression(expression: string): Promise<ExpressionInfo>;
    //获取一批单词的简略信息
    abstract getExpressionsSimple(expressions: string[]): Promise<ExpressionInfoSimple[]>;
    // 某一时间之后添加的全部单词
    abstract getExpressionAfter(time: string): Promise<ExpressionInfo[]>;
    // 获取全部单词的简略信息
    abstract getAllExpressionSimple(ignores?: boolean): Promise<ExpressionInfoSimple[]>;
    // 发送单词信息到数据库保存
    abstract postExpression(payload: ExpressionInfo, preserveDate?: boolean): Promise<number>;
    // 获取所有tag
    abstract getTags(): Promise<string[]>;
    // 批量发送单词，全部标记为ignore
    abstract postIgnoreWords(payload: string[]): Promise<void>;
    // 查询一个例句是否已经记录过
    abstract tryGetSen(text: string): Promise<Sentence>;
    // 获取各类单词的个数
    abstract getCount(): Promise<CountInfo>;
    // 获取7天内的统计信息
    abstract countSeven(): Promise<WordCount[]>;
    // 销毁数据库
    abstract destroyAll(): Promise<void>;
    // 导入数据库
    abstract importDB(data: any): Promise<void>;
    // 导出数据库
    abstract exportDB(): Promise<void>;
    // 诊断和清理数据库 (修复错位 + 去重, 单次全表扫描)
    abstract diagnoseAndCleanDatabase(): Promise<{ fixed: number; removed: number }>;
    // 删除单个单词
    abstract deleteExpression(expression: string): Promise<void>;
    // 批量删除单词
    abstract deleteExpressions(expressions: string[]): Promise<BatchResult>;
    // 批量更新状态
    abstract batchUpdateStatus(expressions: string[], newStatus: number): Promise<BatchResult>;
    // 批量添加标签
    abstract batchAddTag(expressions: string[], tag: string): Promise<BatchResult>;
    // 智能查询单词（支持词形反哺）
    abstract findExpression(word: string): Promise<LemmaMatchResult>;
    // 添加变体到单词
    abstract addVariantToExpression(expression: string, variant: string, meta?: {label?: string, labelZh?: string, meaning_cn?: string}): Promise<boolean>;
    // 从单词移除变体
    abstract removeVariantFromExpression(expression: string, variant: string): Promise<boolean>;
    // 从 wordDB 文本导入单词（含乱码检测、preserveDate）
    abstract importFromWordDB(wordDBText: string): Promise<number>;
    // 获取单词总数
    abstract getExpressionCount(): Promise<number>;
    // 获取各考试级别的单词数量统计
    abstract getLevelStats(): Promise<Record<string, number>>;
    // 获取指定考试级别的所有单词
    abstract getByLevel(level: string): Promise<ExpressionInfoSimple[]>;
}


export default DbProvider;