// annRanger.ts

// ─── 底层基础设施 ──────────────────────────────────────────────────────────────

/**
 * 目标块的文本线性视图。
 *
 * 将 DOM 中碎片化的 Text 节点统一映射到一段连续的 flatText 字符串，
 * 所有定位函数都在这个线性空间里计算偏移，再通过 resolveOffset 转换回具体节点。
 *
 * 构建成本：一次 TreeWalker 遍历，O(n)。
 * 同一个定位任务如需多次查询，应先构建一次 BlockTextMap 再复用。
 */
interface BlockTextMap {
	nodes: Text[]
	/** 每个节点在 flatText 中的起始偏移（与 nodes 一一对应） */
	offsets: number[]
	flatText: string
}

/**
 * 在 flatText 中充当行分隔符的块级标签集合。
 * 当文本节点的"最近块级祖先"发生切换时，注入虚拟 \n，使 callout、列表等
 * HTML 结构化内容也能被 lineEndOffset / lineStartOffset 正确计行。
 */
const BLOCK_TAGS_FOR_SEPARATOR = new Set([
	'P',
	'LI',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'BLOCKQUOTE',
	'TR',
	'TD',
	'TH',
	'DD',
	'DT',
])

/**
 * 检查节点是否在预格式化上下文（code/pre）内。
 * 在 code/pre 里，\n 是语义化行分隔，有视觉高度，不能当 HTML 空白过滤。
 */
function isInsidePreformattedContext(node: Node, root: HTMLElement): boolean {
	let cur: Node | null = node.parentNode
	while (cur && cur !== root) {
		if (cur.nodeType === Node.ELEMENT_NODE) {
			const tag = (cur as HTMLElement).tagName
			if (tag === 'CODE' || tag === 'PRE') return true
		}
		cur = cur.parentNode
	}
	return false
}

/** 向上查找文本节点的最近块级祖先；到达 root 时返回 root 本身 */
function nearestBlockAncestor(node: Node, root: HTMLElement): Node {
	let cur: Node | null = node.parentNode
	while (cur && cur !== root) {
		if (
			cur.nodeType === Node.ELEMENT_NODE &&
			BLOCK_TAGS_FOR_SEPARATOR.has((cur as HTMLElement).tagName)
		)
			return cur
		cur = cur.parentNode
	}
	return root
}

/**
 * 构建目标块的 BlockTextMap（一次 TreeWalker 遍历）。
 *
 * 纯空白文本节点（如 HTML 元素间的换行 \n）完全跳过：
 * 它们的 getBoundingClientRect() 恒为零，若被纳入会导致定位打到 (0,0)。
 *
 * 行边界改由块级祖先切换时注入虚拟 \n 来标记，
 * offsets 同步计入该虚拟字符，使 resolveOffset 仍能正确映射回真实节点。
 */
function buildBlockTextMap(root: HTMLElement): BlockTextMap {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
	const nodes: Text[] = []
	const offsets: number[] = []
	let total = 0
	let flatText = ''
	let prevAncestor: Node | null = null
	let node: Text | null

	while ((node = walker.nextNode() as Text | null)) {
		const content = node.textContent ?? ''
		// 纯空白节点（HTML 格式化产生的换行等）跳过，它们无视觉坐标；
		// 但 code/pre 内的空白（\n 行分隔、缩进）有语义，需保留。
		if (content.trim() === '' && !isInsidePreformattedContext(node, root)) continue

		const ancestor = nearestBlockAncestor(node, root)
		if (prevAncestor !== null && ancestor !== prevAncestor) {
			flatText += '\n'
			total += 1
		}
		prevAncestor = ancestor
		offsets.push(total)
		nodes.push(node)
		flatText += content
		total += content.length
	}

	return { nodes, offsets, flatText }
}

/**
 * 将 flatText 中的全局偏移映射到具体的 Text 节点及节点内偏移。
 * 从后往前遍历，找到第一个 startAt ≤ globalOffset 的节点。
 */
function resolveOffset(
	map: BlockTextMap,
	globalOffset: number
): { node: Text; offset: number } | null {
	const { nodes, offsets } = map
	for (let i = nodes.length - 1; i >= 0; i--) {
		if (offsets[i] <= globalOffset) {
			return { node: nodes[i], offset: globalOffset - offsets[i] }
		}
	}
	return null
}

/**
 * 获取 flatText 中第 lineNumber 行（1-based）的起始偏移。
 * 即第 (lineNumber-1) 个 '\n' 之后的位置；第 1 行始终为 0。
 * 若行号超出范围，返回 flatText.length。
 */
function lineStartOffset(flatText: string, lineNumber: number): number {
	if (lineNumber <= 1) return 0
	let count = 0
	for (let i = 0; i < flatText.length; i++) {
		if (flatText[i] === '\n' && ++count === lineNumber - 1) return i + 1
	}
	return flatText.length
}

/**
 * 获取 flatText 中第 lineNumber 行（1-based）的结束偏移。
 * 返回值指向该行末尾的 '\n' 位置，或文本末尾（无换行时）。
 */
function lineEndOffset(flatText: string, lineNumber: number): number {
	let count = 0
	for (let i = 0; i < flatText.length; i++) {
		if (flatText[i] === '\n' && ++count === lineNumber) return i
	}
	return flatText.length
}

/**
 * 从 flatText 的 pos 位置向前查找所在行的行首偏移。
 * 用于"已知某位置，找其所在行的起点"。
 */
function lineStartFromPos(flatText: string, pos: number): number {
	const nlPos = flatText.lastIndexOf('\n', pos)
	return nlPos === -1 ? 0 : nlPos + 1
}

/**
 * 从 flatText 的 pos 位置向后查找所在行的行尾偏移（指向 '\n' 或文本末尾）。
 * 用于"已知某位置，找其所在行的终点"。
 */
function lineEndFromPos(flatText: string, pos: number): number {
	const nlPos = flatText.indexOf('\n', pos)
	return nlPos === -1 ? flatText.length : nlPos
}

/**
 * 在 flatText 中找第 n（1-based）次出现 text 的全局起始偏移。
 * 未找到足够次数时返回 -1。
 */
function findNthOccurrence(flatText: string, text: string, n: number): number {
	let pos = -1
	for (let i = 0; i < n; i++) {
		pos = flatText.indexOf(text, pos + 1)
		if (pos === -1) return -1
	}
	return pos
}

/** 从 flatText 的 pos 位置跳过连续的空格和 Tab，返回第一个非空白字符的偏移 */
function skipWhitespace(flatText: string, pos: number): number {
	while (pos < flatText.length && (flatText[pos] === ' ' || flatText[pos] === '\t')) {
		pos++
	}
	return pos
}

/** 将多个 DOMRect 合并为最小包围矩形 */
function mergeRects(rects: DOMRect[]): DOMRect {
	const left = Math.min(...rects.map((r) => r.left))
	const top = Math.min(...rects.map((r) => r.top))
	const right = Math.max(...rects.map((r) => r.right))
	const bottom = Math.max(...rects.map((r) => r.bottom))
	return new DOMRect(left, top, right - left, bottom - top)
}

/**
 * 获取有内容宽度的 Range 的 DOMRect（跨行时合并为最小包围矩形）。
 * 主要用于精确文本匹配（findTextRect）。
 */
function rectFromRange(range: Range): DOMRect | null {
	try {
		const rects = Array.from(range.getClientRects())
		if (rects.length === 0) return null
		return mergeRects(rects)
	} catch {
		return null
	}
}

/**
 * 获取光标（零宽度插入符）位置的 DOMRect。
 *
 * 当初始 rect 为零尺寸时，按 preferred 方向向前/向后扩展一个字符重试；
 * 首选方向不可用（已到节点边界）时自动尝试另一方向，确保尽可能返回有效 rect。
 *
 * @param preferred 优先尝试的扩展方向，行尾用 'prev'，行首用 'next'
 */
function caretRectAt(
	node: Text,
	offset: number,
	preferred: 'prev' | 'next' = 'prev'
): DOMRect | null {
	try {
		const range = document.createRange()
		range.setStart(node, offset)
		range.setEnd(node, offset)
		const rect = range.getBoundingClientRect()
		if (rect.height !== 0 || rect.width !== 0) return rect

		// 首选方向
		if (preferred === 'prev' && offset > 0) {
			range.setStart(node, offset - 1)
			const r = range.getBoundingClientRect()
			if (r.height !== 0 || r.width !== 0) return r
		} else if (preferred === 'next' && offset < node.length) {
			range.setEnd(node, offset + 1)
			const r = range.getBoundingClientRect()
			if (r.height !== 0 || r.width !== 0) return r
		}

		// 备选方向（首选不可用或仍为零时）
		range.setStart(node, offset)
		range.setEnd(node, offset)
		if (preferred !== 'next' && offset < node.length) {
			range.setEnd(node, offset + 1)
		} else if (preferred !== 'prev' && offset > 0) {
			range.setStart(node, offset - 1)
		}
		return range.getBoundingClientRect()
	} catch {
		return null
	}
}

// ─── 新增定位函数指引 ──────────────────────────────────────────────────────────

// 所有定位函数都遵循同一套流程，按需组合以下步骤：
//
//   1. buildBlockTextMap(root)
//      将目标块的 DOM 文本节点线性化，得到 flatText 和节点映射表。
//      整个定位任务只需调用一次；如果一个函数需要多次查询，复用同一个 map。
//
//   2. 在 flatText 中计算目标位置（全局偏移）
//      根据需求选择对应工具：
//      · 按行号定位   → lineStartOffset / lineEndOffset
//      · 按文本内容   → findNthOccurrence（得到匹配起始偏移）
//      · 从某位置找行边界 → lineStartFromPos / lineEndFromPos
//      · 跳过行首空白  → skipWhitespace
//      以上工具均在纯字符串空间操作，无 DOM 访问。
//
//   3. resolveOffset(map, globalOffset)
//      将步骤 2 得到的全局偏移转换为 { node: Text, offset: number }。
//      返回 null 时说明块内无文本，函数应直接返回 null。
//
//   4. 获取 DOMRect
//      · 光标位置（行首/行尾/任意插入点）→ caretRectAt(node, offset, preferred)
//        行尾用 'prev'，行首用 'next'（零尺寸时的扩展方向）。
//      · 有内容宽度的区间（文本高亮范围）→ 手动创建 Range 后调用 rectFromRange(range)。
//        需要先用 resolveOffset 分别得到 startInfo / endInfo，
//        再 range.setStart / setEnd，最后调用 rectFromRange。
//

// ─── 公开定位函数 ──────────────────────────────────────────────────────────────

/** 找目标块中第一个 img 元素的 DOMRect */
export function findImageRect(targetBlock: HTMLElement): DOMRect | null {
	const img = targetBlock.querySelector('img')
	return img ? img.getBoundingClientRect() : null
}

/**
 * 获取目标块中第 lineNumber 行（1-based）末尾的光标位置矩形。
 * 返回的 rect 位于该行最后一个可见字符之后、'\n' 之前。
 */
export function findLineEndRect(
	targetBlock: HTMLElement,
	lineNumber: number
): DOMRect | null {
	const map = buildBlockTextMap(targetBlock)
	const endPos = lineEndOffset(map.flatText, lineNumber)
	const info = resolveOffset(map, endPos)
	if (!info) return null
	return caretRectAt(info.node, info.offset, 'prev')
}

/**
 * 获取目标块中第 lineNumber 行（1-based）首部的光标位置矩形。
 * 默认跳过行首空白（缩进），可通过 options.skipLeadingWhitespace = false 关闭。
 */
export function findLineStartRect(
	targetBlock: HTMLElement,
	lineNumber: number,
	options?: { skipLeadingWhitespace?: boolean }
): DOMRect | null {
	const skip = options?.skipLeadingWhitespace ?? true
	const map = buildBlockTextMap(targetBlock)
	let startPos = lineStartOffset(map.flatText, lineNumber)
	if (skip) startPos = skipWhitespace(map.flatText, startPos)
	const info = resolveOffset(map, startPos)
	if (!info) return null
	return caretRectAt(info.node, info.offset, 'next')
}

/**
 * 获取目标块中第 matchIndex 次出现 matchText 所在行的行首光标矩形。
 * 用于 inline 模式下标签的水平起始锚点。
 */
export function findLineStartRectByText(
	targetBlock: HTMLElement,
	matchText: string,
	matchIndex: number,
	options?: { skipLeadingWhitespace?: boolean }
): DOMRect | null {
	const skip = options?.skipLeadingWhitespace ?? true
	const map = buildBlockTextMap(targetBlock)
	const matchPos = findNthOccurrence(map.flatText, matchText, matchIndex)
	if (matchPos === -1) return null
	let startPos = lineStartFromPos(map.flatText, matchPos)
	if (skip) startPos = skipWhitespace(map.flatText, startPos)
	const info = resolveOffset(map, startPos)
	if (!info) return null
	return caretRectAt(info.node, info.offset, 'next')
}

/**
 * 获取目标块中第 matchIndex 次出现 matchText 所在行的行尾光标矩形。
 * 用于 inline 模式下标签的水平结束锚点。
 */
export function findLineEndRectByText(
	targetBlock: HTMLElement,
	matchText: string,
	matchIndex: number
): DOMRect | null {
	const map = buildBlockTextMap(targetBlock)
	const matchPos = findNthOccurrence(map.flatText, matchText, matchIndex)
	if (matchPos === -1) return null
	const endPos = lineEndFromPos(map.flatText, matchPos + matchText.length)
	const info = resolveOffset(map, endPos)
	if (!info) return null
	return caretRectAt(info.node, info.offset, 'prev')
}

/**
 * 用 Range API 在目标块内精确定位第 matchIndex 次出现 matchText 的 DOMRect。
 * 跨行时合并为最小包围矩形。返回 null 表示未找到。
 */
export function findTextRect(
	root: HTMLElement,
	matchText: string,
	matchIndex: number
): { rect: DOMRect; range: Range } | null {
	if (!matchText) return null
	const map = buildBlockTextMap(root)
	const startPos = findNthOccurrence(map.flatText, matchText, matchIndex)
	if (startPos === -1) return null
	const endPos = startPos + matchText.length
	const startInfo = resolveOffset(map, startPos)
	const endInfo = resolveOffset(map, endPos)
	if (!startInfo || !endInfo) return null
	const range = document.createRange()
	range.setStart(startInfo.node, startInfo.offset)
	range.setEnd(endInfo.node, endInfo.offset)
	const rect = rectFromRange(range)
	if (!rect) return null
	return { rect, range }
}
