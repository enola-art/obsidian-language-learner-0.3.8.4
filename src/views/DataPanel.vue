<template>
    <div id="langr-data">
        <NConfigProvider :theme="theme" :theme-overrides="themeConfig">
            <div class="toolbar">
                <div class="toolbar-row toolbar-row-top">
                    <div class="search-section">
                        <span class="toolbar-label">Search:</span>
                        <NInput
                            size="small"
                            v-model:value="searchText"
                            class="search-input"
                            :placeholder="t('Advanced search syntax: tag:xxx status:1,2 has:note type:WORD')"
                            @keydown.enter="handleSearch"
                        />
                        <NButton size="tiny" @click="showAdvanced = !showAdvanced" :type="showAdvanced ? 'primary' : 'default'" style="margin-left:4px;">▾</NButton>
                        <NDropdown trigger="click" :options="levelStatsOptions" @select="handleLevelSelect">
                                    <NButton size="small" type="info" style="margin-left:4px; min-width: 130px;">
                                        <span>📊</span>
                                        <span style="margin-left:4px;">{{ selectedLevelFilter ? (EXAM_LEVELS[selectedLevelFilter]?.labelZh || selectedLevelFilter) : (t("Level Distribution") || "级别分布") }}</span>
                                        <NBadge :value="Object.values(levelStats).reduce((a, b) => a + b, 0)" :max="9999" type="success" style="margin-left:4px;" />
                                    </NButton>
                                </NDropdown>
                    </div>
                    <div class="show-ignore-section">
                        <NButton size="small" @click="toggleShowIgnores" :type="showIgnores ? 'primary' : 'default'">
                            {{ showIgnores ? t("Hide ignores") : t("Show ignores") }}
                        </NButton>
                    </div>
                    <div class="batch-actions" v-if="rowKeysRef.length > 0">
                        <NDropdown trigger="click" :options="batchStatusOptions" @select="handleBatchStatus">
                            <NButton size="small" type="primary">{{ t("Batch status") }} ({{ rowKeysRef.length }})</NButton>
                        </NDropdown>
                        <NButton size="small" @click="showBatchTagModal = true">{{ t("Batch add tag") }}</NButton>
                        <NButton size="small" type="danger" @click="confirmBatchDelete">{{ t("Batch delete") }} ({{ rowKeysRef.length }})</NButton>
                    </div>
                    <NButton v-else-if="rowKeysRef.length > 0" size="small" type="danger" @click="confirmBatchDelete" class="search-delete-btn">
                        Delete ({{ rowKeysRef.length }})
                    </NButton>
                </div>
                <div class="toolbar-row toolbar-row-advanced" v-if="showAdvanced">
                    <div class="advanced-filters">
                        <span class="toolbar-label">{{ t("Status") }}:</span>
                        <NTag v-for="(label, i) in statusFilterLabels" size="small" checkable v-model:checked="checkedStatus[i]">
                            {{ label }}
                        </NTag>
                    </div>
                    <div class="advanced-filters">
                        <span class="toolbar-label">{{ t("Other") }}:</span>
                        <NTag size="small" checkable v-model:checked="filterHasNotes">{{ t("Has notes") }}</NTag>
                        <NTag size="small" checkable v-model:checked="filterHasSentences">{{ t("Has sentences") }}</NTag>
                    </div>
                    <div class="advanced-filters">
                        <span class="toolbar-label">{{ t("Type") }}:</span>
                        <NSelect v-model:value="filterType" size="small" :options="typeFilterOptions" style="width: 120px;" />
                    </div>
                </div>
                <div class="toolbar-row toolbar-row-bottom">
                    <div class="tags-section">
                        <span class="toolbar-label">Tags:</span>
                        <NSelect v-model:value="mode" size="small" :options="modeOptions" style="width: 80px;" />
                        <div class="tags-list">
                            <NTag v-for="(tag, i) in tags" size="small" checkable v-model:checked="checkedTags[i]">
                                {{ "#" + tag }}
                            </NTag>
                        </div>
                    </div>
                    <div class="cn-display-section">
                        <span class="toolbar-label">CN:</span>
                        <NSelect v-model:value="cnDisplayMode" size="small" :options="cnDisplayOptions" style="width: 140px;" />
                    </div>
                </div>
            </div>
            <NDataTable ref="table" size="small" :loading="loading" :data="data" :columns="collumns"
                :row-key="makeRowKey" @update:checked-row-keys="handleCheck" :pagination="{ pageSize: 15 }" />
            
            <!-- Delete Confirmation Modal -->
            <NModal :show="showDeleteModal" @update:show="showDeleteModal = false">
                <NCard style="width: 600px;">
                    <template #header>
                        <span>{{ t("Confirm Delete") }}</span>
                    </template>
                    <div style="padding: 16px;">
                        <p>{{ deleteConfirmMessage }}</p>
                    </div>
                    <template #footer>
                        <NSpace>
                            <NButton size="small" @click="showDeleteModal = false">
                                {{ t("Cancel") }}
                            </NButton>
                            <NButton size="small" type="danger" @click="executeDelete">
                                {{ t("Confirm") }}
                            </NButton>
                        </NSpace>
                    </template>
                </NCard>
            </NModal>

            <!-- Batch Tag Modal -->
            <NModal :show="showBatchTagModal" @update:show="showBatchTagModal = false">
                <NCard style="width: 360px;">
                    <template #header>
                        <span>{{ t("Batch add tag") }}</span>
                    </template>
                    <div style="padding: 16px;">
                        <NInput size="small" v-model:value="batchTagName" :placeholder="t('Enter tag name')" />
                    </div>
                    <template #footer>
                        <NSpace>
                            <NButton size="small" @click="showBatchTagModal = false">
                                {{ t("Cancel") }}
                            </NButton>
                            <NButton size="small" type="primary" @click="executeBatchAddTag" :loading="batchLoading">
                                {{ t("Confirm") }}
                            </NButton>
                        </NSpace>
                    </template>
                </NCard>
            </NModal>

            <!-- Batch Result Modal -->
            <NModal :show="showBatchResultModal" @update:show="showBatchResultModal = false">
                <NCard style="width: 360px;">
                    <template #header>
                        <span>{{ t("Batch result") }}</span>
                    </template>
                    <div style="padding: 16px;">
                        <p>{{ t("Success") }}: {{ batchResult.success }}</p>
                        <p>{{ t("Failed") }}: {{ batchResult.failed }}</p>
                    </div>
                    <template #footer>
                        <NButton size="small" @click="showBatchResultModal = false">
                            {{ t("Done") }}
                        </NButton>
                    </template>
                </NCard>
            </NModal>

        </NConfigProvider>
    </div>
</template>

<script setup lang="ts">
import { moment } from "obsidian";
import {
    h,
    ref,
    reactive,
    computed,
    watch,
    watchEffect,
    getCurrentInstance,
    onMounted,
    onUnmounted,
    Suspense,
    defineAsyncComponent,
} from "vue";
import {
    NConfigProvider,
    NDataTable,
    NTag,
    GlobalThemeOverrides,
    darkTheme,
    NSpace,
    NInput,
    NButton,
    NModal,
    NCard,
    NSelect,
    NDropdown,
    NBadge,
} from "naive-ui";
import { t } from "@/lang/helper";
import { parseSearchQuery, applySearchFilter } from "@/utils/search";

import type { DataTableColumns, DataTableRowKey } from "naive-ui";
import type PluginType from "@/plugin";
import { EXAM_LEVELS, type ExamLevelKey } from "@/utils/exam-levels";

const WordMore = defineAsyncComponent(() => import("@comp/WordMore.vue"));

const plugin = getCurrentInstance().appContext.config.globalProperties
    .plugin as PluginType;

const themeConfig: GlobalThemeOverrides = {
    DataTable: {
        fontSizeSmall: plugin.constants.platform === "mobile" ? "10px" : "0.85em",
        tdPaddingSmall: "8px 8px",
    },
};

// 切换明亮/黑暗模式
const theme = computed(() => {
    return plugin.store.dark ? darkTheme : null;
});


interface Row {
    expr: string;
    status: string;
    meaning_en: string;
    meaning_cn: string;
    tags: string[];
    date: string;
    senNum: number;
    noteNum: number;
}

const statusMap = [
    t("Ignore"),
    t("Learning"),
    t("Familiar"),
    t("Known"),
    t("Learned"),
];


let showIgnores = ref(false);

function toggleShowIgnores() {
    showIgnores.value = !showIgnores.value;
    loadData();
}

let loading = ref(true);
let loadTimeout: ReturnType<typeof setTimeout> | null = null;

async function loadData() {
    if (loadTimeout) {
        clearTimeout(loadTimeout);
    }

    return new Promise<void>((resolve) => {
        loadTimeout = setTimeout(async () => {
            try {
                loading.value = true;

                if (!plugin.db.idb) {
                    await plugin.db.open();
                }

                allData.value = await plugin.db.getAllExpressionSimple(showIgnores.value);
                tags.value = await plugin.db.getTags();
                checkedTags.value = Array(tags.value.length).fill(false);
                await loadLevelStats();

                loading.value = false;
                resolve();
            } catch (error) {
                console.error("加载数据失败:", error);
                loading.value = false;
                resolve();
            }
        }, 100);
    });
}

watchEffect(async () => {
    loadData();
});

let data = ref<Row[]>([]);

let table = ref<InstanceType<typeof NDataTable>>(null);
let mode = ref("and");
const modeOptions = [
    { label: "And", value: "and" },
    { label: "Or", value: "or" }
];
let cnDisplayMode = ref("hover");
const cnDisplayOptions = [
    { label: "Show on Hover", value: "hover" },
    { label: "Show All", value: "show" }
];
let tags = ref<string[]>([]);
let checkedTags = ref<boolean[]>([]);
let selectedTags = ref<string[]>([]);

// 考试级别统计（#3）
const levelStats = ref<Record<string, number>>({});
const selectedLevelFilter = ref<string>("");
const levelStatsOptions = computed(() => {
	const opts: Array<{ label: string; key: string }> = [];
	if (selectedLevelFilter.value) {
		opts.push({ label: `全部 (${Object.values(levelStats.value).reduce((a, b) => a + b, 0)}词)`, key: "" });
	}
	for (const [key, count] of Object.entries(levelStats.value)) {
		const total = Object.values(levelStats.value).reduce((a, b) => a + b, 0);
		const pct = total > 0 ? Math.round((count / total) * 100) : 0;
		const label = EXAM_LEVELS[key]?.labelZh || key;
		opts.push({ label: `${label}: ${count} (${pct}%)`, key });
	}
	return opts;
});

async function loadLevelStats() {
	try {
		levelStats.value = await plugin.db.getLevelStats();
	} catch (e) {
		console.error("加载级别统计失败:", e);
	}
}

function handleLevelSelect(key: string) {
	if (selectedLevelFilter.value === key) {
		selectedLevelFilter.value = "";
	} else {
		selectedLevelFilter.value = key;
	}
	applyFilters();
}

// 搜索框
let searchText = ref("");
let showAdvanced = ref(false);

let checkedStatus = ref<boolean[]>(new Array(5).fill(false));
const statusFilterLabels = statusMap;

let filterHasNotes = ref(false);
let filterHasSentences = ref(false);
let filterType = ref<string | null>(null);
const typeFilterOptions = [
    { label: t("All"), value: null },
    { label: t("Word"), value: "WORD" },
    { label: t("Phrase"), value: "PHRASE" },
];

let allData = ref<ExpressionInfoSimple[]>([]);

watchEffect(() => {
    let rawData = allData.value;

    let textQuery = parseSearchQuery(searchText.value);

    if (checkedStatus.value.some(Boolean)) {
        textQuery.status = checkedStatus.value
            .map((c, i) => (c ? i : -1))
            .filter((i) => i >= 0);
    }
    if (filterHasNotes.value) textQuery.hasNotes = true;
    if (filterHasSentences.value) textQuery.hasSentences = true;
    if (filterType.value) textQuery.type = filterType.value;

    let filtered = applySearchFilter(rawData, textQuery);
    data.value = filtered.map((entry): Row => {
        return {
            expr: entry.expression,
            status: statusMap[entry.status],
            meaning_en: entry.meaning_en || "",
            meaning_cn: entry.meaning_cn || "",
            tags: entry.tags,
            noteNum: entry.note_num,
            senNum: entry.sen_num,
            date: moment.unix(entry.date).format("YYYY-MM-DD"),
        };
    });

    let selected = tags.value.filter((_tag, i) => checkedTags.value[i]);
    if (selectedLevelFilter.value) {
        if (!selected.includes(selectedLevelFilter.value)) {
            selected.push(selectedLevelFilter.value);
        }
    }
    table.value?.filter({ tags: selected });
    selectedTags.value = selected;
});

function handleSearch() {
    // trigger reactive - watchEffect handles the actual filtering
    searchText.value = searchText.value + "";
    showAdvanced.value = showAdvanced.value;
}

// 选中行
let rowKeysRef = ref<DataTableRowKey[]>([]);
let makeRowKey = (row: Row) => row.expr;
function handleCheck(rowKeys: DataTableRowKey[]) {
    rowKeysRef.value = rowKeys;
}

// 删除确认弹窗
let showDeleteModal = ref(false);
let deleteConfirmMessage = ref("");
let wordsToDelete = ref<string[]>([]);

function confirmDelete(word: string) {
    wordsToDelete.value = [word];
    deleteConfirmMessage.value = t("Are you sure you want to delete the word '%s'?").replace("%s", word);
    showDeleteModal.value = true;
}

function confirmBatchDelete() {
    wordsToDelete.value = rowKeysRef.value as string[];
    deleteConfirmMessage.value = t("Are you sure you want to delete %d words?").replace("%d", String(wordsToDelete.value.length));
    showDeleteModal.value = true;
}

async function executeDelete() {
    const result = await plugin.db.deleteExpressions(wordsToDelete.value);
    showDeleteModal.value = false;
    rowKeysRef.value = [];
    batchResult.value = { success: result.success, failed: result.failed };
    showBatchResultModal.value = true;
    await loadData();
}

let showBatchTagModal = ref(false);
let batchTagName = ref("");
let batchLoading = ref(false);
let showBatchResultModal = ref(false);
let batchResult = ref({ success: 0, failed: 0 });

const batchStatusOptions = [
    { label: t("Ignore"), key: "0" },
    { label: t("Learning"), key: "1" },
    { label: t("Familiar"), key: "2" },
    { label: t("Known"), key: "3" },
    { label: t("Learned"), key: "4" },
];

async function handleBatchStatus(key: string) {
    const newStatus = parseInt(key);
    const result = await plugin.db.batchUpdateStatus(rowKeysRef.value as string[], newStatus);
    rowKeysRef.value = [];
    batchResult.value = { success: result.success, failed: result.failed };
    showBatchResultModal.value = true;
    await loadData();
}

async function executeBatchAddTag() {
    if (!batchTagName.value.trim()) return;
    batchLoading.value = true;
    const result = await plugin.db.batchAddTag(rowKeysRef.value as string[], batchTagName.value.trim());
    batchLoading.value = false;
    showBatchTagModal.value = false;
    batchTagName.value = "";
    rowKeysRef.value = [];
    batchResult.value = { success: result.success, failed: result.failed };
    showBatchResultModal.value = true;
    await loadData();
}

let collumns = reactive<DataTableColumns<Row>>([
    {
        type: "selection",
    },
    {
        type: "expand",
        expandable: (_row: Row) => true,
        renderExpand: (row: Row) => {
            return h(Suspense, [
                h(WordMore, { word: row.expr })
            ]);
        },
    },
    // 表达
    {
        title: t("Expr"),
        key: "expr",
        width: "12%",
        sorter: "default",
        filter(_, row) {
            if (!searchText.value) return true;

            return row.expr.contains(searchText.value);
        }
    },
    // 学习状态
    {
        title: "Status",
        key: "status",
        width: "8%",
        defaultFilterOptionValues: statusMap.slice(1),
        filterOptions: [
            { label: t("Ignore"), value: t("Ignore") },
            { label: t("Learning"), value: t("Learning") },
            { label: t("Familiar"), value: t("Familiar") },
            { label: t("Known"), value: t("Known") },
            { label: t("Learned"), value: t("Learned") },
        ],
        filter(value, row) {
            return row.status === value;
        },
    },
    // 英文表达
    {
        title: t("EN"),
        key: "meaning_en",
        width: "20%",
    },
    // 中文含义 — 不设固定宽度，自动填满剩余空间（始终最宽）
    {
        title: t("CN"),
        key: "meaning_cn",
        render(row) {
            if (cnDisplayMode.value === "hover") {
                return h(
                    "span",
                    { class: "cn-meaning-hover" },
                    row.meaning_cn || ""
                );
            }
            return row.meaning_cn || "";
        },
    },
    // 标签
    {
        title: "Tags",
        key: "tags",
        width: "8%",
        render(row) {
            return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px' } },
                row.tags.map((tag: string) =>
                    h(
                        NTag,
                        {
                            style: { marginRight: '0', padding: '0 4px', fontSize: '10px' },
                            type: "info",
                            size: "tiny",
                        },
                        { default: () => tag }
                    )
                )
            );
        },
        filter(value, row) {
            if (selectedTags.value.length === 0) {
                return true;
            }
            return mode.value === "and"
                ? selectedTags.value.every((tag: string) => row.tags.includes(tag))
                : selectedTags.value.some((tag: string) => row.tags.includes(tag));
        },
    },
    // 修改日期
    {
        title: "Date",
        key: "date",
        width: "10%",
        minWidth: 100,
        sorter(row1, row2) {
            return moment.utc(row1.date).unix() - moment.utc(row2.date).unix();
        },
    },
]);

onMounted(() => {
    addEventListener("obsidian-langr-data-change", loadData);
});

onUnmounted(() => {
    removeEventListener("obsidian-langr-data-change", loadData);
});

</script>

<style lang="scss">
#langr-data {
    .toolbar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
    }

    .toolbar-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .toolbar-row-top {
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
    }

    .toolbar-row-bottom {
        justify-content: flex-start;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        flex-wrap: nowrap;
        overflow-x: auto;
    }

    .search-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .search-input {
        min-width: 120px;
        max-width: 300px;
        flex: 1;
        border-radius: 6px;
        background-color: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(0, 0, 0, 0.15);
        
        :deep(.n-input__input-el) {
            padding: 6px 12px;
            font-size: 14px;
        }
        
        :deep(.n-input__border) {
            border-radius: 6px;
        }
        
        :deep(.n-input__border:hover) {
            border-color: rgba(94, 129, 172, 0.6);
        }
        
        :deep(.n-input__border.n-input__border--focus) {
            border-color: #5e81ac;
            box-shadow: 0 0 0 2px rgba(94, 129, 172, 0.2);
        }
    }

    .search-delete-btn {
        flex-shrink: 0;
        border-radius: 6px;
    }

    .show-ignore-section {
        margin-right: 12px;
    }

    .batch-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }

    .toolbar-row-advanced {
        flex-wrap: wrap;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .advanced-filters {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .tags-section {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .tags-list {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    // 级别分布 Modal - 双列网格卡片布局（内联样式为主，CSS为fallback）
    .level-stats-modal-body {
        padding: 20px;
        overflow: visible;

        .level-stats-header-h {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            margin-bottom: 14px;

            .level-stats-total {
                font-size: 0.9em;
                color: var(--text-muted);
            }
        }

        .level-stats-active-filter-h {
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }

        .level-stats-grid {
            // 内联样式已设置 grid 布局，此处仅作 CSS fallback
            gap: 12px;
            width: 100%;
        }

        .level-stat-card {
            display: flex;
            flex-direction: column;
            padding: 14px 16px;
            background: var(--background-secondary);
            border: 2px solid transparent;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
                background: var(--background-modifier-hover);
                border-color: var(--border-color);
                transform: translateY(-1px);
            }

            &.level-active {
                border-color: var(--interactive-accent);
                background: var(--background-modifier-border);

                .card-label { font-weight: 700; color: var(--text-normal); }
                .card-count { color: var(--interactive-accent); }
            }

            .card-top {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 8px;

                .card-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .card-label {
                    font-size: 0.88em;
                    color: var(--text-muted);
                    font-weight: 500;
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .card-check {
                    font-size: 0.95em;
                    color: var(--interactive-accent);
                    font-weight: 700;
                    flex-shrink: 0;
                }
            }

            .card-count {
                font-size: 1.6em;
                color: var(--text-normal);
                font-weight: 700;
                line-height: 1.2;
                margin-bottom: 10px;
            }

            .card-bottom {
                display: flex;
                align-items: center;
                gap: 8px;

                .card-bar-track {
                    flex: 1;
                    height: 6px;
                    background: var(--background-modifier-border);
                    border-radius: 3px;
                    overflow: hidden;
                    min-width: 30px;
                }

                .card-bar-fill {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 0.35s ease;
                    min-width: 2px;
                }

                .card-percent {
                    font-size: 0.78em;
                    color: var(--text-faint);
                    min-width: 34px;
                    text-align: right;
                    font-weight: 500;
                }
            }
        }
    }

    .cn-display-section {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .cn-meaning-hover {
        color: transparent;
        transition: color 0.2s;
        background-color: var(--background-modifier-hover);
        border-radius: 4px;
        padding: 2px 4px;
    }

    .cn-meaning-hover:hover {
        color: var(--text-normal);
    }


    .toolbar-label {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        color: var(--text-muted);
    }

    #data-tags {
        display: flex;
    }

    .n-data-table-filter {
        width: 19px;
    }

    .n-data-table-th--filterable {
        width: 19px;

    }

    .n-data-table__pagination {
        justify-content: center;
    }

    .data-more {
        h2 {
            margin: 0.5em 0;
        }

        .data-notes {
            p {
                white-space: pre-line;
                margin: 0.5em 5px;
            }
        }

        .data-sens {
            .data-sen {
                margin-bottom: 5px;
                border: 1px solid gray;
                border-radius: 5px;

                p {
                    &:first-child {
                        font-style: italic;
                    }

                    margin: 0.5em 5px;
                }
            }
        }
    }
}
</style>
