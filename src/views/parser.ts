import type { Root, Content, Literal, Parent, Sentence } from "nlcst";
import { Phrase, Word } from "@/db/interface";
import Plugin from "@/plugin";

const STATUS_MAP = ["ignore", "learning", "familiar", "known", "learned"];
type AnyNode = Root | Content | Content[];

let _nlp: any = null;
let _nlpLoadPromise: Promise<void> | null = null;

async function _ensureNlp(plugin: Plugin): Promise<void> {
    if (_nlp) return;
    if (_nlpLoadPromise) return _nlpLoadPromise;
    _nlpLoadPromise = (async () => {
        const pluginDir = (plugin.manifest as any).dir
            || `.obsidian/plugins/${plugin.manifest.id}`;
        const mod = await import(`${pluginDir}/nlp-bundle.mjs`);
        _nlp = mod;
    })();
    return _nlpLoadPromise;
}

export class TextParser {
    phrases: Phrase[] = [];
    words: Map<string, Word> = new Map<string, Word>();
    pIdx: number = 0;
    plugin: Plugin;
    processor: any = null;
    private _phraseModifier: any = null;

    constructor(plugin: Plugin) {
        this.plugin = plugin;
    }

    get phraseModifier(): any {
        return this._phraseModifier;
    }

    async _ensureProcessor() {
        if (this.processor) return;
        await _ensureNlp(this.plugin);
        this._phraseModifier = _nlp.modifyChildren(this.wrapWord2Phrase.bind(this));
        this.processor = _nlp.unified()
            .use(_nlp.retextEnglish)
            .use(this.addPhrases())
            .use(this.stringfy2HTML());
    }

    async parse(data: string) {
        await this._ensureProcessor();
        let newHTML = await this.text2HTML(data.trim());
        return newHTML;
    }

    async countWords(text: string): Promise<[number, number, number]> {
        await this._ensureProcessor();
        const ast = this.processor.parse(text);
        let wordSet: Set<string> = new Set();
        _nlp.visit(ast, "WordNode", (word: any) => {
            let text = _nlp.toString(word).toLowerCase();
            if (/[0-9\u4e00-\u9fa5]/.test(text)) return;
            wordSet.add(text);
        });
        let stored;
        try {
            stored = await this.plugin.db.getStoredWords({
                article: "",
                words: [...wordSet],
            });
        } catch (e) {
            console.warn("[TextParser] countWords DB lookup failed:", e);
            return [wordSet.size, 0, 0];
        }
        let ignore = 0;
        stored.words.forEach((word: any) => {
            if (word.status === 0) ignore++;
        });
        let learn = stored.words.length - ignore;
        let unknown = wordSet.size - stored.words.length;
        return [unknown, learn, ignore];
    }

    async text2HTML(text: string) {
        this.pIdx = 0;
        this.words.clear();

        try {
            this.phrases = (
                await this.plugin.db.getStoredWords({
                    article: text.toLowerCase(),
                    words: [],
                })
            ).phrases;
        } catch (dbErr) {
            console.warn("[TextParser] Phrase lookup failed, continuing without phrases:", dbErr);
            this.phrases = [];
        }

        const ast = this.processor.parse(text);

        let wordSet: Set<string> = new Set();
        _nlp.visit(ast, "WordNode", (word: any) => {
            wordSet.add(_nlp.toString(word).toLowerCase());
        });

        let stored;
        try {
            stored = await this.plugin.db.getStoredWords({
                article: "",
                words: [...wordSet],
            });
        } catch (dbErr2) {
            console.warn("[TextParser] Word status lookup failed, all words will be 'new':", dbErr2);
            stored = { words: [] };
        }

        stored.words.forEach((w: any) => this.words.set(w.text, w));

        let HTML = this.processor.stringify(ast) as any as string;
        return HTML;
    }

    async getWordsPhrases(text: string) {
        await this._ensureProcessor();
        const ast = this.processor.parse(text);
        let words: Set<string> = new Set();
        _nlp.visit(ast, "WordNode", (word: any) => {
            words.add(_nlp.toString(word).toLowerCase());
        });
        let wordsPhrases = await this.plugin.db.getStoredWords({
            article: text.toLowerCase(),
            words: [...words],
        });

        let payload = [] as string[];
        wordsPhrases.phrases.forEach((word: any) => {
            if (word.status > 0) payload.push(word.text);
        });
        wordsPhrases.words.forEach((word: any) => {
            if (word.status > 0) payload.push(word.text);
        });

        let res = await this.plugin.db.getExpressionsSimple(payload);
        return res;
    }

    addPhrases() {
        let selfThis = this;
        return function (option = {}) {
            const proto = this.Parser.prototype;
            proto.useFirst("tokenizeParagraph", selfThis.phraseModifier);
        };
    }

    wrapWord2Phrase(node: Content, index: number, parent: Parent) {
        if (!node.hasOwnProperty("children")) return;

        if (
            this.pIdx >= this.phrases.length ||
            node.position.end.offset <= this.phrases[this.pIdx].offset
        )
            return;

        let children = (node as Sentence).children;

        let p: number;
        while (
            (p = children.findIndex(
                (child) =>
                    child.position.start.offset ===
                    this.phrases[this.pIdx].offset
            )) !== -1
        ) {
            let q = children.findIndex(
                (child) =>
                    child.position.end.offset ===
                    this.phrases[this.pIdx].offset +
                    this.phrases[this.pIdx].text.length
            );

            if (q === -1) {
                this.pIdx++;
                return;
            }
            let phrase = children.slice(p, q + 1);
            children.splice(p, q - p + 1, {
                type: "PhraseNode",
                children: phrase,
                position: {
                    start: { ...phrase.first().position.start },
                    end: { ...phrase.last().position.end },
                },
            } as any);

            this.pIdx++;

            if (
                this.pIdx >= this.phrases.length ||
                node.position.end.offset <= this.phrases[this.pIdx].offset
            )
                return;
        }
    }

    stringfy2HTML() {
        let selfThis = this;
        return function () {
            Object.assign(this, {
                Compiler: selfThis.compileHTML.bind(selfThis),
            });
        };
    }

    compileHTML(tree: Root): string {
        return this.toHTMLString(tree);
    }

    toHTMLString(node: AnyNode): string {
        if (node.hasOwnProperty("value")) {
            return (node as Literal).value;
        }
        if (node.hasOwnProperty("children")) {
            let n = node as Parent;
            switch (n.type) {
                case "WordNode": {
                    let text = _nlp.toString(n.children);
                    let textLower = text.toLowerCase();
                    let status = this.words.has(textLower)
                        ? STATUS_MAP[this.words.get(textLower).status]
                        : "new";

                    let isAbbreviation = /^[A-Za-z]+\.$/.test(text) || 
                        (text.includes(".") && text.length <= 5 && /^[A-Za-z.]+$/.test(text));

                    if (isAbbreviation && !this.words.has(textLower)) {
                        let textWithoutDot = textLower.replace(/\./g, '');
                        if (this.words.has(textWithoutDot)) {
                            status = STATUS_MAP[this.words.get(textWithoutDot).status];
                        }
                    }

                    return /[0-9\u4e00-\u9fa5]/.test(text)
                        ? `<span class="other">${text}</span>`
                        : `<span class="word ${status}">${text}</span>`;
                }
                case "PhraseNode": {
                    let childText = _nlp.toString(n.children);
                    let text = this.toHTMLString(n.children);
                    let phrase = this.phrases.find(
                        (p) => p.text === childText.toLowerCase()
                    );
                    let status = STATUS_MAP[phrase.status];

                    return `<span class="phrase ${status}">${text}</span>`;
                }
                case "SentenceNode": {
                    return `<span class="stns">${this.toHTMLString(
                        n.children
                    )}</span>`;
                }
                case "ParagraphNode": {
                    return `<p>${this.toHTMLString(n.children)}</p>`;
                }
                default: {
                    return `<div class="article">${this.toHTMLString(
                        n.children
                    )}</div>`;
                }
            }
        }
        if (Array.isArray(node)) {
            let nodes = node as Content[];
            return nodes.map((n) => this.toHTMLString(n)).join("");
        }
    }
}