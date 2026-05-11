// annParser.ts
export type AnnotationSide = 'left' | 'right'
export type AnnotationDisplay =
	| 'block' // 栏外
	| 'inline' // 行内
	| 'whole' // 整块

export interface AnnotationRule {
	/** 注释位置，左还是右 */
	side: AnnotationSide
	/** 在目标块中匹配的文本 (空字符串 = 指向整行) */
	match: string
	/** 第几次出现 (1-based)，支持负数，默认为 null (未指定) */
	matchIndex: number | null
	/** 注释内容，支持 inline markdown */
	label: string
	/** 注释应该在行内还是栏外 */
	display: AnnotationDisplay
	/** 注释是否是仅指向整块 */
}

export interface ParsedAnnotation {
	rules: AnnotationRule[]
}

/**
 * 将 side 字符串标准化为 AnnotationSide
 */
function normalizeSide(sideStr: string): AnnotationSide | null {
	const lower = sideStr.toLowerCase()
	if (lower === 'left' || lower === 'l' || lower === '<') return 'left'
	if (lower === 'right' || lower === 'r' || lower === '>') return 'right'
	return null
}

/**
 * 优化后的正则（支持 left/right/l/r/</>）：
 * 1. (left|right|l|r|<|>): 侧边
 * 2. (["']): 捕获引号类型 (Group 2)
 * 3. ((?:[^\\]|\\.)*?): 非贪婪匹配引号内的内容 (Group 3)
 * 4. \2: 匹配与 Group 2 相同的结束引号
 * 5. (?:#(-?\d+))?: 可选的索引（支持负数）
 * 6. ([\s\S]+): 剩余的 label 内容
 */
const LINE_WITH_MATCH_RE =
	/^(left|right|l|r|<|>)\s+(["'])((?:(?!\2)[^\\]|\\.)*)\2\s*(?:#(-?\d+))?(?:\s+([\s\S]*))?$/

// 无引号语法：支持 left/right/l/r/</>，可选的索引（支持负数 ），以及 label
const NO_QUOTE_WITH_INDEX_RE = /^(left|right|l|r|<|>)\s*(?:#(-?\d+))?(?:\s+([\s\S]*))?$/

export function parseAnnotationBlock(source: string): ParsedAnnotation {
	const rules: AnnotationRule[] = []

	const lines = source.split('\n')

	let currentRule: AnnotationRule | null = null

	function flushCurrentRule() {
		if (currentRule) {
			currentRule.label = currentRule.label.trim()
			rules.push(currentRule)
			currentRule = null
		}
	}

	for (const rawLine of lines) {
		const trimmed = rawLine.trim()

		// 空行：保留到当前 label 中
		if (!trimmed) {
			if (currentRule) {
				currentRule.label += '\n'
			}
			continue
		}

		// 注释行
		if (trimmed.startsWith('#')) continue

		// 尝试解析为新规则
		const rule = parseLine(trimmed)

		if (rule) {
			flushCurrentRule()
			currentRule = rule
			continue
		}

		// 否则视为上一条规则的 label 续行
		if (currentRule) {
			currentRule.label += '\n' + rawLine.trimEnd()
		}
	}

	flushCurrentRule()

	return { rules }
}

/**
 * 兼容引号省略
 * @param line
 * @returns
 */
function parseLine(line: string): AnnotationRule | null {
	// 1. 尝试匹配带引号的情况
	const m = LINE_WITH_MATCH_RE.exec(line)

	if (m) {
		const [, sideRaw, quote, rawMatch, indexStr, label = ''] = m

		const side = normalizeSide(sideRaw)
		if (!side) return null
		// 根据引号类型决定 displayMode
		const displayMode: AnnotationDisplay = quote === "'" ? 'inline' : 'block'

		// 处理转义：如果是单引号，反斜杠转义单引号；双引号同理
		const unescapedMatch = rawMatch.replace(new RegExp(`\\\\${quote}`, 'g'), quote)

		return {
			side: side as AnnotationSide,
			match: unescapedMatch,
			matchIndex: indexStr ? parseInt(indexStr, 10) : null,
			label: label.trim(),
			display: displayMode,
		}
	}

	// 2. 尝试匹配不带引号的整行语法 (left/right label)
	const m2 = NO_QUOTE_WITH_INDEX_RE.exec(line)
	if (m2) {
		const [, sideRaw, indexStr, label = ''] = m2

		const side = normalizeSide(sideRaw)
		if (!side) return null

		return {
			side: side as AnnotationSide,
			match: '',
			matchIndex: indexStr ? parseInt(indexStr, 10) : null,
			label: label.trim(),
			display: 'whole',
		}
	}

	return null
}
