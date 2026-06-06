import {
    Notice,
    Plugin,
    Menu,
    WorkspaceLeaf,
    ViewState,
    MarkdownView,
    Editor,
    TFile,
    normalizePath,
    Platform,
} from "obsidian";
import { around } from "monkey-around";
import { createApp, App as VueApp } from "vue";

import { SearchPanelView, SEARCH_ICON, SEARCH_PANEL_VIEW } from "./views/SearchPanelView";
import { READING_VIEW_TYPE, READING_ICON, ReadingView } from "./views/ReadingView";
import { LearnPanelView, LEARN_ICON, LEARN_PANEL_VIEW } from "./views/LearnPanelView";
// StatView is lazy-loaded via stat-bundle.mjs (echarts ~1MB excluded from main bundle)
const STAT_VIEW_TYPE = 'langr-stat';
const STAT_ICON = 'bar-chart-4';
import { DataPanelView, DATA_ICON, DATA_PANEL_VIEW } from "./views/DataPanelView";
// import { PDFView, PDF_FILE_EXTENSION, VIEW_TYPE_PDF } from "./views/PDFView";

import { t } from "./lang/helper";
import DbProvider from "./db/base";
import { WebDb } from "./db/web_db";
import { LocalDb } from "./db/local_db";
import { TextParser } from "./views/parser";
import { FrontMatterManager } from "./utils/frontmatter";
import Server from "./api/server";

import { DEFAULT_SETTINGS, MyPluginSettings, SettingTab } from "./settings";
import store from "./store";
import { playAudio } from "./utils/helpers";
import { logger } from "./utils/logger";
import type { Position } from "./constant";
import { InputModal } from "./modals";
import { search as youdaoSearch, YoudaoResultLex } from "./dictionary/youdao/engine";
import type { Sentence } from "./db/interface";

import Global from "./views/Global.vue";
import {
    detectGarbledWords,
    formatGarbledReport
} from "./utils/garbled-detector";
import type { GarbledWordResult } from "./utils/garbled-detector";
import { loadVariantData, isVariantDataLoaded } from "./data/ecdict-variants-reverse";
import { loadForwardVariantData, isForwardVariantDataLoaded } from "./data/ecdict-variants";
import { loadExamVocabData, getWordExamLevels, isExamVocabDataLoaded } from "./data/exam-vocab";



export const FRONT_MATTER_KEY: string = "langr";
const DB_BACKUP_PATH = ".obsidian/langr-db.json";

export default class LanguageLearner extends Plugin {
    constants: { basePath: string; platform: "mobile" | "desktop"; };
    settings: MyPluginSettings;
    appEl: HTMLElement;
    vueApp: VueApp;
    db: DbProvider;
    server: Server;
    _parser: TextParser | null = null;
    get parser(): TextParser {
        if (!this._parser) this._parser = new TextParser(this);
        return this._parser;
    }
    markdownButtons: Record<string, HTMLElement> = {};
    frontManager: FrontMatterManager;
    store: typeof store = store;
    _StatView: any = null;
    _saveTimer: number = null;
    _wordDbTimer: number = null;

    async onload() {
        try {
            await this._onload();
        } catch (error) {
            logger.error("Plugin initialization failed:", error);
            new Notice(`Language Learner 插件加载失败: ${error.message || error}`);
        }
    }

    private async _onload() {
        // 读取设置
        await this.loadSettings();
        this.addSettingTab(new SettingTab(this.app, this));

        this.registerConstants();

        // 打开数据库
        this.db = this.settings.use_server
            ? new WebDb(
                this.settings.host,
                this.settings.port,
                this.settings.use_https,
                this.settings.api_key
                )
            : new LocalDb(this);
        await this.db.open();

        // 后台预加载 stat-bundle (echarts ~1MB)，不阻塞 UI，尽早启动
        this._preloadStatBundle();

        // vault 内 langr-db.json 为主存储，IndexedDB 仅为运行时缓存
        this.app.workspace.onLayoutReady(async () => {
            // 监听数据变更事件，自动同步到 vault
            addEventListener("obsidian-langr-data-change", () => {
                this.scheduleDbSave();
                this.scheduleWordDbRefresh();
            });

            if (!this.settings.use_server) {
                // 变体功能关闭时：仅恢复数据库，零额外 I/O
                // 变体功能开启时：并行加载 exam-vocab + 恢复数据库
                const tasks: Promise<any>[] = [this.restoreDbFromVault()];
                if (this.settings.enable_variant_features) {
                    tasks.push(this._loadVariantIndex());
                }
                const [restored] = await Promise.all(tasks);

                if (!restored && this.settings.word_database) {
                    // vault 没有备份，检查 IndexedDB 中是否已有数据
                    const localDb = this.db as LocalDb;
                    const existingCount = await localDb.getExpressionCount();
                    if (existingCount > 0) {
                        // IndexedDB 有残留数据（上次未成功保存到 vault），保留这些数据
                        logger.log(`Vault backup not found, but IndexedDB has ${existingCount} existing entries - preserving them`);
                        new Notice(t("Preserved N words from cache").replace("N", String(existingCount)));
                    } else {
                        // IndexedDB 也为空，从 wordDB.md 导入（仅作为最后手段）
                        await this.importWordDB();
                    }
                } else if (restored) {
                    // 从 vault 恢复后，诊断并修复数据 (单次全表扫描)
                    const localDb = this.db as LocalDb;
                    const { fixed, removed } = await localDb.diagnoseAndCleanDatabase();
                    if (fixed > 0 || removed > 0) {
                        new Notice(t("Fixed N corrupted word entries").replace("N", String(fixed + removed)));
                    }
                }

                // 确保 vault 文件存在且最新
                this.scheduleDbSave();
            } else if (this.settings.enable_variant_features) {
                await this._loadVariantIndex();
            }
        });

        // FrontMatter 管理器（轻量，启动时可初始化）
        this.frontManager = new FrontMatterManager(this.app);

        // 打开内置服务器
        this.server = this.settings.self_server
            ? new Server(this, this.settings.self_port)
            : null;
        await this.server?.start();

        // test
        // this.addCommand({
        // 	id: "langr-test",
        // 	name: "Test for langr",
        // 	callback: () => new Notice("hello!")
        // })

        // await this.replacePDF();

        this.initStore();

        this.addCommands();
        this.registerCustomViews();
        this.registerReadingToggle();
        this.registerContextMenu();
        this.registerLeftClick();
        this.registerMouseup();
        this.registerEvent(
            this.app.workspace.on("css-change", () => {
                store.dark = document.body.hasClass("theme-dark");
                store.themeChange = !store.themeChange;
            })
        );

        // 创建全局app用于各种浮动元素
        this.appEl = document.body.createDiv({ cls: "langr-app" });
        this.vueApp = createApp(Global);
        this.vueApp.config.globalProperties.plugin = this;
        this.vueApp.mount(this.appEl);
    }

    async onunload() {
        try {
            // 退出前保存数据库到 vault
            await this.saveDbToVault();

            this.app.workspace.detachLeavesOfType(SEARCH_PANEL_VIEW);
            this.app.workspace.detachLeavesOfType(LEARN_PANEL_VIEW);
            this.app.workspace.detachLeavesOfType(DATA_PANEL_VIEW);
            this.app.workspace.detachLeavesOfType(STAT_VIEW_TYPE);
            this.app.workspace.detachLeavesOfType(READING_VIEW_TYPE);

            this.db.close();
            this.server?.close();

            this.vueApp.unmount();
            this.appEl.remove();
            this.appEl = null;

            if (this._saveTimer) clearTimeout(this._saveTimer);
            if (this._wordDbTimer) clearTimeout(this._wordDbTimer);
        } catch (error) {
            logger.error("Plugin unload failed:", error);
        }
    }

    registerConstants() {
        this.constants = {
            basePath: normalizePath((this.app.vault.adapter as any).basePath),
            platform: Platform.isMobile ? "mobile" : "desktop",
        };
    }

    /** 异步加载数据 JSON 文件 (避开 main.js bundle, 减少启动阻塞) */
    private async _loadVariantIndex() {
        const pluginDir = (this.manifest as any).dir
            || `.obsidian/plugins/${this.manifest.id}`;

        // 仅加载考试词汇数据 (454KB)，变体数据 (~4MB) 按需懒加载
        try {
            const path = normalizePath(`${pluginDir}/exam-vocab.json`);
            const text = await this.app.vault.adapter.read(path);
            await loadExamVocabData(text);
            logger.log(`Exam vocab data loaded (${(text.length / 1024).toFixed(0)} KB)`);
        } catch (e) {
            logger.warn("Exam vocab data not loaded:", e);
        }
    }

    /** 按需加载全部变体功能数据（exam-vocab 454KB + 变体 ~4MB），由设置开关或首次使用触发 */
    async loadVariantFeatures() {
        await Promise.all([
            this._loadVariantIndex(),
            this.ensureVariantDataLoaded(),
        ]);
    }

    /** 按需加载变体数据 (正向 3.2MB + 反向 749KB)，仅在 enable_variant_features 开启后调用 */
    async ensureVariantDataLoaded() {
        const pluginDir = (this.manifest as any).dir
            || `.obsidian/plugins/${this.manifest.id}`;

        await Promise.all([
            (async () => {
                if (isVariantDataLoaded()) return;
                try {
                    const path = normalizePath(`${pluginDir}/variants-reverse.json`);
                    const text = await this.app.vault.adapter.read(path);
                    await loadVariantData(text);
                    logger.log(`Variant reverse index loaded (${(text.length / 1024).toFixed(0)} KB)`);
                } catch (e) {
                    logger.warn("Variant reverse index not loaded:", e);
                }
            })(),
            (async () => {
                if (isForwardVariantDataLoaded()) return;
                try {
                    const path = normalizePath(`${pluginDir}/variants.json`);
                    const text = await this.app.vault.adapter.read(path);
                    await loadForwardVariantData(text);
                    logger.log(`Variant forward map loaded (${(text.length / 1024).toFixed(0)} KB)`);
                } catch (e) {
                    logger.warn("Variant forward map not loaded:", e);
                }
            })(),
        ]);
    }

    /** 后台预加载 stat-bundle (echarts ~1MB)，不阻塞主线程 */
    private async _preloadStatBundle() {
        try {
            const pluginDir = (this.manifest as any).dir
                || `.obsidian/plugins/${this.manifest.id}`;
            const mod = await import(normalizePath(`${pluginDir}/stat-bundle.mjs`));
            this._StatView = mod.StatView;
            logger.log("Stat bundle preloaded");
        } catch (e) {
            logger.warn("Stat bundle preload failed:", e);
        }
    }

    // async replacePDF() {
    //     if (await app.vault.adapter.exists(
    //         ".obsidian/plugins/obsidian-language-learner/pdf/web/viewer.html"
    //     )) {
    //         this.registerView(VIEW_TYPE_PDF, (leaf) => {
    //             return new PDFView(leaf);
    //         });

    //         (this.app as any).viewRegistry.unregisterExtensions([
    //             PDF_FILE_EXTENSION,
    //         ]);
    //         this.registerExtensions([PDF_FILE_EXTENSION], VIEW_TYPE_PDF);

    //         this.registerDomEvent(window, "message", (evt) => {
    //             if (evt.data.type === "search") {
    //                 // if (evt.data.funckey || this.store.searchPinned)
    //                 this.queryWord(evt.data.selection);
    //             }
    //         });
    //     }
    // }

    initStore() {
        this.store.dark = document.body.hasClass("theme-dark");
        this.store.themeChange = false;
        this.store.fontSize = this.settings.font_size;
        this.store.fontFamily = this.settings.font_family;
        this.store.lineHeight = this.settings.line_height;
        this.store.popupSearch = this.settings.popup_search;
        this.store.searchPinned = false;
        this.store.dictsChange = false;
        this.store.dictHeight = this.settings.dict_height;
        this.store.learnPanelFontSize = this.settings.learn_panel_font_size;
    }

    addCommands() {
        // 注册刷新单词数据库命令
        this.addCommand({
            id: "langr-refresh-word-database",
            name: t("Refresh Word Database"),
            callback: this.refreshWordDb,
        });

        // 注册刷新复习数据库命令
        this.addCommand({
            id: "langr-refresh-review-database",
            name: t("Refresh Review Database"),
            callback: this.refreshReviewDb,
        });

        // 注册打开查词面板命令
        this.addCommand({
            id: "langr-open-search-panel",
            name: "Open Search Panel" as any,
            callback: () => {
                this.activateView(SEARCH_PANEL_VIEW, "left");
            },
        });

        // 注册打开新词面板命令
        this.addCommand({
            id: "langr-open-learn-panel",
            name: "Open Learn Panel" as any,
            callback: () => {
                this.activateView(LEARN_PANEL_VIEW, "right");
            },
        });

        // 注册打开统计面板命令
        this.addCommand({
            id: "langr-open-stat-panel",
            name: "Open Statistics Panel" as any,
            callback: () => {
                this.activateView(STAT_VIEW_TYPE, "right");
            },
        });

        // 注册打开数据面板命令
        this.addCommand({
            id: "langr-open-data-panel",
            name: "Open Data Panel" as any,
            callback: () => {
                this.activateView(DATA_PANEL_VIEW, "tab");
            },
        });

        // 注册查词命令
        this.addCommand({
            id: "langr-search-word-select",
            name: "Translate Selected" as any,
            callback: () => {
                let selection = window.getSelection().toString().trim();
                this.queryWord(selection);
            },
        });
        this.addCommand({
            id: "langr-search-word-input",
            name: t("Translate Input"),
            callback: () => {
                const modal = new InputModal(this.app, (text) => {
                    this.queryWord(text);
                });
                modal.open();
            },
        });

        // 注册添加单词命令
        this.addCommand({
            id: "langr-add-word",
            name: "Add Word" as any,
            callback: () => {
                let selection = window.getSelection().toString().trim();
                this.addWordFromSelection(selection);
            },
        });

        // 一次性补全存量单词的考试级别标签
        this.addCommand({
            id: "langr-backfill-exam-tags",
            name: "Backfill exam level tags" as any,
            callback: () => this.backfillExamTags(),
        });
    }

    async backfillExamTags() {
        // 按需加载 exam-vocab 数据（即使 enable_variant_features=false 也能执行）
        if (!isExamVocabDataLoaded()) {
            await this._loadVariantIndex();
        }
        if (!isExamVocabDataLoaded()) {
            new Notice("Failed to load exam vocab data");
            return;
        }
        const localDb = this.db as any;
        const allRecords = await localDb.idb.expressions.toArray();
        if (!allRecords || allRecords.length === 0) {
            new Notice("No words in database");
            return;
        }
        let updated = 0;
        let skipped = 0;
        let repaired = 0;
        const needRepair: { id: number; tags: Set<string> }[] = [];
        for (const record of allRecords) {
            const expr = record.expression?.toLowerCase?.() || '';
            if (!expr) { skipped++; continue; }
            let existingTags: string[];
            if (record.tags instanceof Set) {
                existingTags = [...record.tags];
            } else if (Array.isArray(record.tags)) {
                existingTags = record.tags.filter((t: any) => typeof t === 'string' && t.length > 0);
                if (existingTags.length !== record.tags.length) {
                    needRepair.push({ id: record.id, tags: new Set(existingTags) });
                }
            } else {
                existingTags = [];
            }
            const examLevels = getWordExamLevels(expr);
            if (examLevels.length === 0) { skipped++; continue; }
            const newTags = examLevels.filter(l => !existingTags.includes(l));
            if (newTags.length === 0) { skipped++; continue; }
            const merged = new Set([...existingTags, ...newTags]);
            try {
                await localDb.idb.expressions.update(record.id, { tags: merged });
                updated++;
            } catch (e) {
                logger.warn(`Failed to update tags for "${expr}":`, e);
            }
        }
        for (const r of needRepair) {
            try {
                await localDb.idb.expressions.update(r.id, { tags: r.tags });
                repaired++;
            } catch (e) {
                logger.warn(`Failed to repair tags for id ${r.id}:`, e);
            }
        }
        new Notice(`Tags backfilled: ${updated} updated, ${skipped} skipped` + (repaired > 0 ? `, ${repaired} repaired` : ''));
        dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));
    }

    registerCustomViews() {
        // 注册查词面板视图
        this.registerView(
            SEARCH_PANEL_VIEW,
            (leaf) => new SearchPanelView(leaf, this)
        );
        this.addRibbonIcon(SEARCH_ICON, t("Open word search panel"), (evt) => {
            this.activateView(SEARCH_PANEL_VIEW, "left");
        });

        // 注册新词面板视图
        this.registerView(
            LEARN_PANEL_VIEW,
            (leaf) => new LearnPanelView(leaf, this)
        );
        this.addRibbonIcon(LEARN_ICON, t("Open new word panel"), (evt) => {
            this.activateView(LEARN_PANEL_VIEW, "right");
        });

        // 注册阅读视图
        this.registerView(
            READING_VIEW_TYPE,
            (leaf) => new ReadingView(leaf, this)
        );

        //注册统计视图 (echarts 在 stat-bundle.mjs 中，后台预加载)
        this.registerView(STAT_VIEW_TYPE, (leaf) => {
            if (!this._StatView) {
                logger.warn("Stat bundle not yet loaded, retrying...");
                this._preloadStatBundle();
                throw new Error("Statistics view is loading, please try again in a moment");
            }
            return new this._StatView(leaf, this);
        });
        this.addRibbonIcon(STAT_ICON, t("Open statistics"), async (evt) => {
            this.activateView(STAT_VIEW_TYPE, "right");
        });

        //注册单词列表视图
        this.registerView(
            DATA_PANEL_VIEW,
            (leaf) => new DataPanelView(leaf, this)
        );
        this.addRibbonIcon(DATA_ICON, t("Data Panel"), async (evt) => {
            this.activateView(DATA_PANEL_VIEW, "tab");
        });
    }

    async setMarkdownView(leaf: WorkspaceLeaf, focus: boolean = true) {
        await leaf.setViewState(
            {
                type: "markdown",
                state: leaf.view.getState(),
                //popstate: true,
            } as ViewState,
            { focus }
        );
    }

    async setReadingView(leaf: WorkspaceLeaf) {
        await leaf.setViewState({
            type: READING_VIEW_TYPE,
            state: leaf.view.getState(),
            //popstate: true,
        } as ViewState);
    }

    async refreshTextDB() {
        await this.refreshWordDb();
        await this.refreshReviewDb();
        try {
            (this.app as any).commands.executeCommandById(
                "various-complements:reload-custom-dictionaries"
            );
        } catch (e) {}
    }

    refreshWordDb = async () => {
        if (!this.settings.word_database) {
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        );
        if (!dataBase || dataBase.hasOwnProperty("children")) {
            new Notice("Invalid refresh database path");
            return;
        }
        // 获取所有非无视单词的简略信息
        let words = await this.db.getAllExpressionSimple(false);

        let classified: number[][] = Array(5)
            .fill(0)
            .map((_) => []);
        words.forEach((word, i) => {
            classified[word.status].push(i);
        });

        const statusMap = [
            t("Ignore"),
            t("Learning"),
            t("Familiar"),
            t("Known"),
            t("Learned"),
        ];

        let del = this.settings.col_delimiter;

        // 正向查询 (空字段写"空"防止窜行，换行符清洗防止格式破坏)
        const sanitize = (s: string) => (s || "空").replace(/[\n\r]+/g, " ");
        let classified_texts = classified.map((w, idx) => {
            return (
                `#### ${statusMap[idx]}\n` +
                w.map((i) => `${words[i].expression}\n${sanitize(words[i].meaning_en)}\n${sanitize(words[i].meaning_cn)}`)
                    .join("\n\n") + "\n\n"
            );
        });
        classified_texts.shift();
        let word2Meaning = classified_texts.join("\n");

        // 反向查询
        let meaning2Word = classified
            .flat()
            .map((i) => `${words[i].meaning_en || "空"}\n${words[i].meaning_cn || "空"}\n${words[i].expression}`)
            .join("\n\n");

        let text = word2Meaning + "\n\n" + "#### 反向查询\n" + meaning2Word;
        let db = dataBase as TFile;
        this.app.vault.modify(db, text);
    };

    refreshReviewDb = async () => {
        try {
            if (!this.settings.review_database) {
                console.warn("复习数据库路径未设置");
                return;
            }

            let dataBase = this.app.vault.getAbstractFileByPath(
                this.settings.review_database
            );
            if (!dataBase || "children" in dataBase) {
                new Notice("无效的复习数据库路径");
                console.error("复习数据库文件不存在:", this.settings.review_database);
                return;
            }

            let db = dataBase as TFile;
            let text = await this.app.vault.read(db);
            
            let oldRecord = {} as { [K in string]: string };
            const srMatches = text.match(/#word([\s\S]*?)(<!--SR[\s\S]*?-->)/g);
            if (srMatches) {
                srMatches.forEach((v) => {
                    const match = v.match(/#### (.+?)[\s\S]*?(<!--SR[\s\S]*?-->)/);
                    if (match && match[1] && match[2]) {
                        oldRecord[match[1].trim()] = match[2];
                    }
                });
            }

            let data = await this.db.getExpressionAfter("1970-01-01T00:00:00Z");

            console.log("复习同步：查询到总数", data.length, "个单词");
            const statusCount: { [key: number]: number } = {};
            data.forEach(w => {
                statusCount[w.status] = (statusCount[w.status] || 0) + 1;
            });
            console.log("单词状态分布：", statusCount);

            if (data.length === 0) {
                new Notice("没有需要复习的单词");
                return;
            }

            data = data.filter(word => word.status > 0);

            console.log("过滤后（status > 0）：", data.length, "个单词");

            if (data.length === 0) {
                console.log("没有已学习的单词需要同步");
                return;
            }

            const seen = new Set<string>();
            data = data.filter(word => {
                const key = word.expression.toLowerCase().trim();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            console.log("去重后：", data.length, "个单词");

            data.sort((a, b) => a.expression.localeCompare(b.expression));

            let newText = data.map((word) => {
                let notes = word.notes.length === 0
                    ? ""
                    : "**Notes**:\n" + word.notes.join("\n").trim() + "\n";
                let sentences = word.sentences.length === 0
                    ? ""
                    : "**Sentences**:\n" +
                    word.sentences.map((sen) => {
                        return (
                            `*${sen.text.trim()}*` + "\n" +
                            (sen.trans ? sen.trans.trim() + "\n" : "") +
                            (sen.origin ? sen.origin.trim() : "")
                        );
                    }).join("\n").trim() + "\n";

                return (
                    `#word\n` +
                    `#### ${word.expression}\n` +
                    `${this.settings.review_delimiter}\n` +
                    `${word.meaning}\n` +
                    `${notes}` +
                    `${sentences}` +
                    (oldRecord[word.expression] ? oldRecord[word.expression] + "\n" : "")
                );
            }).join("\n") + "\n";

            newText = "#flashcards\n\n" + newText;
            await this.app.vault.modify(db, newText);
            
            console.log("复习数据库同步完成");
            this.saveSettings();
        } catch (error) {
            console.error("同步复习数据库失败:", error);
            new Notice("同步复习数据库失败: " + error.message);
        }
    };

    importWordDB = async () => {
        if (!this.settings.word_database) {
            new Notice(t("Please set word database path first"));
            return;
        }

        let dataBase = this.app.vault.getAbstractFileByPath(
            this.settings.word_database
        );
        if (!dataBase || "children" in dataBase) {
            new Notice(t("Invalid word database path"));
            return;
        }

        let db = dataBase as TFile;
        let text = await this.app.vault.read(db);

        // 委托给 db 层的统一导入逻辑（含乱码检测、preserveDate、3行格式支持）
        const count = await this.db.importFromWordDB(text);

        new Notice(`导入完成：成功 ${count} 条`);

        this.scheduleDbSave();
        dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));
    };

    detectGarbledWords = async (): Promise<GarbledWordResult> => {
        const words = await this.db.getAllExpressionSimple(true);
        return detectGarbledWords(words);
    };

    cleanGarbledWords = async (showNotice: boolean = true): Promise<number> => {
        try {
            const words = await this.db.getAllExpressionSimple(true);
            const result = await detectGarbledWords(words);

            if (result.garbled.length === 0) {
                if (showNotice) {
                    new Notice("✅ 数据库中没有发现乱码数据");
                }
                logger.log("No garbled words found during cleanup");
                return 0;
            }

            const garbledExpressions = result.garbled.map(w => w.expression);
            const deleteResult = await this.db.deleteExpressions(garbledExpressions);

            logger.log(`Cleaned up ${deleteResult.success} garbled words, ${deleteResult.failed} failed`);

            if (deleteResult.errors.length > 0) {
                logger.warn("Some words failed to delete:", deleteResult.errors);
            }

            this.scheduleDbSave();

            if (showNotice) {
                const report = formatGarbledReport(result);
                console.log("[LanguageLearner] Garbled Word Cleanup Report:\n" + report);
                new Notice(`✅ 已删除 ${deleteResult.success} 条乱码数据`);
            }

            dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

            return deleteResult.success;
        } catch (error) {
            logger.error("Failed to clean garbled words:", error);
            if (showNotice) {
                new Notice("❌ 清理乱码数据失败: " + error.message);
            }
            return 0;
        }
    };

    // ====== 变体 Note 文件读写 ======
    private _variantCache: Map<string, Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>> | null = null;
    private _variantCacheDirty: boolean = false;

    private async _readVariantNote(): Promise<Map<string, Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>>> {
        if (this._variantCache && !this._variantCacheDirty) return this._variantCache;
        const result = new Map<string, Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>>();
        const notePath = normalizePath(this.settings.variant_note_path || "word-variants.md");
        const file = this.app.vault.getAbstractFileByPath(notePath);
        if (!file || ("children" in file)) { this._variantCache = result; return result; }
        try {
            const content = await this.app.vault.read(file as TFile);
            const lines = content.split("\n");
            let currentLemma = "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith("## ")) {
                    currentLemma = trimmed.slice(3).trim().toLowerCase();
                    if (!result.has(currentLemma)) result.set(currentLemma, []);
                } else if (trimmed.startsWith("- ") && currentLemma) {
                    const body = trimmed.slice(2).trim();
                    const parts = body.split("|").map(s => s.trim());
                    if (parts.length >= 1 && parts[0]) {
                        const entry: any = { variant: parts[0].toLowerCase() };
                        if (parts.length >= 2 && parts[1]) entry.label = parts[1];
                        if (parts.length >= 3 && parts[2]) entry.labelZh = parts[2];
                        if (parts.length >= 4 && parts[3]) entry.meaning_cn = parts[3];
                        const arr = result.get(currentLemma) || [];
                        arr.push(entry);
                        result.set(currentLemma, arr);
                    }
                }
            }
        } catch (e) { logger.warn("Failed to read variant note:", e); }
        this._variantCache = result;
        this._variantCacheDirty = false;
        return result;
    }

    private async _writeVariantNote(data: Map<string, Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>>): Promise<void> {
        const notePath = normalizePath(this.settings.variant_note_path || "word-variants.md");
        const lemmas = [...data.keys()].sort();
        const lines: string[] = ["# Word Variants", ""];
        for (const lemma of lemmas) {
            const variants = data.get(lemma) || [];
            if (variants.length === 0) continue;
            lines.push(`## ${lemma}`);
            for (const v of variants) {
                const parts = [v.variant, v.label || "", v.labelZh || "", v.meaning_cn || ""];
                lines.push(`- ${parts.join(" | ")}`);
            }
            lines.push("");
        }
        const content = lines.join("\n");
        const existing = this.app.vault.getAbstractFileByPath(notePath);
        if (existing && !("children" in existing)) {
            await this.app.vault.modify(existing as TFile, content);
        } else {
            await this.app.vault.create(notePath, content);
        }
        this._variantCache = data;
        this._variantCacheDirty = false;
    }

    private _invalidateVariantCache() {
        this._variantCache = null;
        this._variantCacheDirty = false;
    }

    // 变体管理 API
    getExpressionVariants = async (expression: string): Promise<Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>> => {
        try {
            const data = await this._readVariantNote();
            const variants = data.get(expression.toLowerCase());
            if (variants) return variants;
            const exprInfo = await this.db.getExpression(expression);
            if (exprInfo && exprInfo.lemma_variants && exprInfo.lemma_variants.length > 0) {
                const raw = exprInfo.lemma_variants;
                if (raw.length > 0 && typeof raw[0] === 'string') {
                    return (raw as string[]).map(v => ({ variant: v }));
                }
                return raw as Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>;
            }
            return [];
        } catch (error) {
            logger.error("Failed to get variants:", error);
            return [];
        }
    };

    addVariant = async (expression: string, variant: string, meta?: {label?: string, labelZh?: string, meaning_cn?: string}): Promise<boolean> => {
        try {
            const lowerVariant = variant.toLowerCase().trim();
            const lowerExpr = expression.toLowerCase().trim();
            if (!lowerVariant || lowerVariant === lowerExpr) return false;

            const data = await this._readVariantNote();
            const existing = data.get(lowerExpr) || [];
            if (existing.some(v => v.variant === lowerVariant)) return false;

            const entry: any = { variant: lowerVariant };
            if (meta?.label) entry.label = meta.label;
            if (meta?.labelZh) entry.labelZh = meta.labelZh;
            if (meta?.meaning_cn) entry.meaning_cn = meta.meaning_cn;
            data.set(lowerExpr, [...existing, entry]);
            await this._writeVariantNote(data);

            const exprRecord = await (this.db as any).idb?.expressions?.where("expression")?.equals(lowerExpr)?.first();
            if (exprRecord) {
                const refs = new Set<string>(exprRecord.variant_refs || []);
                refs.add(lowerVariant);
                await (this.db as any).idb.expressions.update(exprRecord.id, { variant_refs: [...refs] });
            }

            logger.log(`Added variant "${lowerVariant}" to "${expression}"${meta ? ` (${meta.labelZh || meta.label || ''})` : ''}`);
            this.scheduleDbSave();
            return true;
        } catch (error) {
            logger.error(`Failed to add variant "${variant}" to "${expression}":`, error);
            return false;
        }
    };

    removeVariant = async (expression: string, variant: string): Promise<boolean> => {
        try {
            const lowerVariant = variant.toLowerCase().trim();
            const lowerExpr = expression.toLowerCase().trim();
            const data = await this._readVariantNote();
            const existing = data.get(lowerExpr) || [];
            if (!existing.some(v => v.variant === lowerVariant)) return false;
            data.set(lowerExpr, existing.filter(v => v.variant !== lowerVariant));
            await this._writeVariantNote(data);

            const exprRecord = await (this.db as any).idb?.expressions?.where("expression")?.equals(lowerExpr)?.first();
            if (exprRecord) {
                const refs = new Set<string>(exprRecord.variant_refs || []);
                refs.delete(lowerVariant);
                await (this.db as any).idb.expressions.update(exprRecord.id, { variant_refs: [...refs] });
            }

            logger.log(`Removed variant "${lowerVariant}" from "${expression}"`);
            this.scheduleDbSave();
            return true;
        } catch (error) {
            logger.error(`Failed to remove variant "${variant}" from "${expression}":`, error);
            return false;
        }
    };

    saveDbToVault = async () => {
        if (this.settings.use_server) return;
        try {
            const localDb = this.db as LocalDb;
            const blob = await localDb.exportToBlob();
            const text = await blob.text();
            const path = normalizePath(DB_BACKUP_PATH);
            const existing = this.app.vault.getAbstractFileByPath(path);
            if (existing && !("children" in existing)) {
                await this.app.vault.modify(existing as TFile, text);
            } else {
                await this.app.vault.create(path, text);
            }
        } catch (e) {
            logger.error('Save db backup failed:', e);
        }
    };

    restoreDbFromVault = async (): Promise<boolean> => {
        if (this.settings.use_server) return false;
        try {
            const path = normalizePath(DB_BACKUP_PATH);
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file || "children" in file) return false;
            const text = await this.app.vault.read(file as TFile);
            if (!text || text.trim().length === 0) return false;
            const blob = new Blob([text], { type: "application/json" });
            const localDb = this.db as LocalDb;
            await localDb.importFromBlob(blob);
            return true;
        } catch (e) {
            logger.error('Restore db backup failed:', e);
            return false;
        }
    };

    scheduleDbSave = () => {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = window.setTimeout(() => {
            this.saveDbToVault();
        }, 500);
    };

    scheduleWordDbRefresh = () => {
        if (!this.settings.word_database) return;
        if (this._wordDbTimer) clearTimeout(this._wordDbTimer);
        this._wordDbTimer = window.setTimeout(() => {
            this.refreshWordDb();
        }, 2000);
    };

    // 在MardownView的扩展菜单加一个转为Reading模式的选项
    registerReadingToggle = () => {
        const pluginSelf = this;
        pluginSelf.register(
            around(MarkdownView.prototype, {
                onPaneMenu(next) {
                    return function (m: Menu) {
                        const file = this.file;
                        const cache = file.cache
                            ? pluginSelf.app.metadataCache.getFileCache(file)
                            : null;

                        if (!file ||
                            !cache?.frontmatter ||
                            !cache?.frontmatter[FRONT_MATTER_KEY]
                        ) {
                            return next.call(this, m);
                        }

                        m.addItem((item) => {
                            item.setTitle(t("Open as Reading View"))
                                .setIcon(READING_ICON)
                                .onClick(() => { pluginSelf.setReadingView(this.leaf); });
                        });

                        next.call(this, m);
                    };
                },
            })
        );

        // 增加标题栏切换阅读模式和mardown模式的按钮
        pluginSelf.register(
            around(WorkspaceLeaf.prototype, {
                setViewState(next) {
                    return function (state: ViewState, ...rest: any[]): Promise<void> {
                        return (next.apply(this, [state, ...rest]) as Promise<void>).then(() => {
                            if (state.type === "markdown" && state.state?.file) {
                                const cache = pluginSelf.app.metadataCache
                                    .getCache(state.state.file);
                                if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
                                    if (!pluginSelf.markdownButtons["reading"]) {
                                        // 在软件初始化的时候，view上面可能没有 addAction 这个方法
                                        setTimeout(() => {
                                            pluginSelf.markdownButtons["reading"] =
                                                (this.view as MarkdownView).addAction(
                                                    "view",
                                                    t("Open as Reading View"),
                                                    () => {
                                                        pluginSelf.setReadingView(this);
                                                    }
                                                );
                                            pluginSelf.markdownButtons["reading"].addClass("change-to-reading");

                                        })
                                    }
                                } else {
                                    // 在软件初始化的时候，view上面可能没有 actionsEl 这个字段
                                    (this.view.actionsEl as HTMLElement)
                                        ?.querySelectorAll(".change-to-reading")
                                        .forEach(el => el.remove());
                                    // pluginSelf.markdownButtons["reading"]?.remove();
                                    pluginSelf.markdownButtons["reading"] = null;
                                }
                            } else {
                                pluginSelf.markdownButtons["reading"] = null;
                            }
                        });
                    };
                },
            })
        );
    };

    async queryWord(word: string, target?: HTMLElement, evtPosition?: Position): Promise<void> {
        if (!word) return;

        // 清理单词，移除多余的空格和标点符号
        let cleanWord = word.trim().replace(/^[^\w]+|[^\w]+$/g, '');
        
        // 如果清理后为空，尝试再次清理（只保留单词字符）
        if (!cleanWord) {
            cleanWord = word.replace(/[^\w\s]/g, '').trim();
        }

        // 如果仍然为空，则返回
        if (!cleanWord) return;

        if (!this.settings.popup_search) {
            await this.activateView(SEARCH_PANEL_VIEW, "left");
        }

        if (target && Platform.isDesktopApp) {
            await this.activateView(LEARN_PANEL_VIEW, "right");
        }

        dispatchEvent(new CustomEvent('obsidian-langr-search', {
            detail: { selection: cleanWord, target, evtPosition }
        }));

        if (this.settings.auto_pron) {
            let accent = this.settings.review_prons;
            let wordUrl =
                `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                encodeURIComponent(cleanWord);
            playAudio(wordUrl);
        }
    }

    async addWordFromSelection(selection: string): Promise<void> {
        if (!selection || !selection.trim()) {
            new Notice(t("Please select a word or phrase"));
            return;
        }
        
        // 清理单词，移除多余的空格和标点符号
        let word = selection.trim().replace(/^[^\w]+|[^\w]+$/g, '');
        
        if (!word) {
            // 如果清理后为空，尝试再次清理
            word = selection.replace(/[^\w\s]/g, '').trim();
        }
        
        if (!word) {
            new Notice(t("Please select a word or phrase"));
            return;
        }

        // 防乱码校验
        if (/^[nviadjadvconjprep]/.test(word) && /[一-鿿]/.test(word)) {
            new Notice("Invalid word: appears to be a definition, not a word");
            return;
        }
        if (!/[a-zA-Z]/.test(word)) {
            new Notice("Please select a word containing letters");
            return;
        }
        
        let existing = await this.db.getExpression(word);
        if (existing) {
            new Notice(t("Word already exists"));
            return;
        }
        
        let meaningCn = "";
        try {
            let sr = await youdaoSearch(word);
            if (sr.result.type === "lex") {
                let r = sr.result as YoudaoResultLex;
                if (r.basic) {
                    let temp = document.createElement("div");
                    temp.innerHTML = r.basic;
                    let lis = temp.querySelectorAll("li");
                    let meanings: string[] = [];
                    const verbFormKeywords = ["复数", "第三人称单数", "现在分词", "过去式", "过去分词"];
                    for (let li of lis) {
                        let text = li.textContent?.trim() || "";
                        let isVerbForm = verbFormKeywords.some(keyword => text.includes(keyword));
                        if (!isVerbForm && text) {
                            meanings.push(text);
                        }
                    }
                    meaningCn = meanings.join("；");
                }
            }
        } catch (e) {
            logger.warn("Failed to get meaning from Youdao:", e);
        }
        
        let exprType = word.contains(" ") ? "PHRASE" : "WORD";
        
        const tags: string[] = [];
        if (isExamVocabDataLoaded()) {
            const levels = getWordExamLevels(word.toLowerCase());
            for (const level of levels) tags.push(level);
        }

        let data = {
            expression: word.toLowerCase(),
            meaning: meaningCn,
            meaning_en: "",
            meaning_cn: meaningCn,
            status: 1,
            t: exprType,
            tags,
            notes: [] as string[],
            sentences: [] as Sentence[],
        };
        
        let statusCode = await this.db.postExpression(data);
        
        if (statusCode === 200) {
            new Notice(t("Word added successfully"));
            dispatchEvent(new CustomEvent("obsidian-langr-refresh", {
                detail: {
                    expression: word,
                    type: exprType,
                    status: 1,
                },
            }));
            dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));
        } else {
            new Notice(t("Failed to add word"));
        }
    }

    // 管理所有的右键菜单
    registerContextMenu() {
        let addMemu = (mu: Menu, selection: string) => {
            mu.addItem((item) => {
                item.setTitle(t("Search word"))
                    .setIcon("info")
                    .onClick(async () => {
                        this.queryWord(selection);
                    });
            });
            
            mu.addItem((item) => {
                item.setTitle(t("Add to Learn"))
                    .setIcon("plus-circle")
                    .onClick(async () => {
                        await this.addWordFromSelection(selection);
                    });
            });
        };
        // markdown 编辑模式 右键菜单
        this.registerEvent(
            this.app.workspace.on(
                "editor-menu",
                (menu: Menu, editor: Editor, view: MarkdownView) => {
                    let selection = editor.getSelection();
                    if (selection || selection.trim().length === selection.length) {
                        addMemu(menu, selection);
                    }
                }
            )
        );
        // markdown 预览模式 右键菜单
        this.registerDomEvent(document.body, "contextmenu", (evt) => {
            if ((evt.target as HTMLElement).matchParent(".markdown-preview-view")) {
                const selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.preventDefault();
                let menu = new Menu();

                addMemu(menu, selection);

                menu.showAtMouseEvent(evt);
            }
        });
    }

    // 管理所有的左键抬起
    registerMouseup() {
        this.registerDomEvent(document.body, "pointerup", (evt) => {
            const target = evt.target as HTMLElement;
            if (!target.matchParent(".stns")) {
                // 处理普通模式
                const funcKey = this.settings.function_key;
                if ((funcKey === "disable" || evt[funcKey] === false)
                    && !(this.store.searchPinned && !target.matchParent("#langr-search,#langr-learn-panel"))
                ) return;

                // 避免在输入框、文本区域或 LearnPanel/SearchPanel/DataPanel 内部选择文本时触发查词
                if (target.tagName === "INPUT" || 
                    target.tagName === "TEXTAREA" || 
                    target.matchParent("#langr-learn-panel") ||
                    target.matchParent("#langr-search") ||
                    target.matchParent("#langr-data")) {
                    return;
                }

                let selection = window.getSelection().toString().trim();
                if (!selection) return;

                evt.stopImmediatePropagation();
                this.queryWord(selection, null, { x: evt.pageX, y: evt.pageY });
                return;
            }
        });
    }

    // 管理所有的鼠标左击
    registerLeftClick() {
        this.registerDomEvent(document.body, "click", (evt) => {
            let target = evt.target as HTMLElement;
            if (
                target.tagName === "H4" &&
                target.matchParent(".sr-modal-content")
            ) {
                let word = target.textContent;
                let accent = this.settings.review_prons;
                let wordUrl =
                    `http://dict.youdao.com/dictvoice?type=${accent}&audio=` +
                    encodeURIComponent(word);
                playAudio(wordUrl);
            }
        });
    }

    async loadSettings() {
        let settings: { [K in string]: any } = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        let data = (await this.loadData()) || {};
        for (let key in DEFAULT_SETTINGS) {
            let k = key as keyof typeof DEFAULT_SETTINGS;
            if (data[k] !== undefined) {
                if (typeof DEFAULT_SETTINGS[k] === "object" && !Array.isArray(DEFAULT_SETTINGS[k])) {
                    settings[k] = Object.assign({}, DEFAULT_SETTINGS[k], data[k]);
                } else {
                    settings[k] = data[k];
                }
            }
        }
        (this.settings as any) = settings;
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView(VIEW_TYPE: string, side: "left" | "right" | "tab") {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
            let leaf;
            switch (side) {
                case "left":
                    leaf = this.app.workspace.getLeftLeaf(false);
                    break;
                case "right":
                    leaf = this.app.workspace.getRightLeaf(false);
                    break;
                case "tab":
                    leaf = this.app.workspace.getLeaf("tab");
                    break;
            }
            await leaf.setViewState({
                type: VIEW_TYPE,
                active: true,
            });
        }
        this.app.workspace.revealLeaf(
            this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]
        );
    }
}
