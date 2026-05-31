interface ArticleWords {
    article: string;
    words: string[];
}

interface Word {
    text: string;
    status: number;
}

interface Phrase {
    text: string;
    status: number;
    offset: number;
}

interface WordsPhrase {
    words: Word[];
    phrases: Phrase[];
}

interface Sentence {
    text: string;
    trans: string;
    origin: string;
}

// 词形变体条目（带语义信息）
interface VariantEntry {
    variant: string;       // 变体拼写，如 "called", "scientists"
    label?: string;        // 短标签，如 "ed", "pl", "er"
    labelZh?: string;      // 中文类型标签，如 "过去分词", "名词复数"
    meaning_cn?: string;   // 中文含义（继承原词或独立查询）
}

interface ExpressionInfo {
    expression: string;
    meaning: string;
    meaning_en?: string;
    meaning_cn?: string;
    meanings?: string[];
    status: number;
    t: string;
    tags: string[];
    notes: string[];
    sentences: Sentence[];
    lemma_variants?: string[] | VariantEntry[];
    variant_refs?: string[];
    original_input?: string;
}

interface ExpressionInfoSimple {
    id: number;
    expression: string;
    meaning_en: string;
    meaning_cn: string;
    status: number;
    t: string;
    tags: string[];
    note_num: number;
    sen_num: number;
    date: number;
    lemma_variants?: string[] | VariantEntry[];  // 兼容旧格式 + 新格式
}

interface LemmaMatchResult {
    found: boolean;
    expression: string;
    matched_lemma?: string;
    match_type?: 'exact' | 'lemma' | 'variant';
    status?: number;
    display_text?: string;
}

interface CountInfo {
    word_count: number[];
    phrase_count: number[];
}


interface Span {
    from: number;
    to: number;
}

interface WordCount {
    today: number[];
    accumulated: number[];
}


interface BatchError {
    expression: string;
    error: string;
}

interface BatchResult {
    success: number;
    failed: number;
    errors: BatchError[];
}

interface SearchQuery {
    text?: string;
    regex?: string;
    tags?: string[];
    tagsExclude?: string[];
    status?: number[];
    hasNotes?: boolean;
    hasSentences?: boolean;
    type?: string;
}

export type {
    ArticleWords, Word, Phrase, WordsPhrase, Sentence,
    ExpressionInfo, ExpressionInfoSimple, CountInfo, WordCount, Span,
    BatchResult, BatchError, SearchQuery, LemmaMatchResult, VariantEntry
};