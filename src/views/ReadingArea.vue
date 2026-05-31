<template>
    <div id="langr-reading" ref="reading" style="height: 100%">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig"
            style="height: 100%; display: flex; flex-direction: column">
            <!-- 功能区 -->
            <div class="function-area">
                <audio controls v-if="audioSource" :src="audioSource" />
                <div style="display: flex">
                    <button @click="activeNotes = true">做笔记</button>
                    <div style="
                            flex: 1;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        ">
                        <CountBar v-if="plugin.settings.word_count" :unknown="unknown" :learn="learn"
                            :ignore="ignore" />
                    </div>
                    <button v-if="page < maxPage" class="finish-reading" @click="addIgnores">
                        结束阅读并转入下一页
                    </button>
                    <button v-else-if="currentChunkIndex < totalChunks - 1" class="finish-reading" @click="goToNextChunk">
                        {{ t("Finish this part") || "本部分读完" }} &rarr; {{ t("Next part") || "下一部分" }}
                    </button>
                    <button v-else class="finish-reading" @click="addIgnores">
                        {{ t("Finish Reading") || "结束全部阅读" }}
                    </button>
                </div>
            </div>
            <!-- 阅读区 -->
            <div ref="textArea" class="text-area" style="
                    flex: 1;
                    overflow: auto;
                    padding-left: 5%;
                    padding-right: 5%;
                " :style="{
                    fontSize: store.fontSize,
                    fontFamily: store.fontFamily,
                    lineHeight: store.lineHeight,
                }" v-html="renderedText" />
            <!-- 底栏 -->
            <div class="pagination" style="
                    padding: 10px 0;
                    border-top: 2px solid gray;
                    display: flex;
                    flex-direction: column;
                ">
                <div class="chunk-page-info" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 16px; margin-bottom: 8px; font-size: 0.9em;">
                    <div class="chunk-indicator">
                        <template v-if="needsChunking">
                            <span
                                v-for="(ch, idx) in chunks"
                                :key="idx"
                                class="chunk-pill"
                                :class="{ active: idx === currentChunkIndex, done: idx < currentChunkIndex }"
                                @click="switchToChunk(idx)"
                            >
                                {{ String.fromCharCode(65 + idx) }}
                                <span v-if="ch.wordCount > 0">({{ formatWords(ch.wordCount) }})</span>
                            </span>
                        </template>
                        <span v-else style="color: var(--text-muted);">{{ t("Single part") || "单篇" }}</span>
                    </div>
                    <span style="font-weight: 600; color: var(--text-normal);">
                        {{ t("Page") }} {{ currentPageDisplay }} / {{ totalPagesDisplay }}
                        <span v-if="currentRangeWords > 0">({{ currentRangeWords }} {{ t("paragraphs") || "段" }})</span>
                    </span>
                    <span></span>
                </div>
                <NPagination style="justify-content: center" v-model:page="page" v-model:page-size="pageSize"
                    :item-count="currentChunkTotalLines" show-size-picker :page-sizes="pageSizes"
                    :page-slot="pageSlot" />
            </div>
            <NDrawer v-model:show="activeNotes" :placement="'bottom'" :close-on-esc="true" :auto-focus="true"
                :on-after-enter="afterNoteEnter" :on-after-leave="afterNoteLeave" to="#langr-reading"
                :default-height="250" resizable>
                <NDrawerContent title="Notes">
                    <div class="note-area">
                        <NInput class="note-input" v-model:value="notes" type="textarea" :autosize="{ minRows: 5 }" />
                        <div class="note-rendered" @mouseover="onMouseOver" ref="renderedNote"></div>
                    </div>
                </NDrawerContent>
            </NDrawer>
        </NConfigProvider>
    </div>
</template>

<script setup lang="ts">
import {
    ref,
    Ref,
    getCurrentInstance,
    computed,
    watch,
    onMounted,
    onUnmounted,
    nextTick,
    watchEffect,
} from "vue";
import {
    NPagination,
    NConfigProvider,
    darkTheme,
    NDrawer,
    NDrawerContent,
    NInput,
    GlobalThemeOverrides,
} from "naive-ui";
import { MarkdownRenderer, Platform } from "obsidian";
import PluginType from "@/plugin";
import type { LemmaMatchResult } from "@/db/interface";
import { t } from "@/lang/helper";
import { useEvent } from "@/utils/use";
import store from "@/store";
import { ReadingView } from "./ReadingView";
import CountBar from "./CountBar.vue";

let vueThis = getCurrentInstance();
let view = vueThis.appContext.config.globalProperties.view as ReadingView;
let plugin = view.plugin as PluginType;
let contentEl = view.contentEl as HTMLElement;

// 切换明亮/黑暗模式
const theme = computed(() => {
    return store.dark ? darkTheme : null;
});

const themeConfig: GlobalThemeOverrides = {
    Drawer: {
        bodyPadding: "8px 12px",
        headerPadding: "4px 6px",
        titleFontWeight: "700",
    },
};

const localPrefix = require("electron").ipcRenderer.sendSync("file-url");
// app.vault.adapter.getResourcePath("");
let frontMatter = plugin.app.metadataCache.getFileCache(view.file).frontmatter;
let audioSource = (frontMatter["langr-audio"] || "") as string;
if (audioSource && audioSource.startsWith("~/")) {
    const prefix = Platform.isDesktopApp ? localPrefix : "http://localhost/_capacitor_file_";
    audioSource =
        prefix + plugin.constants.basePath + audioSource.slice(1);
}else {
    audioSource = audioSource.startsWith("http") ? audioSource : localPrefix + audioSource;
}

// 记笔记
let activeNotes = ref(false);
let notes = ref("");
async function afterNoteEnter() {
    notes.value = await view.readContent("notes", true);
}
async function afterNoteLeave() {
    view.writeContent("notes", notes.value);
}

let renderedNote = ref<HTMLElement>();
watchEffect(async (clean) => {
    if (!renderedNote.value) return;
    await MarkdownRenderer.renderMarkdown(
        notes.value,
        renderedNote.value,
        view.file.path,
        null
    );
    clean(() => {
        renderedNote.value?.empty();
    });
});

function onMouseOver(e: MouseEvent) {
    let target = e.target as HTMLElement;
    if (target.hasClass("internal-link")) {
        app.workspace.trigger("hover-link", {
            event: e,
            source: "preview",
            hoverParent: { hoverPopover: null },
            targetEl: target,
            linktext: target.getAttr("href"),
            soursePath: view.file.path,
        });
    }
}

// 拆分文本
let lines = view.text.split("\n");
let segments = view.divide(lines);

let article: string[];
if (segments["article"]) {
    article = lines.slice(segments["article"].start, segments["article"].end);
} else {
    let fileCache = plugin.app.metadataCache.getFileCache(view.file);
    let fmEnd = 0;
    if (fileCache?.frontmatterPosition) {
        fmEnd = fileCache.frontmatterPosition.end.line + 1;
    }
    article = lines.slice(fmEnd);
}

// 过滤掉可能导致问题的分页符
article = article.map(line => line.replace(/---/g, '').trim());
article = article.filter(line => line !== '');
let totalLines = article.length;

function countWordsInText(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
}

const totalWords = ref(countWordsInText(article.join(" ")));

const lineWordCounts = article.map(line => countWordsInText(line));
const cumulativeWordCounts: number[] = [];
if (article.length > 0) {
	let cumulative = 0;
	for (const wc of lineWordCounts) {
		cumulative += wc;
		cumulativeWordCounts.push(cumulative);
	}
}

interface Chunk {
    index: number;
    startLine: number;
    endLine: number;
    wordCount: number;
    paragraphCount: number;
}

const WORD_BREAKPOINT = 10000;

function buildChunks(): Chunk[] {
    if (totalWords.value < WORD_BREAKPOINT) {
        return [{
            index: 0,
            startLine: 0,
            endLine: totalLines,
            wordCount: totalWords.value,
            paragraphCount: totalLines,
        }];
    }

    const result: Chunk[] = [];
    let chunkStart = 0;
    let chunkWordCount = 0;
    let chunkIndex = 0;

    for (let i = 0; i < totalLines; i++) {
        chunkWordCount += lineWordCounts[i] || 0;

        if (chunkWordCount >= WORD_BREAKPOINT || i === totalLines - 1) {
            result.push({
                index: chunkIndex,
                startLine: chunkStart,
                endLine: i + 1,
                wordCount: chunkWordCount,
                paragraphCount: i + 1 - chunkStart,
            });
            chunkStart = i + 1;
            chunkWordCount = 0;
            chunkIndex++;
        }
    }

    return result;
}

const chunks = buildChunks();
const totalChunks = computed(() => chunks.length);
const needsChunking = computed(() => chunks.length > 1);

const currentChunkIndex = ref(0);
const currentChunk = computed(() => chunks[currentChunkIndex.value] || null);
const currentChunkTotalLines = computed(() => currentChunk.value?.paragraphCount || totalLines);

function findLineByWordCount(wordOffset: number): number {
    if (cumulativeWordCounts.length === 0) return 0;
    if (wordOffset <= 0) return 0;
    if (wordOffset >= totalWords.value) return totalLines;

    let lo = 0, hi = cumulativeWordCounts.length - 1;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (cumulativeWordCounts[mid] <= wordOffset) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    if (cumulativeWordCounts[lo] > wordOffset && lo > 0) return lo;
    return lo + 1;
}

// 计数
let unknown = ref(0);
let learn = ref(0);
let ignore = ref(0);
let countChange = ref(true);
let refreshCount = () => {
    countChange.value = !countChange.value;
};

if (plugin.settings.word_count) {
    watch(
        [countChange],
        async () => {
            [unknown.value, learn.value, ignore.value] =
                await plugin.parser.countWords(article.join("\n"));
        },
        { immediate: true }
    );
}

// 分页渲染文本

const pageSizes = [
    { label: `1 ${t("paragraph")} / ${t("page")}`, value: 2 },
    { label: `2 ${t("paragraph")} / ${t("page")}`, value: 4 },
    { label: `4 ${t("paragraph")} / ${t("page")}`, value: 8 },
    { label: `8 ${t("paragraph")} / ${t("page")}`, value: 16 },
    { label: `16 ${t("paragraph")} / ${t("page")}`, value: 32 },
    { label: `${t("All")}`, value: Number.MAX_VALUE },
];

const currentPageDisplay = computed(() => page.value);
const totalPagesDisplay = computed(() =>
    Math.max(1, Math.ceil(currentChunkTotalLines.value / pageSize.value))
);

const currentRangeWords = computed(() => {
    const start = (page.value - 1) * pageSize.value;
    const end = Math.min(start + pageSize.value, currentChunkTotalLines.value);
    const chunkStart = currentChunk.value?.startLine || 0;
    let sum = 0;
    for (let i = chunkStart + start; i < chunkStart + end; i++) {
        sum += lineWordCounts[i] || 0;
    }
    return sum;
});

function formatWords(n: number): string {
    if (n >= 10000) return (n / 1000).toFixed(0) + "k";
    return String(n);
}

function goToNextChunk() {
    if (currentChunkIndex.value < totalChunks.value - 1) {
        currentChunkIndex.value++;
        page.value = 1;
    }
}

function switchToChunk(idx: number) {
    if (Number.isInteger(idx) && idx >= 0 && idx < totalChunks.value && idx !== currentChunkIndex.value) {
        currentChunkIndex.value = idx;
        page.value = 1;
    }
}

const pageSlot = Platform.isMobileApp ? 5 : null;

let dp = plugin.settings.default_paragraphs;
let pageSize = ref(dp === "all" ? Number.MAX_VALUE : parseInt(dp));
let maxPage = computed(() =>
    Math.max(1, Math.ceil(currentChunkTotalLines.value / pageSize.value))
);

const savedChunk = view.file.getFrontmatterValue("langr-chunk");
if (savedChunk !== undefined && needsChunking.value) {
    const parsed = parseInt(String(savedChunk));
    if (!isNaN(parsed) && parsed >= 0 && parsed < chunks.length) {
        currentChunkIndex.value = parsed;
    }
}

let page = ref(1);
const savedPos = view.file.getFrontmatterValue("langr-pos");
if (savedPos && view.lastPos) {
    const posNum = parseInt(String(savedPos).replace(/[A-Z]-/, ''));
    page.value = Math.min(Math.ceil(posNum / pageSize.value), maxPage.value);
} else if (view.lastPos) {
    page.value = Math.min(Math.ceil(view.lastPos / pageSize.value), maxPage.value);
}

let renderedText = ref("");
let psChange = ref(true); // 标志pageSize的改变
let refreshHandle = ref(true);

// pageSize变化应该使page同时进行调整以尽量保持原阅读位置
// 同时page和pageSize的改变都应该引起langr-pos的改变，但应只修改一次
// 因此引入psChange这个变量
watch([pageSize], async ([ps], [prev_ps]) => {
    let oldPage = page.value;
    page.value = Math.min(
        Math.ceil(((page.value - 1) * prev_ps + 1) / ps),
        Math.max(1, Math.ceil(currentChunkTotalLines.value / ps))
    );
    if (oldPage === page.value) {
        psChange.value = !psChange.value;
    }
});

watch(
    [page, psChange, refreshHandle, currentChunkIndex],
    async ([p, pc], [prev_p, prev_pc]) => {
        const chunk = currentChunk.value;
        if (!chunk || chunk.paragraphCount <= 0) {
            renderedText.value = "";
            return;
        }

        try {
            const startInChunk = (p - 1) * pageSize.value;
            const endInChunk = Math.min(startInChunk + pageSize.value, chunk.paragraphCount);

            const sliceStart = Math.min(chunk.startLine + startInChunk, article.length);
            const sliceEnd = Math.min(chunk.startLine + endInChunk, article.length);
            const chunkArticle = article.slice(sliceStart, sliceEnd);

            let html = await plugin.parser.parse(chunkArticle.join("\n"));

            if (plugin.settings.auto_mark_lemma_variants) {
                html = await applyLemmaMarking(html);
            }

            renderedText.value = html || "";
        } catch (err) {
            console.error("[ReadingArea] Render error:", err);
            renderedText.value = "";
        }

        if (p !== prev_p || pc != prev_pc) {
            if (needsChunking.value) {
                const chunkLetter = String.fromCharCode(65 + currentChunkIndex.value);
                plugin.frontManager.setFrontMatter(view.file, "langr-chunk", currentChunkIndex.value);
                plugin.frontManager.setFrontMatter(view.file, "langr-pos", `${chunkLetter}-${(p - 1) * pageSize.value + 1}`);
            } else {
                plugin.frontManager.setFrontMatter(
                    view.file,
                    "langr-pos",
                    `${(p - 1) * pageSize.value + 1}`
                );
            }
        }

        await nextTick();
    },
    { immediate: true }
);

// 词形反哺标记功能 (带缓存和批量优化)
const lemmaCache = new Map<string, LemmaMatchResult>();

async function applyLemmaMarking(html: string): Promise<string> {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const wordElements = doc.querySelectorAll('span.word');

        // 收集所有需要查询的单词（去重）
        const wordsToQuery = new Set<string>();
        const wordElementMap = new Map<string, HTMLElement[]>();

        for (const el of wordElements) {
            const wordText = el.textContent?.trim();
            if (!wordText || el.classList.contains('other')) continue;

            // 跳过已有非"new"状态的精确匹配（learning/familiar/known/learned）
            // 但保留 "new" 状态的单词，因为它们可能是已学习单词的变体（如 considered → consider）
            if (el.classList.contains('learning') ||
                el.classList.contains('familiar') ||
                el.classList.contains('known') ||
                el.classList.contains('learned')) {
                continue;
            }

            const lowerWord = wordText.toLowerCase();

            // 检查缓存：已缓存则直接复用结果应用到当前元素
            if (lemmaCache.has(lowerWord)) {
                const cachedResult = lemmaCache.get(lowerWord)!;
                if (cachedResult.found && (cachedResult.match_type === 'lemma' || cachedResult.match_type === 'variant')) {
                    // 移除 "new" 状态，替换为反哺标记
                    el.classList.remove('new');
                    el.classList.add('lemma-variant');
                    el.setAttribute('title', cachedResult.display_text);
                    el.dataset.matchedLemma = cachedResult.matched_lemma || '';
                }
                continue; // 缓存命中，跳过查询
            }

            wordsToQuery.add(lowerWord);

            if (!wordElementMap.has(lowerWord)) {
                wordElementMap.set(lowerWord, []);
            }
            wordElementMap.get(lowerWord)?.push(el as HTMLElement);
        }

        // 批量查询（实际仍需逐个调用，但只查询新单词）
        for (const word of wordsToQuery) {
            try {
                const result = await plugin.db.findExpression(word);
                lemmaCache.set(word, result); // 缓存结果

                // 应用到所有对应的 DOM 元素
                const elements = wordElementMap.get(word) || [];
                for (const el of elements) {
                    if (result.found && (result.match_type === 'lemma' || result.match_type === 'variant')) {
                        // 移除 "new" 状态（未学习灰色），替换为反哺标记
                        el.classList.remove('new');
                        el.classList.add('lemma-variant');
                        el.setAttribute('title', result.display_text);
                        el.dataset.matchedLemma = result.matched_lemma || '';
                    }
                }
            } catch (error) {
                console.warn(`[ReadingArea] Failed to query word "${word}":`, error);
            }
        }

        return doc.body.innerHTML;
    } catch (error) {
        console.warn('[ReadingArea] Lemma marking failed:', error);
        return html; // 出错时返回原始 HTML
    }
}

function clearLemmaCache() {
    lemmaCache.clear();
    refreshHandle.value = !refreshHandle.value;
}

// 设置阅读文字样式

// 添加无视单词
async function addIgnores() {
    let ignores = contentEl.querySelectorAll(
        ".word.new"
    ) as unknown as HTMLElement[];
    let ignore_words: Set<string> = new Set();
    ignores.forEach((el) => {
        ignore_words.add(el.textContent.toLowerCase());
    });
    await plugin.db.postIgnoreWords([...ignore_words]);
    // this.setViewData(this.data)
    refreshHandle.value = !refreshHandle.value;
    dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

    if (page.value < maxPage.value) {
        page.value++;
    } else if (currentChunkIndex.value < totalChunks.value - 1) {
        goToNextChunk();
    }

    refreshCount();
}

let reading = ref(null);
let prevEl: HTMLElement = null;
let textArea = ref(null);
let selectedEls: HTMLElement[] = [];

function toggleSelectElement(el: HTMLElement) {
    if (el.hasClass("select")) {
        el.classList.remove("select");
        selectedEls = selectedEls.filter(e => e !== el);
    } else {
        el.classList.add("select");
        selectedEls.push(el);
    }
}

function getSelectedText(): string {
    return selectedEls.map(el => el.textContent.trim()).join(" ");
}

if (plugin.constants.platform === "mobile") {
    useEvent(reading, "click", (e) => {
        let target = e.target as HTMLElement;
        if (target.hasClass("word") || target.hasClass("phrase")) {
            e.preventDefault();
            e.stopPropagation();
            if (prevEl) {
                const isSingleWord = prevEl === target;
                const resolvedLemma = isSingleWord ? (target as HTMLElement).dataset?.matchedLemma : undefined;
                let selectSpan = view.wrapSelect(prevEl, target);
                if (selectSpan) {
                    plugin.queryWord(
                        resolvedLemma || selectSpan.textContent,
                        selectSpan,
                        { x: e.pageX, y: e.pageY }
                    );
                }
                prevEl = null;
            } else {
                prevEl = target;
            }
        } else {
            view.removeSelect();
            prevEl = null;
        }
    });
} else {
    useEvent(reading, "pointerdown", (e) => {
        let target = e.target as HTMLElement;
        if (target.hasClass("word") || target.hasClass("phrase") || target.hasClass("select")) {
            if ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) {
                e.preventDefault();
                e.stopPropagation();
                toggleSelectElement(target);
                if (selectedEls.length > 0) {
                    const isSingleWord = selectedEls.length === 1;
                    const resolvedLemma = isSingleWord ? (selectedEls[0] as HTMLElement).dataset?.matchedLemma : undefined;
                    plugin.queryWord(
                        resolvedLemma || getSelectedText(),
                        target,
                        { x: (e as MouseEvent).pageX, y: (e as MouseEvent).pageY }
                    );
                }
                return;
            }
            prevEl = target;
            selectedEls = [];
        }
    });
    useEvent(reading, "pointerup", (e) => {
        let target = e.target as HTMLElement;
        if ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) {
            return;
        }
        if (target.hasClass("word") || target.hasClass("phrase") || target.hasClass("select")) {
            e.preventDefault();
            e.stopPropagation();
            if (prevEl) {
                const isSingleWord = prevEl === target;
                const resolvedLemma = isSingleWord ? (target as HTMLElement).dataset?.matchedLemma : undefined;
                let selectSpan = view.wrapSelect(prevEl, target);
                if (selectSpan) {
                    plugin.queryWord(
                        resolvedLemma || selectSpan.textContent,
                        selectSpan,
                        { x: (e as MouseEvent).pageX, y: (e as MouseEvent).pageY }
                    );
                }
                prevEl = null;
            }
        } else {
            view.removeSelect();
        }
    });
}

// 处理键盘事件
function handleKeydown(e: KeyboardEvent) {
    const activeElement = document.activeElement as HTMLElement;
    const isInputFocused = activeElement &&
        (activeElement.tagName === "INPUT" ||
         activeElement.tagName === "TEXTAREA" ||
         activeElement.isContentEditable ||
         activeElement.classList.contains("n-input__textarea-el") ||
         activeElement.classList.contains("n-input__input-el"));

    if (isInputFocused) {
        return;
    }

    switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
            e.preventDefault();
            if (page.value < maxPage.value) {
                page.value++;
            } else if (currentChunkIndex.value < totalChunks.value - 1) {
                goToNextChunk();
            }
            break;
        case "ArrowLeft":
        case "ArrowUp":
            e.preventDefault();
            if (page.value > 1) {
                page.value--;
            } else if (currentChunkIndex.value > 0) {
                currentChunkIndex.value--;
                page.value = maxPage.value;
            }
            break;
        case "Home":
            e.preventDefault();
            page.value = 1;
            break;
        case "End":
            e.preventDefault();
            page.value = maxPage.value;
            break;
    }
}

// 组件挂载
onMounted(() => {
    if (plugin.settings.word_count) {
        addEventListener("obsidian-langr-refresh", refreshCount);
    }
    // 添加键盘事件监听
    window.addEventListener("keydown", handleKeydown);
    // 数据变更时清除词形缓存（确保新增/删除单词后重新查询）
    addEventListener("obsidian-langr-data-change", clearLemmaCache);
    addEventListener("obsidian-langr-refresh-stat", clearLemmaCache);
});

// 组件卸载
onUnmounted(() => {
    if (plugin.settings.word_count) {
        removeEventListener("obsidian-langr-refresh", refreshCount);
    }
    // 移除键盘事件监听
    window.removeEventListener("keydown", handleKeydown);
    // 移除缓存清除监听
    removeEventListener("obsidian-langr-data-change", clearLemmaCache);
    removeEventListener("obsidian-langr-refresh-stat", clearLemmaCache);
});

</script>

<style lang="scss">
#langr-reading {
    user-select: none;

    .function-area {
        padding-bottom: 10px;
        border-bottom: 2px solid gray;

        button {
            width: auto;
        }
    }

    .text-area {
        touch-action: none;

        span.word {
            user-select: contain;
            border: 1px solid transparent;
            cursor: pointer;
            border-radius: 4px;

            &:hover {
                border-color: deepskyblue;
            }

            // 词形反哺标记样式（Phase 1）
            &.lemma-variant {
                background-color: #fff3cd;  // 浅黄背景
                border-bottom: 2px dashed #ffc107;  // 黄色虚线底边
                position: relative;

                .lemma-original {
                    font-size: 0.7em;
                    color: #6c757d;
                    margin-left: 3px;
                    opacity: 0.8;
                    transition: opacity 0.2s;

                    &:hover {
                        opacity: 1;
                    }
                }

                &:hover {
                    background-color: #ffe69c;  // 悬停时加深
                    border-bottom-style: solid;  // 虚线变实线
                }
            }
        }

        span.phrase {
            background-color: transparent;
            padding-top: 3px;
            padding-bottom: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 4px;

            &:hover {
                border-color: deepskyblue;
            }
        }

        span.stns {
            border: 1px solid transparent;
        }

        span {
            .new {
                background-color: #add8e644;
            }

            .learning {
                background-color: #ff980055;
            }

            .familiar {
                background-color: #ffeb3c55;
            }

            .known {
                background-color: #9eda5855;
            }

            .learned {
                background-color: #4cb05155;
            }
        }

        span.other {
            user-select: text;
        }

        .select {
            background-color: #90ee9060;
            padding-top: 3px;
            padding-bottom: 3px;
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 4px;

            &:hover {
                border: 1px solid green;
            }
        }
    }

    .note-area {
        display: flex;
        height: 100%;
        width: 100%;

        .note-input {
            flex: 1;
        }

        .note-rendered {
            border: 1px solid gray;
            border-radius: 3px;
            flex: 1;
            padding: 5px;
            margin-left: 2px;
            overflow: auto;
        }
    }
}

.is-mobile #langr-reading {
        .pagination {
            padding-bottom: 48px;
        }
    }

    .chunk-page-info {
        .chunk-indicator {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;

            .chunk-pill {
                padding: 2px 10px;
                border-radius: 12px;
                font-size: 0.78em;
                cursor: pointer;
                background: var(--background-modifier-border);
                color: var(--text-muted);
                border: 1px solid transparent;
                transition: all 0.2s;

                &:hover { background: var(--background-modifier-hover); }
                &.active {
                    background: var(--interactive-accent);
                    color: #fff;
                    font-weight: 700;
                    box-shadow: 0 0 0 2px var(--interactive-accent-hover);
                }
                &.done {
                    opacity: 0.5;
                    text-decoration: line-through;
                }
            }
        }
    }
</style>
