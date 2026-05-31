export interface VariantInfo {
	variant: string;
	label: string;
	labelZh: string;
	pos: string;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const ES_ENDINGS = new Set(['s', 'x', 'z', 'ch', 'sh']);

function endsWithEs(word: string): boolean {
	for (const e of ES_ENDINGS) {
		if (word.endsWith(e)) return true;
	}
	return false;
}

function endsWithConsonantY(word: string): boolean {
	return word.length > 0 && word[word.length - 1] === 'y' && !VOWELS.has(word[word.length - 2]);
}

function endsWithSilentE(word: string): boolean {
	return word.endsWith('e') && word.length > 1 && VOWELS.has(word[word.length - 2]);
}

function isCVC(word: string): boolean {
	if (word.length < 3) return false;
	const last = word[word.length - 1];
	const secondLast = word[word.length - 2];
	const thirdLast = word[word.length - 3];
	return !VOWELS.has(last) && VOWELS.has(secondLast) && !VOWELS.has(thirdLast) && last !== 'w' && last !== 'x' && last !== 'y';
}

function endsWithFe(word: string): boolean {
	return word.endsWith('fe') || word.endsWith('f');
}

const IRREGULAR_VERBS: Record<string, VariantInfo[]> = {
	'be': [
		{ variant: 'am', label: '3sg', labelZh: '单数形式', pos: 'v.' },
		{ variant: 'is', label: '3sg', labelZh: '单数形式', pos: 'v.' },
		{ variant: 'are', label: '3sg', labelZh: '复数形式', pos: 'v.' },
		{ variant: 'was', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'were', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'been', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'being', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'have': [
		{ variant: 'has', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'had', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'having', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'do': [
		{ variant: 'does', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'did', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'done', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'doing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'go': [
		{ variant: 'goes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'went', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'gone', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'going', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'say': [
		{ variant: 'says', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'said', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'saying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'buy': [
		{ variant: 'buys', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'bought', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'buying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'catch': [
		{ variant: 'catches', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'caught', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'catching', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'teach': [
		{ variant: 'teaches', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'taught', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'teaching', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'think': [
		{ variant: 'thinks', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'thought', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'thinking', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'make': [
		{ variant: 'makes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'made', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'making', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'keep': [
		{ variant: 'keeps', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'kept', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'keeping', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'feel': [
		{ variant: 'feels', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'felt', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'feeling', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'send': [
		{ variant: 'sends', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'sent', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'sending', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'build': [
		{ variant: 'builds', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'built', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'building', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'lend': [
		{ variant: 'lends', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'lent', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'lending', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'spend': [
		{ variant: 'spends', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'spent', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'spending', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'leave': [
		{ variant: 'leaves', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'left', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'leaving', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'lose': [
		{ variant: 'loses', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'lost', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'losing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'meet': [
		{ variant: 'meets', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'met', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'meeting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'pay': [
		{ variant: 'pays', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'paid', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'paying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'sell': [
		{ variant: 'sells', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'sold', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'selling', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'tell': [
		{ variant: 'tells', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'told', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'telling', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'write': [
		{ variant: 'writes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'wrote', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'written', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'writing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'stand': [
		{ variant: 'stands', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'stood', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'standing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'understand': [
		{ variant: 'understands', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'understood', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'understanding', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'hold': [
		{ variant: 'holds', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'held', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'holding', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'find': [
		{ variant: 'finds', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'found', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'finding', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'hear': [
		{ variant: 'hears', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'heard', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'hearing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'know': [
		{ variant: 'knows', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'knew', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'known', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'knowing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'give': [
		{ variant: 'gives', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'gave', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'given', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'giving', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'get': [
		{ variant: 'gets', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'got', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'getting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'forget': [
		{ variant: 'forgets', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'forgot', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'forgotten', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'forgetting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'cut': [
		{ variant: 'cuts', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'cutting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'put': [
		{ variant: 'puts', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'putting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'set': [
		{ variant: 'sets', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'setting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'let': [
		{ variant: 'lets', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'letting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'hurt': [
		{ variant: 'hurts', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'hurting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'hit': [
		{ variant: 'hits', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'hitting', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'cost': [
		{ variant: 'costs', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'costing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'stop': [
		{ variant: 'stops', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'stopped', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'stopping', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'begin': [
		{ variant: 'begins', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'began', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'begun', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'beginning', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'swim': [
		{ variant: 'swims', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'swam', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'swum', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'swimming', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'sing': [
		{ variant: 'sings', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'sang', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'sung', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'singing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'drink': [
		{ variant: 'drinks', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'drank', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'drunk', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'drinking', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'drive': [
		{ variant: 'drives', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'drove', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'driven', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'driving', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'rise': [
		{ variant: 'rises', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'rose', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'risen', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'rising', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'fall': [
		{ variant: 'falls', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'fell', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'fallen', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'falling', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'speak': [
		{ variant: 'speaks', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'spoke', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'spoken', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'speaking', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'wake': [
		{ variant: 'wakes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'woke', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'woken', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'waking', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'eat': [
		{ variant: 'eats', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'ate', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'eaten', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'eating', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'choose': [
		{ variant: 'chooses', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'chose', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'chosen', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'choosing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'draw': [
		{ variant: 'draws', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'drew', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'drawn', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'drawing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'fly': [
		{ variant: 'flies', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'flew', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'flown', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'flying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'try': [
		{ variant: 'tries', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'tried', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'trying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'cry': [
		{ variant: 'cries', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'cried', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'crying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'lie': [
		{ variant: 'lies', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'lay', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'lain', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'lying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'die': [
		{ variant: 'dies', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'died', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'dying', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'take': [
		{ variant: 'takes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'took', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'taken', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'taking', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'see': [
		{ variant: 'sees', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'saw', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'seen', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'seeing', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'come': [
		{ variant: 'comes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'came', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'coming', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'become': [
		{ variant: 'becomes', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'became', label: 'ed', labelZh: '过去式', pos: 'v.' },
		{ variant: 'become', label: 'ed', labelZh: '过去分词', pos: 'v.' },
		{ variant: 'becoming', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
	'win': [
		{ variant: 'wins', label: '3sg', labelZh: '第三人称单数', pos: 'v.' },
		{ variant: 'won', label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' },
		{ variant: 'winning', label: 'ing', labelZh: '现在分词', pos: 'v.' },
	],
};

const IRREGULAR_NOUNS: Record<string, VariantInfo[]> = {
	'man': [{ variant: 'men', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'child': [{ variant: 'children', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'tooth': [{ variant: 'teeth', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'foot': [{ variant: 'feet', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'mouse': [{ variant: 'mice', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'goose': [{ variant: 'geese', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'ox': [{ variant: 'oxen', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'life': [{ variant: 'lives', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'leaf': [{ variant: 'leaves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'knife': [{ variant: 'knives', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'wife': [{ variant: 'wives', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'half': [{ variant: 'halves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'calf': [{ variant: 'calves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'self': [{ variant: 'selves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'sheaf': [{ variant: 'sheaves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'thief': [{ variant: 'thieves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'elf': [{ variant: 'elves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'loaf': [{ variant: 'loaves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'wharf': [{ variant: 'wharves', label: 'pl', labelZh: '复数', pos: 'n.' }],
	'person': [{ variant: 'people', label: 'pl', labelZh: '复数', pos: 'n.' }],
};

const IRREGULAR_ADJS: Record<string, VariantInfo[]> = {
	'good': [
		{ variant: 'better', label: 'er', labelZh: '比较级', pos: 'adj.' },
		{ variant: 'best', label: 'est', labelZh: '最高级', pos: 'adj.' },
	],
	'bad': [
		{ variant: 'worse', label: 'er', labelZh: '比较级', pos: 'adj.' },
		{ variant: 'worst', label: 'est', labelZh: '最高级', pos: 'adj.' },
	],
	'far': [
		{ variant: 'farther', label: 'er', labelZh: '比较级(距离)', pos: 'adj.' },
		{ variant: 'farthest', label: 'est', labelZh: '最高级(距离)', pos: 'adj.' },
		{ variant: 'further', label: 'er', labelZh: '比较级(程度)', pos: 'adj.' },
		{ variant: 'furthest', label: 'est', labelZh: '最高级(程度)', pos: 'adj.' },
	],
	'little': [
		{ variant: 'less', label: 'er', labelZh: '比较级', pos: 'adj.' },
		{ variant: 'least', label: 'est', labelZh: '最高级', pos: 'adj.' },
	],
	'many': [
		{ variant: 'more', label: 'er', labelZh: '比较级', pos: 'adj.' },
		{ variant: 'most', label: 'est', labelZh: '最高级', pos: 'adj.' },
	],
	'much': [
		{ variant: 'more', label: 'er', labelZh: '比较级', pos: 'adj.' },
		{ variant: 'most', label: 'est', labelZh: '最高级', pos: 'adj.' },
	],
};

function generateVerbVariants(lemma: string): VariantInfo[] {
	if (IRREGULAR_VERBS[lemma]) return IRREGULAR_VERBS[lemma];

	const results: VariantInfo[] = [];
	const lower = lemma.toLowerCase();

	const thirdSingular = generateThirdSingular(lower);
	if (thirdSingular) results.push({ variant: thirdSingular, label: '3sg', labelZh: '第三人称单数', pos: 'v.' });

	const ingForm = generateIng(lower);
	if (ingForm) results.push({ variant: ingForm, label: 'ing', labelZh: '现在分词', pos: 'v.' });

	const edForm = generateEd(lower);
	if (edForm) results.push({ variant: edForm, label: 'ed', labelZh: '过去式/过去分词', pos: 'v.' });

	return results;
}

function generateNounVariants(lemma: string): VariantInfo[] {
	if (IRREGULAR_NOUNS[lemma]) return IRREGULAR_NOUNS[lemma];

	const lower = lemma.toLowerCase();
	const plural = generatePlural(lower);

	if (!plural || plural === lower) return [];

	return [{ variant: plural, label: 'pl', labelZh: '复数', pos: 'n.' }];
}

function generateAdjVariants(lemma: string): VariantInfo[] {
	if (IRREGULAR_ADJS[lemma]) return IRREGULAR_ADJS[lemma];

	const lower = lemma.toLowerCase();
	const results: VariantInfo[] = [];

	const comparative = generateComparative(lower);
	if (comparative && comparative !== lower) {
		results.push({ variant: comparative, label: 'er', labelZh: '比较级', pos: 'adj.' });
	}

	const superlative = generateSuperlative(lower);
	if (superlative && superlative !== lower) {
		results.push({ variant: superlative, label: 'est', labelZh: '最高级', pos: 'adj.' });
	}

	return results;
}

function generateThirdSingular(word: string): string | null {
	if (endsWithEs(word)) return word + 'es';
	if (endsWithConsonantY(word)) return word.slice(0, -1) + 'ies';
	if (word.endsWith('o') && word.length > 1) return word + 'es';
	return word + 's';
}

function generatePlural(word: string): string | null {
	if (endsWithEs(word)) return word + 'es';
	if (endsWithConsonantY(word)) return word.slice(0, -1) + 'ies';
	if (endsWithFe(word)) {
		if (word.endsWith('fe')) return word.slice(0, -2) + 'ves';
		return word.slice(0, -1) + 'ves';
	}
	if (word.endsWith('o') && word.length > 1) return word + 'es';
	return word + 's';
}

function generateIng(word: string): string | null {
	let base = word;

	if (base.endsWith('ie')) {
		base = base.slice(0, -2) + 'y';
	} else if (endsWithSilentE(base)) {
		base = base.slice(0, -1);
	} else if (isCVC(base)) {
		base = base + base[base.length - 1];
	}

	return base + 'ing';
}

function generateEd(word: string): string | null {
	let base = word;

	if (base.endsWith('e')) {
		base = base;
	} else if (isCVC(base)) {
		base = base + base[base.length - 1];
	} else if (base.endsWith('y') && !VOWELS.has(base[base.length - 2])) {
		base = base.slice(0, -1) + 'i';
	} else {
	}

	return base + 'ed';
}

function generateComparative(word: string): string | null {
	let base = word;

	if (endsWithConsonantY(base)) {
		base = base.slice(0, -1) + 'i';
	} else if (base.endsWith('e')) {
		base = base;
	} else if (isCVC(base)) {
		base = base + base[base.length - 1];
	} else if (base.length <= 2) {
		return null;
	}

	return base + 'er';
}

function generateSuperlative(word: string): string | null {
	let base = word;

	if (endsWithConsonantY(base)) {
		base = base.slice(0, -1) + 'i';
	} else if (base.endsWith('e')) {
		base = base;
	} else if (isCVC(base)) {
		base = base + base[base.length - 1];
	} else if (base.length <= 2) {
		return null;
	}

	return base + 'est';
}

export function generateVariants(lemma: string, pos?: string): VariantInfo[] {
	const lower = lemma.toLowerCase().trim();

	if (!lower || lower.length < 2) return [];

	if (pos === 'WORD' || pos === 'v.') {
		return generateVerbVariants(lower);
	}

	if (pos === 'PHRASE' || pos === 'n.') {
		return generateNounVariants(lower);
	}

	if (pos === 'adj.') {
		return generateAdjVariants(lower);
	}

	const verbResults = generateVerbVariants(lower);
	const nounResults = generateNounVariants(lower);
	const adjResults = generateAdjVariants(lower);

	return [...nounResults, ...verbResults, ...adjResults];
}
