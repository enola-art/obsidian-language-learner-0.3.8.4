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
                    <button v-else class="finish-reading" @click="addIgnores">
                        结束阅读
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
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 16px; margin-bottom: 8px; font-size: 0.9em;">
                    <span v-if="isWordMode" style="color: #e67e22;">{{ t("Word-based pagination") }} ({{ totalWords.toLocaleString() }} {{ t("words") }})</span>
                    <span v-else></span>
                    <span style="font-weight: 600; color: var(--text-normal);">
                        {{ t("Page") }} {{ currentPageDisplay }} / {{ totalPagesDisplay }}
                        <span v-if="totalWords > 0">({{ currentRangeWords }} {{ t("words") }})</span>
                    </span>
                    <span></span>
                </div>
                <NPagination style="justify-content: center" v-model:page="page" v-model:page-size="pageSize"
                    :item-count="isWordMode ? totalWords : totalLines" show-size-picker :page-sizes="effectivePageSizes"
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

const WORD_BREAKPOINT = 10000;

function countWordsInText(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
}

const totalWords = ref(countWordsInText(article.join(" ")));
const isWordMode = computed(() => totalWords.value >= WORD_BREAKPOINT);

const lineWordCounts = article.map(line => countWordsInText(line));
const cumulativeWordCounts: number[] = [];
let cumulative = 0;
for (const wc of lineWordCounts) {
    cumulative += wc;
    cumulativeWordCounts.push(cumulative);
}

function findLineByWordCount(wordOffset: number): number {
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

const wordPageSizes = [
    { label: `5,000 ${t("words")} / ${t("page")}`, value: 5000 },
    { label: `10,000 ${t("words")} / ${t("page")}`, value: 10000 },
    { label: `20,000 ${t("words")} / ${t("page")}`, value: 20000 },
    { label: `${t("All")}`, value: Number.MAX_VALUE },
];

const effectivePageSizes = computed(() => {
    return isWordMode.value ? wordPageSizes : pageSizes;
});

const currentPageDisplay = computed(() => page.value);
const totalPagesDisplay = computed(() => {
    return isWordMode.value
        ? Math.max(1, Math.ceil(totalWords.value / pageSize.value))
        : Math.max(1, Math.ceil(totalLines / pageSize.value));
});

const currentRangeWords = computed(() => {
    if (!isWordMode.value) {
        const start = (page.value - 1) * pageSize.value;
        const end = Math.min(start + pageSize.value, totalLines);
        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += lineWordCounts[i] || 0;
        }
        return sum;
    } else {
        const start = (page.value - 1) * pageSize.value;
        const end = Math.min(start + pageSize.value, totalWords.value);
        return end - start;
    }
});

const pageSlot = Platform.isMobileApp ? 5 : null;

let dp = plugin.settings.default_paragraphs;
let pageSize = ref(
    isWordMode.value
        ? (dp === "all" ? 10000 : Math.max(10000, parseInt(dp) * 25))
        : (dp === "all" ? Number.MAX_VALUE : parseInt(dp))
);
let maxPage = computed(() => {
    return isWordMode.value
        ? Math.max(1, Math.ceil(totalWords.value / pageSize.value))
        : Math.max(1, Math.ceil(totalLines / pageSize.value));
});
let page = view.lastPos
    ? ref(Math.min(Math.ceil(view.lastPos / pageSize.value), maxPage.value))
    : ref(1);

let renderedText = ref("");
let psChange = ref(true); // 标志pageSize的改变
let refreshHandle = ref(true);

// pageSize变化应该使page同时进行调整以尽量保持原阅读位置
// 同时page和pageSize的改变都应该引起langr-pos的改变，但应只修改一次
// 因此引入psChange这个变量
watch([pageSize], async ([ps], [prev_ps]) => {
    let oldPage = page.value;
    const totalItems = isWordMode.value ? totalWords.value : totalLines;
    page.value = Math.min(
        Math.ceil(((page.value - 1) * prev_ps + 1) / ps),
        Math.max(1, Math.ceil(totalItems / ps))
    );
    if (oldPage === page.value) {
        psChange.value = !psChange.value;
    }
});

watch(
    [page, psChange, refreshHandle],
    async ([p, pc], [prev_p, prev_pc]) => {
        let startLine: number;
        let endLine: number;

        if (isWordMode.value) {
            const wordOffset = (p - 1) * pageSize.value;
            const wordEnd = Math.min(wordOffset + pageSize.value, totalWords.value);

            startLine = findLineByWordCount(wordOffset);
            endLine = findLineByWordCount(wordEnd);

            if (endLine < startLine) endLine = startLine;
        } else {
            startLine = (p - 1) * pageSize.value;
            endLine =
                startLine + pageSize.value > totalLines
                    ? totalLines
                    : startLine + pageSize.value;
        }

        let html = await plugin.parser.parse(
            article.slice(startLine, endLine).join("\n")
        );

        if (plugin.settings.auto_mark_lemma_variants) {
            html = await applyLemmaMarking(html);
        }

        renderedText.value = html;

        if (p !== prev_p || pc != prev_pc) {
            const posBase = isWordMode.value
                ? (p - 1) * pageSize.value
                : (p - 1) * pageSize.value;
            plugin.frontManager.setFrontMatter(
                view.file,
                "langr-pos",
                `${posBase + 1}`
            );
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
            }
            break;
        case "ArrowLeft":
        case "ArrowUp":
            e.preventDefault();
            if (page.value > 1) {
                page.value--;
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
</style>
