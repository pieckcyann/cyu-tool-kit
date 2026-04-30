// annParser.ts

/**
 * 支持三种语法：
 * left|right "match text"#2 label
 * left|right "" label          <- 空 match，指向整行
 * left|right label             <- 省略引号，指向整行
 */

export type AnnotationSide = 'left' | 'right'
export type AnnotationDisplay = 'block' | 'inline'

export interface AnnotationRule {
	/** 注释位置，左还是右 */
	side: AnnotationSide
	/** 在目标块中匹配的文本 (空字符串 = 指向整行) */
	match: string
	/** 第几次出现 (1-based)，默认 1 */
	matchIndex: number
	/** 注释内容，支持 inline markdown */
	label: string
	/** 注释应该在行内还是栏外 */
	display: AnnotationDisplay
}

export interface ParsedAnnotation {
	rules: AnnotationRule[]
}

/**
 * 优化后的正则：
 * 1. (left|right): 侧边
 * 2. (["']): 捕获引号类型 (Group 2)
 * 3. ((?:[^\\]|\\.)*?): 非贪婪匹配引号内的内容 (Group 3)
 * 4. \2: 匹配与 Group 2 相同的结束引号
 * 5. (?:#(\d+))?: 可选的索引
 * 6. ([\s\S]+): 剩余的 label 内容
 */
const LINE_WITH_MATCH_RE =
	/^(left|right)\s+(["'])((?:(?!\2)[^\\]|\\.)*)\2\s*(?:#(\d+))?\s+([\s\S]+)$/
const LINE_NO_MATCH_RE = /^(left|right)\s+([\s\S]+)$/

export function parseAnnotationBlock(source: string): ParsedAnnotation {
	const rules: AnnotationRule[] = []
	for (const rawLine of source.split('\n')) {
		const line = rawLine.trim()
		if (!line || line.startsWith('#')) continue
		const rule = parseLine(line)
		if (rule) rules.push(rule)
	}
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
		const [, side, quote, rawMatch, indexStr, label] = m

		// 根据引号类型决定 displayMode
		const displayMode: AnnotationDisplay = quote === "'" ? 'inline' : 'block'

		// 处理转义：如果是单引号，反斜杠转义单引号；双引号同理
		const unescapedMatch = rawMatch.replace(new RegExp(`\\\\${quote}`, 'g'), quote)

		return {
			side: side as AnnotationSide,
			match: unescapedMatch,
			matchIndex: indexStr ? parseInt(indexStr, 10) : 1,
			label: label.trim(),
			display: displayMode,
		}
	}

	// 2. 尝试匹配不带引号的简写语法 (left/right label)
	const m2 = LINE_NO_MATCH_RE.exec(line)
	if (m2) {
		const [, side, label] = m2
		return {
			side: side as AnnotationSide,
			match: '',
			matchIndex: 1,
			label: label.trim(),
			display: 'block', // 简写语法默认设为 block
		}
	}

	return null
}
