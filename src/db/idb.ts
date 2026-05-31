import Dexie from "dexie";
import Plugin from "@/plugin";
import { VariantEntry } from "./interface";

export default class WordDB extends Dexie {
    expressions: Dexie.Table<Expression, number>;
    sentences: Dexie.Table<Sentence, number>;
    plugin: Plugin;
    dbName: string;
    constructor(plugin: Plugin) {
        super(plugin.settings.db_name);
        this.plugin = plugin;
        this.dbName = plugin.settings.db_name;
        this.version(1).stores({
            expressions: "++id, &expression, status, t, date, *tags, meaning_cn",
            sentences: "++id, &text"
        });
        this.version(2).stores({
            expressions: "++id, &expression, status, t, date, *tags, meaning_cn, *variant_refs",
            sentences: "++id, &text"
        });
    }
}

interface Expression {
    id?: number,
    expression: string,
    meaning: string,
    meaning_en?: string,
    meaning_cn?: string,
    meanings?: string[],
    status: number,
    t: string,
    date: number,
    notes: string[],
    tags: Set<string>,
    sentences: Set<number>,
    connections: Map<string, string>,
    lemma_variants?: string[] | VariantEntry[],
    variant_refs?: string[],
    original_input?: string,
}
interface Sentence {
    id?: number;
    text: string,
    trans: string,
    origin: string,
}