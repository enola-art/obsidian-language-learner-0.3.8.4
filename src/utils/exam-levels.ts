export interface ExamLevelInfo {
	label: string;
	labelZh: string;
	color: string;
	order: number;
	icon?: string;
}

export const EXAM_LEVELS: Record<string, ExamLevelInfo> = {
	hs:     { label: 'HS',    labelZh: '高中',   color: '#0097a7', order: 0 },
	cet4:   { label: 'CET-4', labelZh: '大学英语四级', color: '#1976d2', order: 1 },
	cet6:   { label: 'CET-6', labelZh: '大学英语六级', color: '#7b1fa2', order: 2 },
	kaoyan: { label: '考研',   labelZh: '考研',       color: '#455a64', order: 3 },
	ielts:  { label: 'IELTS', labelZh: '雅思',       color: '#388e3c', order: 4 },
	toefl:  { label: 'TOEFL', labelZh: '托福',       color: '#f57c00', order: 5 },
	gre:    { label: 'GRE',   labelZh: 'GRE',        color: '#c62828', order: 6 },
};

export const EXAM_LEVEL_KEYS = Object.keys(EXAM_LEVELS) as (keyof typeof EXAM_LEVELS)[];

export type ExamLevelKey = keyof typeof EXAM_LEVELS;

export function isExamLevel(tag: string): tag is ExamLevelKey {
	return tag in EXAM_LEVELS;
}

export function getLevelInfo(level: ExamLevelKey): ExamLevelInfo {
	return EXAM_LEVELS[level];
}

export function getLevelLabel(level: ExamLevelKey): string {
	return EXAM_LEVELS[level]?.labelZh || level;
}

export function getLevelColor(level: ExamLevelKey): string {
	return EXAM_LEVELS[level]?.color || '#999';
}

export function extractLevelFromTags(tags: string[]): ExamLevelKey | null {
	if (!tags || tags.length === 0) return null;
	for (const tag of tags) {
		const lower = tag.toLowerCase();
		if (isExamLevel(lower)) return lower;
	}
	return null;
}

export function removeLevelFromTags(tags: string[]): string[] {
	return tags.filter(t => !isExamLevel(t.toLowerCase()));
}
