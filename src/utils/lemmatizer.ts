interface Pattern {
	suffix: RegExp;
	replace: string;
	pos: string;
	label: string;
}

const VERB_PATTERNS: Pattern[] = [
	{ suffix: /ies$/, replace: 'y', pos: 'v.', label: '3sg' },
	{ suffix: /ves$/, replace: 'f', pos: 'v.-3sg', label: '3sg' },
	{ suffix: /xes$/, replace: 'x', pos: 'v.', label: '3sg' },
	{ suffix: /ches$/, replace: 'ch', pos: 'v.', label: '3sg' },
	{ suffix: /shes$/, replace: 'sh', pos: 'v.', label: '3sg' },
	{ suffix: /sses$/, replace: 'ss', pos: 'v.', label: '3sg' },
	{ suffix: /([^aeiou])es$/, replace: '$1', pos: 'v.', label: '3sg' },
	{ suffix: /ying$/, replace: 'y', pos: 'v.-ing', label: 'ing' },
	{ suffix: /eing$/, replace: 'e', pos: 'v.-ing', label: 'ing' },
	{ suffix: /([^aeiou])([a-z])ing$/, replace: '$1$2$2', pos: 'v.-ing', label: 'ing' },
	{ suffix: /ing$/, replace: '', pos: 'v.-ing', label: 'ing' },
	{ suffix: /ied$/, replace: 'y', pos: 'v.-ed', label: 'ed' },
	{ suffix: /([^aeiou][aeiou])ed$/, replace: '$1', pos: 'v.-ed', label: 'ed' },
	{ suffix: /ed$/, replace: '', pos: 'v.-ed', label: 'ed' },
];

const ADJ_PATTERNS: Pattern[] = [
	{ suffix: /ier$/, replace: 'y', pos: 'adj.-er', label: 'er' },
	{ suffix: /([^aeiou][aeiou])er$/, replace: '$1', pos: 'adj.-er', label: 'er' },
	{ suffix: /er$/, replace: '', pos: 'adj.-er', label: 'er' },
	{ suffix: /iest$/, replace: 'y', pos: 'adj.-est', label: 'est' },
	{ suffix: /([^aeiou][aeiou])est$/, replace: '$1', pos: 'adj.-est', label: 'est' },
	{ suffix: /est$/, replace: '', pos: 'adj.-est', label: 'est' },
];

const NOUN_PATTERNS: Pattern[] = [
	{ suffix: /ies$/, replace: 'y', pos: 'n.-pl', label: 'pl' },
	{ suffix: /ves$/, replace: 'f', pos: 'n.-pl', label: 'pl' },
	{ suffix: /ves$/, replace: 'fe', pos: 'n.-pl', label: 'pl' },
	{ suffix: /ses$/, replace: 's', pos: 'n.-pl', label: 'pl' },
	{ suffix: /xes$/, replace: 'x', pos: 'n.-pl', label: 'pl' },
	{ suffix: /ches$/, replace: 'ch', pos: 'n.-pl', label: 'pl' },
	{ suffix: /shes$/, replace: 'sh', pos: 'n.-pl', label: 'pl' },
	{ suffix: /sses$/, replace: 'ss', pos: 'n.-pl', label: 'pl' },
	{ suffix: /([^aeiou])es$/, replace: '$1', pos: 'n.-pl', label: 'pl' },
	{ suffix: /men$/, replace: 'man', pos: 'n.-pl', label: 'pl' },
	{ suffix: /s$/, replace: '', pos: 'n.-pl', label: 'pl' },
];

const ALL_PATTERNS = [...NOUN_PATTERNS, ...VERB_PATTERNS, ...ADJ_PATTERNS];

export interface LemmaResult {
	lemma: string;
	original: string;
	pos: string;
	label: string;
}

function tryPatterns(word: string): LemmaResult | null {
	const lower = word.toLowerCase();
	let bestResult: LemmaResult | null = null;

	for (const pattern of ALL_PATTERNS) {
		if (pattern.suffix.test(lower)) {
			const lemma = lower.replace(pattern.suffix, pattern.replace);
			
			if (lemma !== lower && lemma.length >= 2) {
				const result = { lemma, original: word, pos: pattern.pos, label: pattern.label };
				
				if (!bestResult || isValidLemma(lemma, word)) {
					bestResult = result;
				}
			}
		}
	}
	
	return bestResult && isValidLemma(bestResult.lemma, word) ? bestResult : null;
}

const COMMON_EXCEPTIONS: Record<string, LemmaResult> = {
	'was': { lemma: 'be', original: 'was', pos: 'v.-ed', label: 'ed' },
	'were': { lemma: 'be', original: 'were', pos: 'v.-ed', label: 'ed' },
	'been': { lemma: 'be', original: 'been', pos: 'v.-ed', label: 'ed' },
	'am': { lemma: 'be', original: 'am', pos: 'v.', label: '3sg' },
	'is': { lemma: 'be', original: 'is', pos: 'v.', label: '3sg' },
	'are': { lemma: 'be', original: 'are', pos: 'v.', label: '3sg' },
	'has': { lemma: 'have', original: 'has', pos: 'v.', label: '3sg' },
	'had': { lemma: 'have', original: 'had', pos: 'v.-ed', label: 'ed' },
	'did': { lemma: 'do', original: 'did', pos: 'v.-ed', label: 'ed' },
	'does': { lemma: 'do', original: 'does', pos: 'v.', label: '3sg' },
	'done': { lemma: 'do', original: 'done', pos: 'v.-ed', label: 'ed' },
	'went': { lemma: 'go', original: 'went', pos: 'v.-ed', label: 'ed' },
	'gone': { lemma: 'go', original: 'gone', pos: 'v.-ed', label: 'ed' },
	'said': { lemma: 'say', original: 'said', pos: 'v.-ed', label: 'ed' },
	'bought': { lemma: 'buy', original: 'bought', pos: 'v.-ed', label: 'ed' },
	'caught': { lemma: 'catch', original: 'caught', pos: 'v.-ed', label: 'ed' },
	'taught': { lemma: 'teach', original: 'taught', pos: 'v.-ed', label: 'ed' },
	'thought': { lemma: 'think', original: 'thought', pos: 'v.-ed', label: 'ed' },
	'made': { lemma: 'make', original: 'made', pos: 'v.-ed', label: 'ed' },
	'kept': { lemma: 'keep', original: 'kept', pos: 'v.-ed', label: 'ed' },
	'felt': { lemma: 'feel', original: 'felt', pos: 'v.-ed', label: 'ed' },
	'sent': { lemma: 'send', original: 'sent', pos: 'v.-ed', label: 'ed' },
	'built': { lemma: 'build', original: 'built', pos: 'v.-ed', label: 'ed' },
	'lent': { lemma: 'lend', original: 'lent', pos: 'v.-ed', label: 'ed' },
	'spent': { lemma: 'spend', original: 'spent', pos: 'v.-ed', label: 'ed' },
	'left': { lemma: 'leave', original: 'left', pos: 'v.-ed', label: 'ed' },
	'lost': { lemma: 'lose', original: 'lost', pos: 'v.-ed', label: 'ed' },
	'met': { lemma: 'meet', original: 'met', pos: 'v.-ed', label: 'ed' },
	'paid': { lemma: 'pay', original: 'paid', pos: 'v.-ed', label: 'ed' },
	'read': { lemma: 'read', original: 'read', pos: 'v.-ed', label: 'ed' },
	'sold': { lemma: 'sell', original: 'sold', pos: 'v.-ed', label: 'ed' },
	'told': { lemma: 'tell', original: 'told', pos: 'v.-ed', label: 'ed' },
	'wrote': { lemma: 'write', original: 'wrote', pos: 'v.-ed', label: 'ed' },
	'stood': { lemma: 'stand', original: 'stood', pos: 'v.-ed', label: 'ed' },
	'understood': { lemma: 'understand', original: 'understood', pos: 'v.-ed', label: 'ed' },
	'held': { lemma: 'hold', original: 'held', pos: 'v.-ed', label: 'ed' },
	'found': { lemma: 'find', original: 'found', pos: 'v.-ed', label: 'ed' },
	'heard': { lemma: 'hear', original: 'heard', pos: 'v.-ed', label: 'ed' },
	'knew': { lemma: 'know', original: 'knew', pos: 'v.-ed', label: 'ed' },
	'gave': { lemma: 'give', original: 'gave', pos: 'v.-ed', label: 'ed' },
	'got': { lemma: 'get', original: 'got', pos: 'v.-ed', label: 'ed' },
	'forgot': { lemma: 'forget', original: 'forgot', pos: 'v.-ed', label: 'ed' },
	'cut': { lemma: 'cut', original: 'cut', pos: 'v.-ed', label: 'ed' },
	'put': { lemma: 'put', original: 'put', pos: 'v.-ed', label: 'ed' },
	'set': { lemma: 'set', original: 'set', pos: 'v.-ed', label: 'ed' },
	'let': { lemma: 'let', original: 'let', pos: 'v.-ed', label: 'ed' },
	'hurt': { lemma: 'hurt', original: 'hurt', pos: 'v.-ed', label: 'ed' },
	'hit': { lemma: 'hit', original: 'hit', pos: 'v.-ed', label: 'ed' },
	'cost': { lemma: 'cost', original: 'cost', pos: 'v.-ed', label: 'ed' },
	'best': { lemma: 'good', original: 'best', pos: 'adj.-est', label: 'est' },
	'better': { lemma: 'good', original: 'better', pos: 'adj.-er', label: 'er' },
	'worst': { lemma: 'bad', original: 'worst', pos: 'adj.-est', label: 'est' },
	'worse': { lemma: 'bad', original: 'worse', pos: 'adj.-er', label: 'er' },
	'more': { lemma: 'much/many', original: 'more', pos: 'adj.-er', label: 'er' },
	'most': { lemma: 'much/many', original: 'most', pos: 'adj.-est', label: 'est' },
	'less': { lemma: 'little', original: 'less', pos: 'adj.-er', label: 'er' },
	'least': { lemma: 'little', original: 'least', pos: 'adj.-est', label: 'est' },
	'farther': { lemma: 'far', original: 'farther', pos: 'adj.-er', label: 'er' },
	'farthest': { lemma: 'far', original: 'farthest', pos: 'adj.-est', label: 'est' },
	'further': { lemma: 'far', original: 'further', pos: 'adj.-er', label: 'er' },
	'furthest': { lemma: 'far', original: 'furthest', pos: 'adj.-est', label: 'est' },
	'children': { lemma: 'child', original: 'children', pos: 'n.-pl', label: 'pl' },
	'teeth': { lemma: 'tooth', original: 'teeth', pos: 'n.-pl', label: 'pl' },
	'feet': { lemma: 'foot', original: 'feet', pos: 'n.-pl', label: 'pl' },
	'mice': { lemma: 'mouse', original: 'mice', pos: 'n.-pl', label: 'pl' },
	'geese': { lemma: 'goose', original: 'geese', pos: 'n.-pl', label: 'pl' },
	'oxen': { lemma: 'ox', original: 'oxen', pos: 'n.-pl', label: 'pl' },
	'lives': { lemma: 'life', original: 'lives', pos: 'n.-pl', label: 'pl' },
	'leaves': { lemma: 'leaf', original: 'leaves', pos: 'n.-pl', label: 'pl' },
	'knives': { lemma: 'knife', original: 'knives', pos: 'n.-pl', label: 'pl' },
	'wives': { lemma: 'wife', original: 'wives', pos: 'n.-pl', label: 'pl' },
	'halves': { lemma: 'half', original: 'halves', pos: 'n.-pl', label: 'pl' },
	'calves': { lemma: 'calf', original: 'calves', pos: 'n.-pl', label: 'pl' },
	'selves': { lemma: 'self', original: 'selves', pos: 'n.-pl', label: 'pl' },
	'sheaves': { lemma: 'sheaf', original: 'sheaves', pos: 'n.-pl', label: 'pl' },
	'thieves': { lemma: 'thief', original: 'thieves', pos: 'n.-pl', label: 'pl' },
	'elves': { lemma: 'elf', original: 'elves', pos: 'n.-pl', label: 'pl' },
	'loaves': { lemma: 'loaf', original: 'loaves', pos: 'n.-pl', label: 'pl' },
	'wharves': { lemma: 'wharf', original: 'wharves', pos: 'n.-pl', label: 'pl' },
	'criteria': { lemma: 'criterion', original: 'criteria', pos: 'n.-pl', label: 'pl' },
	'phenomena': { lemma: 'phenomenon', original: 'phenomena', pos: 'n.-pl', label: 'pl' },
	'data': { lemma: 'datum', original: 'data', pos: 'n.-pl', label: 'pl' },
	'analyses': { lemma: 'analysis', original: 'analyses', pos: 'n.-pl', label: 'pl' },
	'bases': { lemma: 'basis', original: 'bases', pos: 'n.-pl', label: 'pl' },
	'crises': { lemma: 'crisis', original: 'crises', pos: 'n.-pl', label: 'pl' },
	'theses': { lemma: 'thesis', original: 'theses', pos: 'n.-pl', label: 'pl' },
	// 新增不规则动词
	'showed': { lemma: 'show', original: 'showed', pos: 'v.-ed', label: 'ed' },
	'shown': { lemma: 'show', original: 'shown', pos: 'v.-ed', label: 'ed' },
	'shone': { lemma: 'shine', original: 'shone', pos: 'v.-ed', label: 'ed' },
	'shang': { lemma: 'hang', original: 'shang', pos: 'v.-ed', label: 'ed' },
	'hung': { lemma: 'hang', original: 'hung', pos: 'v.-ed', label: 'ed' },
	'drawn': { lemma: 'draw', original: 'drawn', pos: 'v.-ed', label: 'ed' },
	'drunk': { lemma: 'drink', original: 'drunk', pos: 'v.-ed', label: 'ed' },
	'drove': { lemma: 'drive', original: 'drove', pos: 'v.-ed', label: 'ed' },
	'driven': { lemma: 'drive', original: 'driven', pos: 'v.-ed', label: 'ed' },
	'spoke': { lemma: 'speak', original: 'spoke', pos: 'v.-ed', label: 'ed' },
	'spoken': { lemma: 'speak', original: 'spoken', pos: 'v.-ed', label: 'ed' },
	'broke': { lemma: 'break', original: 'broke', pos: 'v.-ed', label: 'ed' },
	'broken': { lemma: 'break', original: 'broken', pos: 'v.-ed', label: 'ed' },
	'woke': { lemma: 'wake', original: 'woke', pos: 'v.-ed', label: 'ed' },
	'woken': { lemma: 'wake', original: 'woken', pos: 'v.-ed', label: 'ed' },
	'ate': { lemma: 'eat', original: 'ate', pos: 'v.-ed', label: 'ed' },
	'eaten': { lemma: 'eat', original: 'eaten', pos: 'v.-ed', label: 'ed' },
	'chose': { lemma: 'choose', original: 'chose', pos: 'v.-ed', label: 'ed' },
	'chosen': { lemma: 'choose', original: 'chosen', pos: 'v.-ed', label: 'ed' },
	'threw': { lemma: 'throw', original: 'threw', pos: 'v.-ed', label: 'ed' },
	'thrown': { lemma: 'throw', original: 'thrown', pos: 'v.-ed', label: 'ed' },
	'froze': { lemma: 'freeze', original: 'froze', pos: 'v.-ed', label: 'ed' },
	'frozen': { lemma: 'freeze', original: 'frozen', pos: 'v.-ed', label: 'ed' },
	'slew': { lemma: 'slay', original: 'slew', pos: 'v.-ed', label: 'ed' },
	'slain': { lemma: 'slay', original: 'slain', pos: 'v.-ed', label: 'ed' },
	'lay': { lemma: 'lie', original: 'lay', pos: 'v.-ed', label: 'ed' },
	'laid': { lemma: 'lay', original: 'laid', pos: 'v.-ed', label: 'ed' },
	'died': { lemma: 'die', original: 'died', pos: 'v.-ed', label: 'ed' },
	'took': { lemma: 'take', original: 'took', pos: 'v.-ed', label: 'ed' },
	'taken': { lemma: 'take', original: 'taken', pos: 'v.-ed', label: 'ed' },
	'saw': { lemma: 'see', original: 'saw', pos: 'v.-ed', label: 'ed' },
	'seen': { lemma: 'see', original: 'seen', pos: 'v.-ed', label: 'ed' },
	'came': { lemma: 'come', original: 'came', pos: 'v.-ed', label: 'ed' },
	'won': { lemma: 'win', original: 'won', pos: 'v.-ed', label: 'ed' },
	'ran': { lemma: 'run', original: 'ran', pos: 'v.-ed', label: 'ed' },
	'run': { lemma: 'run', original: 'run', pos: 'v.-ed', label: 'ed' },
	'sang': { lemma: 'sing', original: 'sang', pos: 'v.-ed', label: 'ed' },
	'sung': { lemma: 'sing', original: 'sung', pos: 'v.-ed', label: 'ed' },
	'sank': { lemma: 'sink', original: 'sank', pos: 'v.-ed', label: 'ed' },
	'sunk': { lemma: 'sink', original: 'sunk', pos: 'v.-ed', label: 'ed' },
	'swam': { lemma: 'swim', original: 'swam', pos: 'v.-ed', label: 'ed' },
	'swum': { lemma: 'swim', original: 'swum', pos: 'v.-ed', label: 'ed' },
	'begun': { lemma: 'begin', original: 'begun', pos: 'v.-ed', label: 'ed' },
	'began': { lemma: 'begin', original: 'began', pos: 'v.-ed', label: 'ed' },
	'forgotten': { lemma: 'forget', original: 'forgotten', pos: 'v.-ed', label: 'ed' },
	'written': { lemma: 'write', original: 'written', pos: 'v.-ed', label: 'ed' },
	'known': { lemma: 'know', original: 'known', pos: 'v.-ed', label: 'ed' },
	'grown': { lemma: 'grow', original: 'grown', pos: 'v.-ed', label: 'ed' },
	'grew': { lemma: 'grow', original: 'grew', pos: 'v.-ed', label: 'ed' },
	'flown': { lemma: 'fly', original: 'flown', pos: 'v.-ed', label: 'ed' },
	'flew': { lemma: 'fly', original: 'flew', pos: 'v.-ed', label: 'ed' },
	'risen': { lemma: 'rise', original: 'risen', pos: 'v.-ed', label: 'ed' },
	'rose': { lemma: 'rise', original: 'rose', pos: 'v.-ed', label: 'ed' },
	'fallen': { lemma: 'fall', original: 'fallen', pos: 'v.-ed', label: 'ed' },
	'fell': { lemma: 'fall', original: 'fell', pos: 'v.-ed', label: 'ed' },
	'bound': { lemma: 'bind', original: 'bound', pos: 'v.-ed', label: 'ed' },
	'bred': { lemma: 'breed', original: 'bred', pos: 'v.-ed', label: 'ed' },
	'brought': { lemma: 'bring', original: 'brought', pos: 'v.-ed', label: 'ed' },
	'broadcast': { lemma: 'broadcast', original: 'broadcast', pos: 'v.-ed', label: 'ed' },
	'burnt': { lemma: 'burn', original: 'burnt', pos: 'v.-ed', label: 'ed' },
	'dreamt': { lemma: 'dream', original: 'dreamt', pos: 'v.-ed', label: 'ed' },
	'knelt': { lemma: 'kneel', original: 'knelt', pos: 'v.-ed', label: 'ed' },
	'lit': { lemma: 'light', original: 'lit', pos: 'v.-ed', label: 'ed' },
	'mean': { lemma: 'mean', original: 'mean', pos: 'v.-ed', label: 'ed' },
	'proven': { lemma: 'prove', original: 'proven', pos: 'v.-ed', label: 'ed' },
	'rid': { lemma: 'rid', original: 'rid', pos: 'v.-ed', label: 'ed' },
	'rung': { lemma: 'ring', original: 'rung', pos: 'v.-ed', label: 'ed' },
	'shad': { lemma: 'shed', original: 'shad', pos: 'v.-ed', label: 'ed' },
	'shed': { lemma: 'shed', original: 'shed', pos: 'v.-ed', label: 'ed' },
	'shit': { lemma: 'shit', original: 'shit', pos: 'v.-ed', label: 'ed' },
	'shot': { lemma: 'shoot', original: 'shot', pos: 'v.-ed', label: 'ed' },
	'smelt': { lemma: 'melt', original: 'smelt', pos: 'v.-ed', label: 'ed' },
	'spit': { lemma: 'spit', original: 'spit', pos: 'v.-ed', label: 'ed' },
	'spoilt': { lemma: 'spoil', original: 'spoilt', pos: 'v.-ed', label: 'ed' },
	'strode': { lemma: 'stride', original: 'strode', pos: 'v.-ed', label: 'ed' },
	'stridden': { lemma: 'stride', original: 'stridden', pos: 'v.-ed', label: 'ed' },
	'struck': { lemma: 'strike', original: 'struck', pos: 'v.-ed', label: 'ed' },
	'stricken': { lemma: 'strike', original: 'stricken', pos: 'v.-ed', label: 'ed' },
	'swept': { lemma: 'sweep', original: 'swept', pos: 'v.-ed', label: 'ed' },
	'torn': { lemma: 'tear', original: 'torn', pos: 'v.-ed', label: 'ed' },
	'tore': { lemma: 'tear', original: 'tore', pos: 'v.-ed', label: 'ed' },
	'woven': { lemma: 'weave', original: 'woven', pos: 'v.-ed', label: 'ed' },
	'wove': { lemma: 'weave', original: 'wove', pos: 'v.-ed', label: 'ed' },
	'withdrawn': { lemma: 'withdraw', original: 'withdrawn', pos: 'v.-ed', label: 'ed' },
	'withdrew': { lemma: 'withdraw', original: 'withdrew', pos: 'v.-ed', label: 'ed' },
	'withheld': { lemma: 'withhold', original: 'withheld', pos: 'v.-ed', label: 'ed' },
	'withstood': { lemma: 'withstand', original: 'withstood', pos: 'v.-ed', label: 'ed' },
	'wrung': { lemma: 'wring', original: 'wrung', pos: 'v.-ed', label: 'ed' },
};

const INVALID_LEMMAS: Set<string> = new Set([
	'ris', 'primit', 'complet', 'absolut', 'accomodat',
	'acquir', 'adapt', 'admir', 'advertis', 'advanc',
	'affec', 'agre', 'allow', 'alter', 'analys',
	'announc', 'anticip', 'anxiet', 'apart', 'appeal',
	'applaud', 'appli', 'appoint', 'apprais', 'appreci',
	'approach', 'appropri', 'approv', 'argu', 'aris',
	'arrest', 'arriv', 'ascend', 'assembl', 'assert',
	'assess', 'assign', 'assist', 'associ', 'assum',
	'assur', 'attach', 'attain', 'attempt', 'attend',
	'attract', 'attribut',
	// 新增常见错误还原
	'abi', 'abli', 'accu', 'ackn', 'acquai',
	'addre', 'admi', 'adop', 'advoc', 'aer',
	'affec', 'aggre', 'albu', 'alien', 'alter',
	'ambl', 'ambu', 'amen', 'ampl', 'analy',
	'anch', 'angu', 'anim', 'annih', 'annul',
	'answ', 'antagon', 'anticip', 'anxiou', 'apart',
	'apolog', 'appea', 'applau', 'appoi', 'apprai',
	'appreh', 'approac', 'appropri', 'approv', 'apt',
	'arbitr', 'archaeol', 'ardent', 'armo', 'arraign',
	'arre', 'arrog', 'articul', 'artific', 'ascen',
	'ascrib', 'asid', 'aspir', 'assaul', 'asse',
	'asset', 'assign', 'assimil', 'associ', 'assum',
	'asta', 'astonish', 'astron', 'atmosp', 'atomiz',
	'attach', 'attain', 'attempt', 'attend', 'attrac',
	'attribut', 'auction', 'audienc', 'autho', 'autom',
	'avenu', 'averag', 'avenu', 'avert', 'aviati',
	'awak', 'award', 'awestr', 'axi',
]);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function countVowels(word: string): number {
	return Array.from(word.toLowerCase()).filter(c => VOWELS.has(c)).length;
}

function hasValidSyllableStructure(word: string): boolean {
	if (word.length < 2) return false;
	
	const lower = word.toLowerCase();
	
	for (let i = 0; i < lower.length; i++) {
		const isVowel = VOWELS.has(lower[i]);
		
		if (i > 0 && i < lower.length - 1) {
			const prevIsVowel = VOWELS.has(lower[i - 1]);
			const nextIsVowel = VOWELS.has(lower[i + 1]);
			
			if (!prevIsVowel && !nextIsVowel && !isVowel) {
				const consonantRun = [lower[i - 1], lower[i], lower[i + 1]].join('');
				if (consonantRun.match(/^[bcdfghjklmnpqrstvwxyz]{3}$/)) {
					return false;
				}
			}
		}
	}
	
	return true;
}

function isValidLemma(lemma: string, original: string): boolean {
	if (INVALID_LEMMAS.has(lemma)) {
		return false;
	}
	
	if (lemma.length < 2) {
		return false;
	}
	
	if (lemma.length > original.length + 2) {
		return false;
	}
	
	const vowelCount = countVowels(lemma);
	if (vowelCount === 0) {
		return false;
	}
	
	if (!hasValidSyllableStructure(lemma)) {
		return false;
	}
	
	if (original.length >= 4 && lemma.length <= 4) {
		const reductionRatio = original.length / lemma.length;
		if (reductionRatio > 1.8) {
			return false;
		}
	}
	
	return true;
}

export function lemmatize(word: string): LemmaResult | null {
	const lower = word.toLowerCase();

	const exception = COMMON_EXCEPTIONS[lower];
	if (exception) return exception;

	const result = tryPatterns(word);
	
	if (result && result.lemma !== lower) {
		return result;
	}
	
	return null;
}

export function parseRelWord(relWordHtml: string | undefined): Map<string, string> | null {
	if (!relWordHtml) return null;

	const container = document.createElement('div');
	container.innerHTML = relWordHtml;

	const links = container.querySelectorAll('a[href*="/w/"]');
	if (links.length === 0) return null;

	const map = new Map<string, string>();
	links.forEach((link) => {
		const href = link.getAttribute('href') || '';
		const match = href.match(/\/w\/([\w-]+)/);
		if (match) {
			const lemma = match[1].toLowerCase();
			const text = link.textContent?.trim() || '';
			const parentText = link.parentElement?.textContent?.trim() || '';
			map.set(lemma, parentText || text);
		}
	});

	return map.size > 0 ? map : null;
}

export const LABEL_MAP: Record<string, { en: string; zh: string; 'zh-TW': string }> = {
	'3sg': { en: '3rd person singular', zh: '第三人称单数', 'zh-TW': '第三人稱單數' },
	'ing': { en: 'present participle', zh: '现在分词', 'zh-TW': '現在分詞' },
	'ed': { en: 'past tense/participle', zh: '过去式/过去分词', 'zh-TW': '過去式/過去分詞' },
	'er': { en: 'comparative', zh: '比较级', 'zh-TW': '比較級' },
	'est': { en: 'superlative', zh: '最高级', 'zh-TW': '最高級' },
	'pl': { en: 'plural', zh: '复数', 'zh-TW': '複數' },
};
