export type AnnotationSide = 'left' | 'right'

export interface AnnotationRule {
	side: AnnotationSide
	/** 在目标块中匹配的文本 */
	match: string
	/** 第几次出现（1-based），默认 1 */
	matchIndex: number
	/** 注释内容，支持 inline markdown */
	label: string
}

export interface ParsedAnnotation {
	rules: AnnotationRule[]
}

/**
 * 解析 annotation fence 的文本内容，返回结构化规则列表。
 *
 * 每行语法：
 *   left|right "匹配文本" 注释内容
 *   left|right "匹配文本"#2 注释内容（指定第几次出现）
 *
 * # 开头的行视为注释，空行忽略。
 */
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

// left|right "match text"#2 label content
const LINE_RE = /^(left|right)\s+"((?:[^"\\]|\\.)*)"\s*(?:#(\d+))?\s+([\s\S]+)$/

function parseLine(line: string): AnnotationRule | null {
	const m = LINE_RE.exec(line)
	if (!m) return null

	const [, side, rawMatch, indexStr, label] = m

	return {
		side: side as AnnotationSide,
		match: rawMatch.replace(/\\"/g, '"'),
		matchIndex: indexStr ? parseInt(indexStr, 10) : 1,
		label: label.trim(),
	}
}
