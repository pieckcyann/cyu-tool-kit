// parser.ts

/**
 * 支持三种语法：
 * left|right "match text"#2 label
 * left|right "" label          <- 空 match，指向整行
 * left|right label             <- 省略引号，指向整行
 */

export type AnnotationSide = 'left' | 'right'

export interface AnnotationRule {
	/** 注释位置，左还是右 */
	side: AnnotationSide
	/** 在目标块中匹配的文本 (空字符串 = 指向整行) */
	match: string
	/** 第几次出现 (1-based)，默认 1 */
	matchIndex: number
	/** 注释内容，支持 inline markdown */
	label: string
}

export interface ParsedAnnotation {
	rules: AnnotationRule[]
}

const LINE_WITH_MATCH_RE =
	/^(left|right)\s+"((?:[^"\\]|\\.)*)"\s*(?:#(\d+))?\s+([\s\S]+)$/
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

function parseLine(line: string): AnnotationRule | null {
	const m = LINE_WITH_MATCH_RE.exec(line)
	if (m) {
		const [, side, rawMatch, indexStr, label] = m
		return {
			side: side as AnnotationSide,
			match: rawMatch.replace(/\\"/g, '"'),
			matchIndex: indexStr ? parseInt(indexStr, 10) : 1,
			label: label.trim(),
		}
	}
	const m2 = LINE_NO_MATCH_RE.exec(line)
	if (m2) {
		const [, side, label] = m2
		return { side: side as AnnotationSide, match: '', matchIndex: 1, label: label.trim() }
	}
	return null
}
