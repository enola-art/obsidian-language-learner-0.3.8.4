<template>
    <div id="langr-search" :style="{ fontSize: searchFontSize }" @click="handleClick">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig">
            <div class="search-bar" style="display:flex;">
                <NButtonGroup size="small">
                    <NButton :disabled="historyIndex <= 0" @click="switchHistory('prev')">{{ `<` }} </NButton>
                            <NButton :disabled="historyIndex >= lastHistory" @click="switchHistory('next')">{{ ">" }}
                            </NButton>
                </NButtonGroup>
                <NInput ref="searchInputRef" size="small" type="text" placeholder="输入单词" v-model:value="inputWord" style="flex:1;"
                    @keydown.enter="handleSearch" @focus="handleInputFocus" />
            </div>
        </NConfigProvider>
        <div class="dict-area" style="overflow:auto;">
            <DictItem v-for="(cp, i) in components" :loading="loadings[i]" :name="cp.name" :id="cp.id">
                <KeepAlive>
                    <Component @loading="loading" :is="cp.type" :word="word" v-show="shows[i]"></Component>
                </KeepAlive>
            </DictItem>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance, nextTick } from "vue";
import { NConfigProvider, NButton, NButtonGroup, NInput, darkTheme, GlobalThemeOverrides } from "naive-ui";
import { Notice } from "obsidian";
import { useDebounceFn } from "@vueuse/core";

import DictItem from "./DictItem.vue";
import { t } from "@/lang/helper";
import PluginType from "@/plugin";
import { dicts } from "@dict/list";
import { playAudio } from "@/utils/helpers";
import { logger } from "@/utils/logger";
import { search as youdaoSearch, YoudaoResultLex } from "@dict/youdao/engine";
import store from "@/store";

const plugin = getCurrentInstance().appContext.config.globalProperties.plugin as PluginType;

const searchFontSize = computed(() => {
    return store.learnPanelFontSize || "0.85em";
});

const themeConfig: GlobalThemeOverrides = {

};

let components = ref([]);
let map: { [K in string]: number } = {};
let loadings = ref<boolean[]>([]);
let shows = ref<boolean[]>([]);
watch(() => plugin.store.dictsChange, () => {
    let collection = Object.keys(plugin.settings.dictionaries)
        .map((dict: keyof typeof dicts) => {
            return {
                id: dict,
                priority: plugin.settings.dictionaries[dict].priority,
                name: dicts[dict].name,
            };
        })
        .filter((dict) => plugin.settings.dictionaries[dict.id].enable);
    collection.sort((a, b) => a.priority - b.priority);

    components.value = collection.map((dict) => {
        return {
            id: dict.id,
            name: dict.name,
            type: dicts[dict.id].Cp,
        };
    });
    collection.forEach((v, i) => {
        map[v.id] = i;
    });
    loadings.value = Array(collection.length).fill(false);
    shows.value = Array(collection.length).fill(false);

}, {
    immediate: true
});

function loading({ id, loading, result }: { id: string, loading: boolean, result: boolean; }) {
    loadings.value[map[id]] = loading;
    shows.value[map[id]] = result;
}

// 切换明亮/黑暗模式
const theme = computed(() => {
    return plugin.store.dark ? darkTheme : null;
});

// 提供一个前进后退查询记录的功能
let history: string[] = [];
let lastHistory = ref(history.length - 1);
let historyIndex = ref(-1);
function switchHistory(direction: "prev" | "next") {
    historyIndex.value = Math.max(
        0,
        Math.min(historyIndex.value + (direction === "prev" ? -1 : 1), history.length - 1)
    );
    word.value = history[historyIndex.value];
    inputWord.value = history[historyIndex.value];
}
function appendHistory() {
    if (historyIndex.value < history.length - 1) {
        history = history.slice(0, historyIndex.value + 1);
    }
    history.push(word.value);
    lastHistory.value = history.length - 1;
    historyIndex.value++;
}

let inputWord = ref("");
let word = ref("");
let addingWord = ref(false);

const debouncedSearch = useDebounceFn(() => {
    if (inputWord.value && inputWord.value !== word.value) {
        word.value = inputWord.value;
        appendHistory();
    }
}, 300);

watch(inputWord, (newVal) => {
    if (newVal) {
        debouncedSearch();
    }
});

const onSearch = async (evt: CustomEvent) => {
    let text = evt.detail.selection;
    // 清理单词
    let cleanText = text.trim().replace(/^[^\w]+|[^\w]+$/g, '');
    if (!cleanText) {
        cleanText = text.replace(/[^\w\s]/g, '').trim();
    }
    if (cleanText) {
        word.value = cleanText;
        inputWord.value = cleanText;
        appendHistory();
    }
};

async function addWordToLearn() {
    if (!word.value) return;
    
    addingWord.value = true;
    
    try {
        let existing = await plugin.db.getExpression(word.value);
        if (existing) {
            new Notice(t("Word already exists"));
            addingWord.value = false;
            return;
        }
        
        let meaningCn = "";
        try {
            let sr = await youdaoSearch(word.value);
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
        
        let exprType = word.value.trim().contains(" ") ? "PHRASE" : "WORD";
        
        let data = {
            expression: word.value.toLowerCase(),
            meaning: meaningCn,
            meaning_en: "",
            meaning_cn: meaningCn,
            status: 1,
            t: exprType,
            tags: [],
            notes: [],
            sentences: [],
        };
        
        let statusCode = await plugin.db.postExpression(data);
        
        if (statusCode === 200) {
            new Notice(t("Word added successfully"));
            dispatchEvent(new CustomEvent("obsidian-langr-refresh", {
                detail: {
                    expression: word.value,
                    type: exprType,
                    status: 1,
                },
            }));
            dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));
        } else {
            new Notice(t("Failed to add word"));
        }
    } catch (e) {
        logger.error("Error adding word:", e);
        new Notice(t("Failed to add word"));
    } finally {
        addingWord.value = false;
    }
}

async function pasteFromClipboard() {
    try {
        const clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
            let cleanText = clipboardText.trim().replace(/^[^\w]+|[^\w]+$/g, '');
            if (!cleanText) {
                cleanText = clipboardText.replace(/[^\w\s]/g, '').trim();
            }
            if (cleanText) {
                inputWord.value = cleanText;
                word.value = cleanText;
                appendHistory();
                handleSearch();
            } else {
                new Notice("Clipboard is empty or no valid text found");
            }
        } else {
            new Notice("Clipboard is empty");
        }
    } catch (e) {
        logger.warn("Failed to read clipboard:", e);
        new Notice("Failed to read clipboard");
    }
}

function handleSearch() {
    word.value = inputWord.value;
    appendHistory();
}

const searchInputRef = ref<any>(null);

function handleInputFocus() {
    nextTick(() => {
        const inputEl = searchInputRef.value?.inputEl as HTMLInputElement;
        if (inputEl && inputEl.select) {
            inputEl.select();
        }
    });
}

function handleClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;
    if (target.hasClass("speaker")) {
        evt.preventDefault();
        evt.stopPropagation();
        let url = (target as HTMLAnchorElement).href;
        playAudio(url);

    }
    else if (target.tagName === "A") {
        evt.preventDefault();
        evt.stopPropagation();
        word.value = target.textContent;
        inputWord.value = target.textContent;
        appendHistory();
    }
}


onMounted(() => {
    addEventListener('obsidian-langr-search', onSearch);
});

onUnmounted(() => {
    removeEventListener('obsidian-langr-search', onSearch);
});
</script>

<style lang="scss">
#langr-search {
    height: 100%;
    width: 100%;
    overflow: hidden;
    user-select: text;
    display: flex;
    flex-direction: column;

    .search-bar {
        margin-bottom: 10px;
        gap: 8px;
        padding: 8px 0;
    }

    .dict-area {
        flex: 1;
    }
}

.is-mobile #langr-search {
    button:not(.fold-mask) {
        width: auto;
    }

    input[type='text'] {
        padding: 0;
    }
}
</style>