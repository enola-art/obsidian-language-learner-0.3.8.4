<template>
	<div id="langr-learn-panel" :style="{ fontSize: learnPanelFontSize, '--learn-panel-font-size': learnPanelFontSize }">
		<NConfigProvider :theme="theme" :theme-overrides="theme-overrides">
			<NForm :model="model" label-placement="top" label-width="auto" :rules="rules"
				require-mark-placement="right-hanging">
				<!-- 一个单词或短语字符串 -->
				<NFormItem :label="t('Expression')" :label-style="label-style" path="expression">
					<div class="expression-row">
						<NInput size="small" v-model:value="model.expression" :placeholder="searchLoading ? '⏳ 查询中...' : t('A word or a phrase')"
							@input="onExpressionInput" @keyup.enter="handleEnterSearch" :class="['expression-input', { 'lemma-flash': lemmaFlash }]" tabindex="1" />
						<NButton size="small" type="primary" attr-type="submit" @click="submit"
							:loading="submitLoading" class="submit-button">
							{{ t("Submit") }}
						</NButton>
						<NButton size="small" type="default" @click="resetForm" class="reset-button">
							{{ t("Reset") }}
						</NButton>
					</div>
				</NFormItem>

				<!-- 英文表达（可选） -->
				<NFormItem :label="t('English Expression')" :label-style="label-style" path="meaning_en" class="meaning-input">
					<NInput size="small" v-model:value="model.meaning_en" :placeholder="t('A short definition in English (optional)')"
						type="textarea" autosize />
				</NFormItem>
				<!-- 中文含义（可选，为了兼容保留） -->
				<NFormItem :label="t('Chinese Meaning')" :label-style="label-style" path="meaning_cn" class="meaning-input">
					<NInput size="small" v-model:value="model.meaning_cn" :placeholder="meaningLoading ? '⏳ 查询词典中...' : t('A short definition in Chinese (optional)')"
						type="textarea" autosize :loading="meaningLoading" />
				</NFormItem>
				<!-- 类别，可以是Word或Phrase -->
				<NFormItem :label="t('Type')" :label-style="label-style" path="t">
					<NRadioGroup v-model:value="model.t">
						<NRadio value="WORD">{{ t("Word") }}</NRadio>
						<NRadio value="PHRASE">{{ t("Phrase") }}</NRadio>
					</NRadioGroup>
				</NFormItem>
				<!-- 考试级别（已整合进 Tags 标签栏，按钮行隐藏但功能保留） -->
				<NFormItem :label="t('Exam Level') || '考试级别'" :label-style="label-style" v-if="false">
					<div class="exam-level-buttons">
						<NButton
							v-for="(info, key) in EXAM_LEVELS"
							:key="key"
							size="small"
							:tertiary="selectedLevel !== key"
							:type="selectedLevel === key ? 'primary' : 'default'"
							:style="selectedLevel === key ? { backgroundColor: info.color, borderColor: info.color } : {}"
							@click="selectLevel(key)"
						>
							{{ info.labelZh }}
						</NButton>
						<NButton
							size="small"
							:tertiary="selectedLevel !== ''"
							:type="selectedLevel === '' ? 'warning' : 'default'"
							@click="selectLevel('')"
						>
							{{ t("None") || "无" }}
						</NButton>
					</div>
				</NFormItem>
				<!-- 当前单词的学习状态 -->
				<NFormItem :label="t('Status')" :label-style="label-style" path="status">
					<NRadioGroup v-model:value="model.status" size="small">
						<NRadioButton v-for="(s, i) in status" :value="i">
							{{ s.text }}
						</NRadioButton>
					</NRadioGroup>
				</NFormItem>
				<!-- 加一些tag, 可以用来搜索 -->
				<NFormItem :label="t('Tags')" :label-style="label-style" path="tags">
					<NSelect size="small" v-model:value="model.tags" filterable multiple tag
						:placeholder="t('Input or select some tags')" :loading="tagLoading" :options="tagOptions"
						@search="tagSearch" :key="selectKey" />
				</NFormItem>
				<!-- 可选,可以记多条笔记 -->
				<NFormItem :label="t('Notes')" :label-style="label-style" path="tags">
					<NDynamicInput v-model:value="model.notes" :create-button-props="{ size: 'small' }">
						<template #create-button-default>
							{{ t("Create") }}
						</template>
						<template #="{ index, value }">
							<NInput size="small" type="textarea" :placeholder="t('Write a new note')"
								v-model:value="model.notes[index]" />
						</template>
					</NDynamicInput>
				</NFormItem>
				<!-- 可选,例句也可以记多条 -->
				<div style="margin-bottom: 8px">
					<label for="Sentences" :style="[label-style]">{{
						t("Sentences")
					}}</label>
				</div>
				<NDynamicInput v-model:value="model.sentences" :create-button-props="{ size: 'small' }"
					:on-create="onCreateSentence" :on-delete="onDeleteSentence">
					<template #create-button-default>
						{{ t("Create") }}
					</template>
					<template #="{ index, value }">
						<div style="display: flex;
                                flex-direction: column;
                                flex: 1;
                                border: 2px solid gray;
                                border-radius: 3px;
                                padding: 3px;
                            ">
							<NFormItem :show-label="false" :path="`sentences[${index}].text`" :rule="sourceRule">
								<NInput size="small" type="textarea" v-model:value="model.sentences[index].text"
									:placeholder="t('Origin sentence')" :autosize="{ minRows: 1, maxRows: 3 }" />
							</NFormItem>
							<NFormItem :show-feedback="false" :show-label="false" :path="`sentences[${index}].trans`">
								<NInput size="small" type="textarea" v-model:value="model.sentences[index].trans"
									:placeholder="t('Translation (optional)')" :autosize="{ minRows: 1, maxRows: 3 }" />
							</NFormItem>
							<NFormItem :show-feedback="false" :show-label="false" :path="`sentences[${index}].origin`">
								<NInput size="small" type="textarea" v-model:value="
									model.sentences[index].origin
								" :placeholder="t('Origin (optional)')" :autosize="{ minRows: 1, maxRows: 3 }" />
							</NFormItem>
						</div>
					</template>
				</NDynamicInput>
			</NForm>

		<!-- 词形变体管理面板 (Phase 2) -->
			<div v-if="model.expression && showVariantsPanel" class="variants-panel">
				<div class="variants-header">
					<span class="variants-title">{{ t("Lemma Variants") || "词形变体" }}</span>
					<div class="variants-header-actions">
						<NButton size="tiny" @click="toggleVariantsPanel" quaternary>
							{{ variantsExpanded ? '−' : '+' }}
						</NButton>
					</div>
				</div>

				<div v-if="variantsExpanded" class="variants-content">
					<!-- 原始输入提示 -->
					<div v-if="originalInput && originalInput !== model.expression.toLowerCase()" class="original-input-hint">
						<span class="hint-icon">ℹ️</span>
						<span>{{ (t("Originally added as") || "最初添加为") }}: "{{ originalInput }}"</span>
					</div>

					<!-- 变体列表 -->
					<div class="variants-list">
						<div v-if="variants.length === 0" class="no-variants">
							{{ t("No variants recorded yet") || "暂无记录的变体" }}
						</div>

						<div v-for="(variant, index) in variants" :key="index" class="variant-item">
							<span class="variant-text">{{ variant.variant }}</span>
							<NTag v-if="variant.labelZh" size="small" :bordered="false" type="info" class="variant-tag">{{ variant.labelZh }}</NTag>
							<span v-if="variant.meaning_cn" class="variant-meaning">{{ variant.meaning_cn }}</span>
							<NButton size="tiny" @click="removeVariant(variant.variant)" quaternary circle>
								<template #icon>
									<NIcon :size="12">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
											<path d="M2.397 2.554l.073-.084a.75.75 0 0 1 .976-.073l.084.073L8 6.939l4.47-4.47a.75.75 0 1 1 1.06 1.061L9.061 8l4.47 4.47a.75.75 0 0 1 .072.976l-.073.084a.75.75 0 0 1-.976.073l-.084-.073L8 9.061l-4.47 4.47a.75.75 0 0 1-1.06-1.061L6.939 8l-4.47-4.47a.75.75 0 0 1-.072-.976l.073-.084z" fill="currentColor"/>
										</svg>
									</NIcon>
								</template>
							</NButton>
						</div>
					</div>

					<!-- 手动添加变体 -->
					<div class="add-variant-row">
						<NInput
							size="small"
							v-model:value="newVariantInput"
							:placeholder="(t('Add a variant') || '手动输入变体')"
							@keyup.enter="addVariant"
							clearable
						/>
						<NButton size="small" @click="addVariant" :disabled="!newVariantInput.trim()">
							+
						</NButton>
					</div>

					<!-- 统计信息 -->
					<div class="variants-stats">
						<span>{{ (t("Total variants") || "总计") }}: {{ variants.length }}</span>
					</div>
				</div>
			</div>
		</NConfigProvider>
	</div>
</template>

<script setup lang="ts">
import { Notice } from "obsidian";
import {
	ref,
	onMounted,
	onUnmounted,
	getCurrentInstance,
	computed,
	watch,
	nextTick,
	CSSProperties,
} from "vue";
import { logger } from "@/utils/logger";
import {
	NIcon,
	NIconWrapper,
	NForm,
	NFormItem,
	NInput,
	NRadio,
	NRadioButton,
	NRadioGroup,
	NButton,
	NDynamicInput,
	NSelect,
	NConfigProvider,
	darkTheme,
	GlobalThemeOverrides,
	NTag,
} from "naive-ui";

import { ExpressionInfo, Sentence } from "@/db/interface";
import { t } from "@/lang/helper";
import { useEvent } from "@/utils/use";
import { LearnPanelView } from "./LearnPanelView";
import { ReadingView } from "./ReadingView";
import Plugin from "@/plugin";
import { search, searchBasic } from "@dict/youdao/engine";
import { lemmatize, LABEL_MAP } from "@/utils/lemmatizer";
import { generateVariants, type VariantInfo } from "@/utils/variant-generator";
import { getEcdictVariants } from '@/data/ecdict-variants';
import { EXAM_LEVELS, type ExamLevelKey, extractLevelFromTags } from "@/utils/exam-levels";
import { getWordExamLevel, EXAM_VOCAB_MAP } from "@/data/exam-vocab";
import { useDebounceFn } from "@vueuse/core";
import store from "@/store";

const view: LearnPanelView =
	getCurrentInstance().appContext.config.globalProperties.view;
const plugin: Plugin =
	getCurrentInstance().appContext.config.globalProperties.plugin;

// 切换明亮/黑暗模式
const theme = computed(() => {
	return store.dark ? darkTheme : null;
});

const learnPanelFontSize = computed(() => {
	return store.learnPanelFontSize || "0.85em";
});

// 样式设置
const themeOverrides: GlobalThemeOverrides = {
	common: {},
	Form: {
		labelFontSizeTopMedium: "15px",
		feedbackFontSizeMedium: "13px",
		blankHeightMedium: "5px",
		feedbackHeightMedium: "22px",
	},
	Radio: {
		buttonBorderRadius: "5px",
		fontSizeMedium: "13px",
		fontSizeSmall: "13px",
		buttonHeightSmall: "22px",
	},
	Input: {
		fontSizeSmall: "12px",
		paddingSmall: "0 5px",
	},
	DynamicInput: {
		actionMargin: "0 0 0 5px",
	},
};

//表单数据
let model = ref<ExpressionInfo>({
	expression: null,
	meaning: null,
	meaning_en: null,
	meaning_cn: null,
	status: 0,
	t: "WORD",
	tags: [],
	notes: [],
	sentences: [],
});

// 词典查询缓存（A：同词只查一次）
const meaningCache = new Map<string, string>();
// 中文含义查询中状态（D：loading 提示）
const meaningLoading = ref(false);
// 查询版本号（F：防竞态，每次查询递增，过期结果丢弃）
let queryVersion = 0;
// 考试级别选择（#2：快捷按钮组）
const selectedLevel = ref<string>("");
// 用户是否手动选择过级别（手动后锁定，不再自动检测覆盖）
const manualLevelOverride = ref(false);
// 自动设置级别标记（区分自动检测 vs 用户手动修改 tags）
let isAutoSettingLevel = false;

function selectLevel(level: string) {
	manualLevelOverride.value = true;
	if (selectedLevel.value === level) {
		selectedLevel.value = "";
	} else {
		selectedLevel.value = level;
	}
	const tags = model.value.tags || [];
	const filtered = tags.filter(t => !EXAM_LEVELS[t as ExamLevelKey]);
	if (level) {
		filtered.push(level);
	}
	model.value.tags = filtered;
}

// ECDICT 自动级别检测（防抖 500ms）—— 方案C: 智能合并，无全局锁
const autoDetectLevel = useDebounceFn(() => {
	try {
		if (!model.value.expression || !model.value.expression.trim()) {
			selectedLevel.value = "";
			return;
		}
		const expr = model.value.expression.trim();
		if (expr.includes(" ")) return;
		const detected = getWordExamLevel(expr);
		if (detected) {
			isAutoSettingLevel = true;
			selectedLevel.value = detected;
			const tags = [...(model.value.tags || [])];
			const withoutLevels = tags.filter(t => !EXAM_LEVELS[t as ExamLevelKey]);
			if (!withoutLevels.includes(detected)) {
				withoutLevels.push(detected);
			}
			model.value.tags = withoutLevels;
			isAutoSettingLevel = false;
			nextTick(() => { selectKey.value++; });
		}
	} catch (e) {
		console.error('[ECDICT] autoDetectLevel error:', e);
	}
}, 500);

// 监听 expression 变化触发自动检测（覆盖：打字/lemmatize纠正/点击加载已有单词）
watch(() => model.value.expression, () => { autoDetectLevel(); });

// 监听 tags 变化同步 selectedLevel（用户通过 NSelect 手动修改 tags 时回写）—— 不再设置全局锁
watch(() => model.value.tags, (tags) => {
	if (isAutoSettingLevel) return;
	const levelTag = (tags || []).find(t => EXAM_LEVELS[t as ExamLevelKey]);
	selectedLevel.value = levelTag || "";
});

// 词形识别
let lemmaFlash = ref(false);
let lemmaTimer: ReturnType<typeof setTimeout> | null = null;
let isReplacingLemma = false;
// 记录用户原始输入（lemmatize 纠正前的值），用于提交时自动收集变体
let rawUserInput = ref<string>("");

watch(() => model.value.expression, async (expr) => {
	if (!expr || !expr.trim() || expr.trim().includes(" ") || isReplacingLemma) {
		return;
	}

	if (!plugin.settings.auto_lemmatize) return;

	const trimmedExpr = expr.trim();

	let targetLemma: string | null = null;

	const dbResult = await plugin.db.findExpression(trimmedExpr);
	if (dbResult.found && dbResult.matched_lemma
		&& dbResult.matched_lemma.toLowerCase() !== trimmedExpr.toLowerCase()
		&& (dbResult.match_type === 'lemma' || dbResult.match_type === 'variant')) {
		targetLemma = dbResult.matched_lemma;
	} else {
		const lemmaResult = lemmatize(trimmedExpr);
		if (lemmaResult && lemmaResult.lemma !== trimmedExpr.toLowerCase()
			&& EXAM_VOCAB_MAP.has(lemmaResult.lemma)) {
			targetLemma = lemmaResult.lemma;
		}
	}

	if (targetLemma) {
		rawUserInput.value = trimmedExpr;
		isReplacingLemma = true;
		if (lemmaTimer) clearTimeout(lemmaTimer);
		if (lemmaFlash.value) {
			lemmaFlash.value = false;
			setTimeout(() => {
				lemmaFlash.value = true;
				lemmaTimer = setTimeout(() => { lemmaFlash.value = false; }, 600);
			}, 50);
		} else {
			lemmaFlash.value = true;
			lemmaTimer = setTimeout(() => { lemmaFlash.value = false; }, 600);
		}
		nextTick(() => {
			model.value.expression = targetLemma!;
			isReplacingLemma = false;
		});
	} else {
		if (trimmedExpr && !rawUserInput.value) {
			rawUserInput.value = trimmedExpr;
		}
	}
});

onUnmounted(() => {
	if (lemmaTimer) {
		clearTimeout(lemmaTimer);
		lemmaTimer = null;
	}
});

onMounted(async () => {
	await tagSearch("");
});

// 词形变体管理 (Phase 2)
let showVariantsPanel = ref(true);
let variantsExpanded = ref(true);
let variants = ref<Array<{variant: string, label?: string, labelZh?: string, meaning_cn?: string}>>([]);
let originalInput = ref<string>("");
let newVariantInput = ref<string>("");


const toggleVariantsPanel = () => {
	variantsExpanded.value = !variantsExpanded.value;
};


const loadVariants = async (expression: string) => {
	if (!expression || expression.trim() === "") {
		variants.value = [];
		originalInput.value = "";
		return;
	}

	try {
		const loadedVariants = await plugin.getExpressionVariants(expression);

		// 用 ECDICT 数据补充每个变体的类型标签（DB 中可能已有 label/labelZh/meaning_cn）
		const ecdictVars = getEcdictVariants(expression);
		const ecdictLabelMap = new Map<string, {label: string, labelZh: string}>();
		for (const ev of ecdictVars) {
			ecdictLabelMap.set(ev.variant.toLowerCase(), {label: ev.label, labelZh: ev.labelZh});
		}

		const enrichedVariants = loadedVariants.map(v => {
			const vLower = typeof v === 'string' ? v : v.variant;
			const info = ecdictLabelMap.get(vLower);
			return {
				variant: vLower,
				label: (typeof v === 'object' && v.label) || info?.label,
				labelZh: (typeof v === 'object' && v.labelZh) || info?.labelZh,
				meaning_cn: (typeof v === 'object' ? v.meaning_cn : undefined),
			};
		});

		variants.value = enrichedVariants;

		const exprInfo = await plugin.db.getExpression(expression);
		if (exprInfo && exprInfo.original_input) {
			originalInput.value = exprInfo.original_input;
		}
	} catch (error) {
		logger.warn("Failed to load variants:", error);
		variants.value = [];
	}
};

const addVariant = async () => {
	const variant = newVariantInput.value.trim();
	if (!variant || !model.value.expression) return;

	if (variant.toLowerCase() === model.value.expression.toLowerCase()) {
		new Notice("⚠️ 变体不能与单词本身相同");
		return;
	}

	const success = await plugin.addVariant(model.value.expression, variant);

	if (success) {
		new Notice(`✅ 已添加变体: ${variant}`);
		newVariantInput.value = "";
		await loadVariants(model.value.expression);
	} else {
		new Notice("ℹ️ 该变体已存在或添加失败");
	}
};

const removeVariant = async (variant: string) => {
	if (!model.value.expression) return;

	const success = await plugin.removeVariant(model.value.expression, variant);

	if (success) {
		new Notice(`✅ 已移除变体: ${variant}`);
		await loadVariants(model.value.expression);
	} else {
		new Notice("❌ 移除变体失败");
	}
};

// 防抖加载变体（避免每次输入都查数据库）
const debouncedLoadVariants = useDebounceFn((expr: string) => {
	loadVariants(expr);
}, 400);

watch(() => model.value.expression, (newExpr) => {
	debouncedLoadVariants(newExpr || "");
});

function getQueryWord(): string {
	return model.value.expression?.trim() || "";
}

// F：统一的中文含义查询函数（带缓存 + 版本号防竞态）
async function fetchMeaningCn(word: string): Promise<string> {
	if (!word) return "";

	// A1：检查缓存（瞬时返回）
	if (meaningCache.has(word)) {
		return meaningCache.get(word)!;
	}

	// F1：递增版本号（标记本次查询）
	const currentVersion = ++queryVersion;
	meaningLoading.value = true;

	try {
		let result = await searchBasic(word);

		if (!result) {
			const lemma = lemmatize(word);
			if (lemma && lemma.lemma !== word) {
				result = await searchBasic(lemma.lemma);
				logger.log(`🔁 fetchMeaningCn("${word}") empty, retry with lemma "${lemma.lemma}": "${result}"`);
			}
		}

		// F2：防竞态检查 - 如果版本号已过期，说明用户已切换到新词，丢弃旧结果
		if (currentVersion !== queryVersion) {
			logger.log(`⚠️ Query outdated: "${word}" (v${currentVersion} < v${queryVersion}), discarding result`);
			return ""; // 丢弃过期结果
		}

		// A2：写入缓存
		meaningCache.set(word, result);
		return result;
	} catch (e) {
		logger.warn("searchBasic failed:", e);
		return "";
	} finally {
		// F3：只有最新版本的查询才关闭 loading
		if (currentVersion === queryVersion) {
			meaningLoading.value = false;
		}
	}
}

// 表单检查规则
let rules = {
	expression: {
		required: true,
		trigger: ["blur", "input"],
		message: t("Please input a word/phrase"),
	},
	meaning_cn: {
		required: true,
		trigger: ["blur", "input"],
		message: t("A short definition in Chinese is needed"),
	},
	t: {
		required: true,
		trigger: "change",
		message: "Expression can be a word or phrase",
	},
	status: {
		required: true,
	},
};

let sourceRule = {
	required: true,
	trigger: ["blur", "input"],
	message: "At least input a source sentence",
};

let labelStyle: CSSProperties = {
	fontWeight: "bold",
};

function onCreateSentence() {
	return {
		text: "",
		trans: "",
		origin: "",
	};
}

function onDeleteSentence() {
}

function resetForm() {
	isEditingFromReading.value = false;
	model.value = {
		expression: null,
		meaning: null,
		meaning_en: null,
		meaning_cn: null,
		status: 0,
		t: "WORD",
		tags: [],
		notes: [],
		sentences: [],
	};
	rawUserInput.value = "";
	selectedLevel.value = "";
	manualLevelOverride.value = false;
	selectKey.value++;
}

function onExpressionInput() {
	if (model.value.expression) {
		let expr = model.value.expression.trim();
		if (expr.includes(" ")) {
			const hasMultipleWords = expr.split(" ").filter(w => w.length > 0).length > 1;
			model.value.t = hasMultipleWords ? "PHRASE" : "WORD";
		} else {
			model.value.t = "WORD";
		}
	}
	if (!isEditingFromReading.value) {
		autoSearch();
	}
}

// 方案C: 输入防抖自动搜索（800ms）
const autoSearch = useDebounceFn(async () => {
	const expr = model.value.expression?.trim();
	if (!expr) return;

	searchLoading.value = true;
	try {
		let exprData = await plugin.db.getExpression(expr);
		if (!optionsLoaded.value) {
			await tagSearch("");
		}
		if (exprData) {
			if (exprData.tags && !Array.isArray(exprData.tags)) {
				exprData.tags = [...(exprData.tags as unknown as Set<string>)];
			}
			model.value = exprData;
			await nextTick();
			selectKey.value++;
			const existingLevel = extractLevelFromTags(exprData.tags || []);
			selectedLevel.value = existingLevel || "";
		} else {
			const currentTags = [...(model.value.tags || [])];
			// G: 先清空中文含义（避免显示上一个词的值），再异步查询
			model.value = {
				expression: expr,
				meaning: null,
				meaning_en: "",
				meaning_cn: "",
				meanings: [""],
				status: 1,
				t: "WORD",
				tags: currentTags,
				notes: [],
				sentences: [],
			};
			await nextTick();
			selectKey.value++;

			if (plugin.settings.auto_fill_meanings) {
				const meaningCn = await fetchMeaningCn(expr.toLowerCase());
				// H: 查询完成后，只更新含义字段（不重置其他数据）
				if (meaningCn && model.value.expression === expr) {
					model.value.meaning_cn = meaningCn;
					model.value.meanings = meaningCn.split(";").map(m => m.trim());
				}
			}
		}
	} finally {
		searchLoading.value = false;
	}
}, 800);

function handleEnterSearch() {
	autoSearch.flush();
}

// 单词状态样式
const status = [
	{ text: t("Ignore"), style: "" },
	{ text: t("Learning"), style: "background-Color: #ff980055" },
	{ text: t("Familiar"), style: "background-Color: #ffeb3c55" },
	{ text: t("Known"), style: "background-Color: #9eda5855" },
	{ text: t("Learned"), style: "background-Color: #4cb05155" },
];

// 异步获取数据库中所有tag
let tagOptions = ref<SelectOption[]>([]);
let tagLoading = ref(false);
let tags: string[] = [];
let selectKey = ref(0);
let optionsLoaded = ref(false);
let searchLoading = ref(false);
let isEditingFromReading = ref(false);

const LEVEL_TAG_OPTIONS: SelectOption[] = Object.entries(EXAM_LEVELS).map(([key, info]) => ({
	label: info.labelZh,
	value: key,
}));

async function tagSearch(query: string) {
	tagLoading.value = true;
	if (query.length < 2) {
		tags = await plugin.db.getTags();
	}
	tagLoading.value = false;

	const userOptions: SelectOption[] = tags
		.filter(v => !EXAM_LEVELS[v as ExamLevelKey])
		.filter(v => !query || v.toLowerCase().includes(query.toLowerCase()))
		.map(v => ({ label: v, value: v }));

	const matchedLevelOptions = LEVEL_TAG_OPTIONS.filter(o =>
		!query || o.label.includes(query) || o.value.includes(query.toLowerCase())
	);

	tagOptions.value = [...matchedLevelOptions, ...userOptions];
	optionsLoaded.value = true;
	selectKey.value++;
}

// 提交信息到数据库的加载状态
let successing = ref(false);
async function success() {
	successing.value = true;
	await sleep(2000)
	successing.value = false;
}
let failing = ref(false);
async function fail() {
	failing.value = true;
	await sleep(2000)
	failing.value = false;
}

let submitLoading = ref(false);

async function submit() {
	// 表单内容检查
	if (!model.value.expression) {
		new Notice(t("Expression is empty!"));
		return;
	}

	// 检查中文含义是否填写
	if (!model.value.meaning_cn) {
		new Notice(t("A short definition in Chinese is needed"));
		return;
	}

	if (
		model.value.expression.trim().split(" ").length > 1 &&
		model.value.t === "WORD"
	) {
		new Notice(t("It looks more like a PHRASE than a WORD"));
		return;
	}

	submitLoading.value = true;
	let data = JSON.parse(JSON.stringify(model.value));
	(data as any).expression = (data as any).expression.trim().toLowerCase();

	// 写入 original_input（用户最初输入的原始形式）
	if (rawUserInput.value && rawUserInput.value.toLowerCase() !== (data as any).expression) {
		(data as any).original_input = rawUserInput.value.toLowerCase();
	}

	let statusCode = await plugin.db.postExpression(data);
	submitLoading.value = false;

	if (statusCode !== 200) {
		new Notice("Submit failed");
		logger.warn("Submit failed, please check server status");
		fail();
		return;
	}

	// 提交成功后：如果原始输入与最终表达式不同（被 lemmatize 纠正过），自动添加为变体
	const finalExpr = (data as any).expression;
	const rawInput = rawUserInput.value.toLowerCase();
	if (rawInput && rawInput !== finalExpr) {
		try {
			await plugin.addVariant(finalExpr, rawInput);
			logger.log(`Auto-collected variant: "${rawInput}" → lemma "${finalExpr}"`);
		} catch (e) {
			logger.warn(`Failed to auto-collect variant "${rawInput}":`, e);
		}
	}
	rawUserInput.value = "";

	// 自动生成并保存变体形式（ECdict 始终生效，规则生成需用户主动开启）
	if (finalExpr && model.value.t === 'WORD') {
		try {
			const ecdictVars = getEcdictVariants(finalExpr) || [];

			let ruleVars: VariantInfo[] = [];
			if (plugin.settings.auto_generate_variants) {
				ruleVars = generateVariants(finalExpr, 'v.');
			}

			const variantMap = new Map(ecdictVars.map(v => [v.variant.toLowerCase(), v]));
			for (const rv of ruleVars) {
				variantMap.set(rv.variant.toLowerCase(), rv);
			}
			const mergedVars = [...variantMap.values()];

			const targetVariants = mergedVars.filter(v => v.variant.toLowerCase() !== finalExpr.toLowerCase());

			const variantQueries = targetVariants.map(async (v) => {
				let youdaoMeaning = "";
				try {
					if (meaningCache.has(v.variant)) {
						youdaoMeaning = meaningCache.get(v.variant)!;
					} else {
						youdaoMeaning = await searchBasic(v.variant);
						if (!youdaoMeaning) {
							const lemma = lemmatize(v.variant);
							if (lemma && lemma.lemma !== v.variant) {
								youdaoMeaning = await searchBasic(lemma.lemma);
								logger.log(`🔁 searchBasic("${v.variant}") empty, retry with lemma "${lemma.lemma}": "${youdaoMeaning}"`);
							}
						}
						if (youdaoMeaning) {
							meaningCache.set(v.variant, youdaoMeaning);
						}
					}
				} catch (e) {
					logger.debug(`searchBasic("${v.variant}") failed`);
				}
				return { v, youdaoMeaning };
			});

			const results = await Promise.allSettled(variantQueries);

			let savedCount = 0;
			let skipCount = 0;
			for (const r of results) {
				if (r.status !== 'fulfilled') continue;
				const { v, youdaoMeaning } = r.value;

				const variantMeaning = youdaoMeaning || "";

				const ok = await plugin.addVariant(finalExpr, v.variant, {
					label: v.label,
					labelZh: v.labelZh,
					meaning_cn: variantMeaning,
				});
				if (ok) {
					savedCount++;
					logger.log(`✅ Auto-variant: "${v.variant}" → "${finalExpr}" (${v.labelZh || ''})${youdaoMeaning ? ` [有道]` : ''}`);
				} else {
					skipCount++;
					logger.log(`⏭️ Variant exists or skipped: "${v.variant}"`);
				}
			}
			if (savedCount > 0) {
				new Notice(`📝 已为 "${finalExpr}" 自动保存 ${savedCount} 个词形变体`);
			}
			logger.log(`Auto-generated ${ecdictVars.length} variants for "${finalExpr}": ${savedCount} saved, ${skipCount} skipped`);
		} catch (e) {
			logger.warn(`Failed to auto-generate variants for "${finalExpr}":`, e);
			new Notice(`⚠️ 变体自动生成失败: ${(e as Error).message}`);
		}
	}

	success();
	isEditingFromReading.value = false;

	resetForm();

	dispatchEvent(
		new CustomEvent("obsidian-langr-refresh", {
			detail: {
				expression: model.value.expression,
				type: model.value.t,
				status: model.value.status,
			},
		})
	);
	dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

	//自动刷新数据库
	if (plugin.settings.auto_refresh_db) {
		plugin.refreshTextDB();
	}
}

// 查询词汇时自动填充新词表单
useEvent(window, "obsidian-langr-search", async (evt: CustomEvent) => {
	isEditingFromReading.value = true;
	let selection = evt.detail.selection as string;
	let target = evt.detail.target as HTMLElement;

	// 如果当前焦点在 LearnPanel 内的输入框中，不响应事件（避免复制文本时覆盖表单）
	const activeElement = document.activeElement as HTMLElement;
	if (activeElement) {
		const isInLearnPanel = activeElement.closest?.("#langr-learn-panel");
		// 检测所有可能的输入元素
		const isInputElement = activeElement.tagName === "INPUT" || 
							activeElement.tagName === "TEXTAREA" ||
							activeElement.isContentEditable ||
							activeElement.classList.contains("n-input__textarea-el") ||
							activeElement.classList.contains("n-input__input-el") ||
							activeElement.classList.contains("n-input");
		if (isInLearnPanel && isInputElement) {
			return;
		}
	}

	if (!optionsLoaded.value) {
		await tagSearch("");
	}

	let expr = await plugin.db.getExpression(selection);

	let exprType = "WORD";
	const trimmedSelection = selection.trim();
	if (trimmedSelection.includes(" ")) {
		const hasMultipleWords = trimmedSelection.split(" ").filter(w => w.length > 0).length > 1;
		if (hasMultipleWords) {
			exprType = "PHRASE";
		}
	}

	let sentenceText = "";
	let storedSen: Sentence = null;
	let defaultOrigin: string = null;
	let filledTrans = null;

	if (target) {
		let sentenceEl = target.parentElement.classList.contains("stns")
			? target.parentElement
			: target.parentElement.parentElement;
		sentenceText = sentenceEl.textContent;

		storedSen = await plugin.db.tryGetSen(sentenceText);

		let reading = view.app.workspace.getActiveViewOfType(ReadingView);

		if (reading) {
			let presetOrigin = view.app.metadataCache.getFileCache(reading.file)
				.frontmatter["langr-origin"];
			defaultOrigin = presetOrigin ? presetOrigin : reading.file.name;
		}

		if (plugin.settings.use_machine_trans) {
			try {
				let res = await search(sentenceText);
				if (res && (res.result as any).translation) {
					let html = (res.result as any).translation as string;
					const matches = html.match(/<p>([^<>]+)<\/p>/g);
					if (matches && matches.length > 0) {
						filledTrans = matches[1]?.match(/<p>(.*)<\/p>/)[1] ?? null;
					}
				}
			} catch (e) {
				logger.warn("Machine translation failed:", e);
				filledTrans = "";
			}
		}
	}

	if (expr) {
		if (sentenceText) {
			if (!storedSen) {
				expr.sentences = expr.sentences.concat({
					text: sentenceText,
					trans: filledTrans,
					origin: defaultOrigin,
				});
			} else {
				let added = expr.sentences.find(
					(sen) => sen.text === sentenceText
				);
				if (!added) {
					expr.sentences = expr.sentences.concat(storedSen);
				}
			}
		}
		// 兼容旧数据：如果没有meanings字段，从meaning中拆分
		if (!expr.meanings && expr.meaning) {
			expr.meanings = expr.meaning.split(";").map(m => m.trim());
		}
		// 确保至少有一个空的含义框
		if (!expr.meanings || expr.meanings.length === 0) {
			expr.meanings = [""];
		}
		if (expr.tags && !Array.isArray(expr.tags)) {
			expr.tags = [...(expr.tags as unknown as Set<string>)];
		}
		model.value = expr;
		await nextTick();
		selectKey.value++;
		const existingLevel = extractLevelFromTags(expr.tags || []);
		selectedLevel.value = existingLevel || "";
		manualLevelOverride.value = !!existingLevel; // 已有级别则锁定
		return;
	} else {
		// G: 先立即赋值基础数据（清空中文含义，避免显示上一个词的值）
		if (!target) {
			model.value = {
				expression: selection,
				meaning: null,
				meaning_en: "",
				meaning_cn: "",
				meanings: [""],
				status: 1,
				t: exprType,
				tags: [],
				notes: [],
				sentences: [],
			};
			await nextTick();
			selectKey.value++;
		} else {
			model.value = {
				expression: selection,
				meaning: null,
				meaning_en: "",
				meaning_cn: "",
				meanings: [""],
				status: 1,
				t: exprType,
				tags: [],
				notes: [],
				sentences: storedSen
					? [storedSen]
					: [
							{
								text: sentenceText,
								trans: filledTrans,
								origin: defaultOrigin,
							},
						],
			};
			await nextTick();
			selectKey.value++;
		}

		// H: 异步查询中文含义，完成后只更新含义字段
		if (plugin.settings.auto_fill_meanings) {
			const meaningCn = await fetchMeaningCn(getQueryWord().toLowerCase());
			if (meaningCn && model.value.expression === selection) {
				model.value.meaning_cn = meaningCn;
				model.value.meanings = meaningCn.split(";").map(m => m.trim());
			}
		}
		await nextTick();
		selectKey.value++;
	}
});

</script>

<style lang="scss">
#langr-learn-panel {
	padding-bottom: 18px;

	.expression-row {
		display: flex;
		align-items: center;
		gap: 8px;

		.expression-input {
			flex: 1;
		}

		.reset-button {
			flex-shrink: 0;
		}

		.submit-button {
			flex-shrink: 0;
		}

		.exam-level-buttons {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;

			button {
				font-size: 0.82em;
				padding: 2px 10px;
				border-radius: 14px;
				transition: all 0.2s ease;
				border-width: 1.5px;
			}

			button:hover {
				transform: translateY(-1px);
				box-shadow: 0 2px 6px rgba(0,0,0,0.12);
			}
		}
	}

	.expression-input.lemma-flash {
		animation: lemma-flash-green 0.6s ease-out;
	}

	@keyframes lemma-flash-green {
		0% {
			box-shadow: 0 0 0 0 rgba(24, 160, 88, 0.5);
			border-color: #18a058;
		}
		50% {
			box-shadow: 0 0 8px 3px rgba(24, 160, 88, 0.25);
			border-color: #18a058;
		}
		100% {
			box-shadow: 0 0 0 0 rgba(24, 160, 88, 0);
		}
	}

	.n-input {
		margin: 1px 0;
	}

	.n-form-item.meaning-input {
		margin-top: -16px;
	}

	.n-dynamic-input .n-button-group {
		flex-direction: column;

		button {
			height: 26px;
			width: 26px;

			&:nth-child(1) {
				border-top-left-radius: 34px !important;
				border-top-right-radius: 34px !important;
				border-bottom-left-radius: 0 !important;
				border-bottom-right-radius: 0 !important;
			}

			&:nth-child(2) {
				border-top-left-radius: 0 !important;
				border-top-right-radius: 0 !important;
				border-bottom-left-radius: 34px !important;
				border-bottom-right-radius: 34px !important;
			}
		}
	}

	// 词形变体管理面板样式 (Phase 2)
	.variants-panel {
		margin-top: 12px;
		padding: 10px;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		background-color: #fafafa;

		.variants-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 8px;

			.variants-title {
				font-weight: 600;
				font-size: 0.9em;
				color: #333;
			}

			.variants-header-actions {
				display: flex;
				align-items: center;
				gap: 6px;
			}
		}

		.variants-content {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.original-input-hint {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 6px 10px;
			background-color: #e3f2fd;
			border-left: 3px solid #2196f3;
			border-radius: 4px;
			font-size: 0.85em;
			color: #1565c0;

			.hint-icon {
				font-size: 1em;
			}
		}

		.variants-list {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			min-height: 30px;

			.no-variants {
				width: 100%;
				text-align: center;
				color: #999;
				font-size: 0.85em;
				font-style: italic;
				padding: 8px 0;
			}

			.variant-item {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				padding: 4px 10px;
				background-color: #fff9c4;
				border: 1px solid #fbc02d;
				border-radius: 16px;
				font-size: 0.85em;
				transition: all 0.2s ease;

				&:hover {
					background-color: #fff176;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1);
				}

				.variant-text {
					color: #5d4037;
					font-family: monospace;
				}

				.variant-tag {
					font-size: 0.75em;
					opacity: 0.85;
				}

				.variant-meaning {
					font-size: 0.78em;
					color: #795548;
					max-width: 150px;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
			}
		}

		.add-variant-row {
			display: flex;
			gap: 6px;
			align-items: center;

			input {
				flex: 1;
			}
		}

		.variants-stats {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding-top: 6px;
			border-top: 1px dashed #ddd;
			font-size: 0.8em;
			color: #666;
		}
	}
}
</style>