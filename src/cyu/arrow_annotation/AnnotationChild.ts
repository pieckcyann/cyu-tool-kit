// Annotation.ts
import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownRenderer,
	Notice,
} from 'obsidian'
import { parseAnnotationBlock, AnnotationRule } from './annParser'
import { renderArrows, ArrowTarget, HighlightType } from './annRenderer'
import CyuToolkitPlugin from '../../main'
import { findTextRect } from './annRanger'

/**
 * 每个 annotation 块对应一个实例，生命周期由 Obsidian 管理。
 *
 * 布局策略：
 *   不改变目标块在文档流中的位置和尺寸，
 *   在目标块外套一层相对定位的 wrapper，
 *   注释标签绝对定位浮在 wrapper 两侧，
 *   SVG 箭头层同样绝对定位叠在 wrapper 上。
 *
 * 实时更新：
 *   onunload 时将目标块还原到 wrapper 之前，删除 wrapper，
 *   保证 Obsidian 重新触发时 DOM 结构是干净的。
 */
export class AnnotationChild extends MarkdownRenderChild {
	private app: App
	private src: string
	private ctx: MarkdownPostProcessorContext
	private ro: ResizeObserver | null = null
	private wrapper: HTMLElement | null = null // 套在目标块外的 wrapper，onunload 时移除
	private targetBlock: HTMLElement | null = null // 被移入 wrapper 的目标块，onunload 时还原

	constructor(
		app: App,
		containerEl: HTMLElement,
		src: string,
		ctx: MarkdownPostProcessorContext
	) {
		super(containerEl)
		this.app = app
		this.src = src
		this.ctx = ctx
	}

	onload() {
		const { rules } = parseAnnotationBlock(this.src)
		if (rules.length === 0) {
			this.containerEl.style.display = 'none'
			return
		}

		// 找目标块
		const targetBlock = findPreviousBlock(this.containerEl)
		if (!targetBlock) {
			this.containerEl.style.display = 'none'
			return
		}

		this.targetBlock = targetBlock
		this.buildLayout(targetBlock, rules)
	}

	onunload() {
		this.ro?.disconnect()

		// 把目标块从 wrapper 里还原到 wrapper 之前，再删除 wrapper
		// 这样下次 onload 时 findPreviousBlock 仍能正确找到目标块
		if (this.wrapper && this.targetBlock) {
			this.wrapper.parentElement?.insertBefore(this.targetBlock, this.wrapper)
			this.wrapper.remove()
			this.wrapper = null
			this.targetBlock = null
		}
	}

	// ─── 构建左中右布局 ──────────────────────────────────────────────────────────────

	private buildLayout(targetBlock: HTMLElement, rules: AnnotationRule[]) {
		const isCodeBlock =
			targetBlock.tagName === 'PRE' ||
			targetBlock.tagName === 'CODE' ||
			targetBlock.querySelector('pre, code')

		console.log(`isCodeBlock:${isCodeBlock}`)

		const leftRules = rules.filter((r) => r.side === 'left')
		const rightRules = rules.filter((r) => r.side === 'right')
		// 右侧：代码块内有足够空间的走 inline，其余走 sidebar
		const rightInlineRules = isCodeBlock ? rules.filter((r) => r.side === 'right') : []
		const rightSidebarRules = isCodeBlock ? [] : rules.filter((r) => r.side === 'right')

		// wrapper 套在目标块外，提供相对定位上下文
		const wrapper = document.createElement('div')
		wrapper.classList.add('annotation-wrapper')
		this.wrapper = wrapper
		targetBlock.parentElement!.insertBefore(wrapper, targetBlock)
		wrapper.appendChild(targetBlock)

		// annotation fence 自己不展示
		this.containerEl.style.display = 'none'

		// 渲染标签并记录对应规则，供箭头定位使用
		const labelEls: { el: HTMLElement; rule: AnnotationRule }[] = []

		if (leftRules.length > 0) {
			const leftCol = this.createCol('left', leftRules, labelEls)
			wrapper.appendChild(leftCol)
		}

		if (rightSidebarRules.length > 0) {
			const rightCol = this.createCol('right', rightSidebarRules, labelEls)
			wrapper.appendChild(rightCol)
		}

		// inline labels：先创建好挂到 wrapper，drawArrows 里再定位
		for (const rule of rightInlineRules) {
			const labelEl = this.createLabel(rule.label)
			labelEl.classList.add('annotation-label--inline-right')
			wrapper.appendChild(labelEl)
			labelEls.push({ el: labelEl, rule })
		}

		// 等两帧确保 DOM 已绘制，DOMRect 才准确
		// requestAnimationFrame(() => {
		// requestAnimationFrame(() => {
		// 定位 inline labels
		positionInlineLabels(wrapper, targetBlock, labelEls)
		drawArrows(wrapper, targetBlock, labelEls)
		// })
		// })

		// 容器尺寸变化时重绘 (侧栏拖拽、窗口缩放等)
		this.ro = new ResizeObserver(() => {
			positionInlineLabels(wrapper, targetBlock, labelEls)
			drawArrows(wrapper, targetBlock, labelEls)
		})
		this.ro.observe(wrapper)
	}

	// ─── 创建注释列 ────────────────────────────────────────────────────────────

	private createCol(
		side: 'left' | 'right',
		rules: AnnotationRule[],
		labelEls: { el: HTMLElement; rule: AnnotationRule }[]
	): HTMLElement {
		const col = document.createElement('div')
		col.classList.add('annotation-col', `annotation-col--${side}`)

		for (const rule of rules) {
			const labelEl = this.createLabel(rule.label)
			col.appendChild(labelEl)
			labelEls.push({ el: labelEl, rule })
		}

		return col
	}

	// ─── 渲染 inline markdown 标签 ────────────────────────────────────────────

	private createLabel(markdownText: string): HTMLElement {
		const el = document.createElement('div')
		el.classList.add('annotation-label')

		// 渲染 md 语法
		MarkdownRenderer.render(this.app, markdownText, el, this.ctx.sourcePath, this)

		const p = el.querySelector('p')
		if (p && p.parentElement === el && el.children.length === 1) {
			while (p.firstChild) el.appendChild(p.firstChild)
			p.remove()
		}

		// 分类挂属性
		const type = this.classifyText(el)
		el.dataset.annotationType = type

		// short：稍后 renderer 画圈
		// long：波浪线
		// line：不处理
		return el
	}

	classifyText = (el: HTMLElement): 'short' | 'long' | 'line' => {
		const text = el.textContent?.trim() || ''
		if (text.length < 12) return 'short'
		if (text.length < 80) return 'long'
		return 'line'
	}
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────

/**
 * 找到 el 的上一个兄弟块元素。
 *
 * Obsidian 的渲染结构：
 *   div.el-pre                       <- annotation fence 外壳（el.parentElement）
 *     div.block-language-annotation  <- containerEl（el）
 *
 *   div.el-p / div.el-pre    <- 目标块外壳（el.parentElement.previousElementSibling）
 *     p / pre / ...          <- 真正的内容元素
 */
function findPreviousBlock(el: HTMLElement): HTMLElement | null {
	const elPre = el.parentElement
	if (!elPre) return null

	let prevShell = elPre.previousElementSibling as HTMLElement | null

	// 跳过已处理的 annotation-wrapper（连续多个 annotation 块的情况）
	while (prevShell && prevShell.classList.contains('annotation-wrapper')) {
		prevShell = prevShell.previousElementSibling as HTMLElement | null
	}

	if (!prevShell) return null

	// 取外壳里的第一个子元素（el-p 里的 p，el-pre 里的 pre 等）
	return (prevShell.firstElementChild as HTMLElement) ?? prevShell
}

/**
 * 绘制所有箭头：为每条规则在目标块内找到匹配行，
 * 计算 DOMRect 后交给 renderArrows 统一绘制 SVG。
 */

function drawArrows(
	wrapper: HTMLElement,
	targetBlock: HTMLElement,
	labelEls: { el: HTMLElement; rule: AnnotationRule }[]
) {
	const containerRect = wrapper.getBoundingClientRect()
	const targets: ArrowTarget[] = []
	const SAFE_GAP = 10

	for (const { el: labelEl, rule } of labelEls) {
		const labelRect = labelEl.getBoundingClientRect()
		const adjustedLabelRect = new DOMRect(
			labelRect.x + (rule.side === 'left' ? SAFE_GAP : -SAFE_GAP),
			labelRect.y,
			labelRect.width,
			labelRect.height
		)

		let textRect: DOMRect | null = null
		let lineRect: DOMRect
		let highlightType: HighlightType

		let lineEl: HTMLElement | null = null

		if (!rule.match) {
			// 空 match：指向整行，找行元素
			const lineEl = findLineElement(targetBlock)
			if (!lineEl) continue
			lineRect = lineEl.getBoundingClientRect()
			highlightType = 'none'
		} else {
			// 用 Range 精确定位
			const result = findTextRect(targetBlock, rule.match, rule.matchIndex)
			if (!result) continue
			textRect = result.rect

			// lineRect fallback：取文本所在的行容器
			lineEl = findLineElementContaining(targetBlock, result.range)
			lineRect = lineEl ? lineEl.getBoundingClientRect() : textRect

			// 按文本长度分类
			const charLen = rule.match.length
			highlightType = charLen < 12 ? 'circle' : charLen < 80 ? 'wave' : 'none'
		}

		const isInline = labelEl.classList.contains('annotation-label--inline-right')

		// drawArrows 里构建 target 时加上 labelEl
		targets.push({
			labelRect: adjustedLabelRect,
			lineRect,
			lineTag: lineEl?.tagName ?? '',
			textRect,
			side: rule.side,
			containerRect,
			highlightType,
			seed: rule.match + rule.side,
			labelEl: labelEl,
			isInlineRight: isInline,
		})
	}

	renderArrows(wrapper, targets)
}

/** 找 targetBlock 里第一个视觉行元素（line 模式 fallback） */
function findLineElement(block: HTMLElement): HTMLElement | null {
	const LINE_TAGS = [
		'p',
		'li',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'td',
		'th',
		'blockquote',
		// 'code',
	]
	for (const tag of LINE_TAGS) {
		const el = block.querySelector(tag)
		if (el) return el as HTMLElement
	}
	return block
}

/** 找包含 range 起点的最近行级祖先元素 */
function findLineElementContaining(root: HTMLElement, range: Range): HTMLElement | null {
	const LINE_TAGS = new Set([
		'P',
		'LI',
		'H1',
		'H2',
		'H3',
		'H4',
		'H5',
		'H6',
		'TD',
		'TH',
		'BLOCKQUOTE',
		'CODE',
	])
	let node: Node | null = range.startContainer
	while (node && node !== root) {
		if (node.nodeType === Node.ELEMENT_NODE && LINE_TAGS.has((node as Element).tagName)) {
			return node as HTMLElement
		}
		node = node.parentNode
	}
	return null
}

/**
 * 在 block 内找到 textContent 包含 matchText 的第 matchIndex 个元素。
 * 优先返回最深层的元素，使箭头尽可能精确地指向目标文本所在行。
 */
function findMatchingLine(
	block: HTMLElement,
	matchText: string,
	matchIndex: number
): HTMLElement | null {
	const candidates = collectVisualLines(block)

	let count = 0
	for (const el of candidates) {
		if (el.textContent?.includes(matchText)) {
			count++
			if (count === matchIndex) return el
		}
	}

	return null
}

/**
 * 收集 root 内所有"视觉行"元素，按 DOM 深度降序排列（最深优先）。
 * 视觉行定义：特定标签且 textContent 非空的元素。
 */
function collectVisualLines(root: HTMLElement): HTMLElement[] {
	const VISUAL_LINE_TAGS = new Set([
		'p',
		'li',
		'td',
		'th',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'blockquote',
		'code',
		'span',
		'a',
		'strong',
		'em',
	])

	const results: HTMLElement[] = []
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)

	let node = walker.nextNode() as HTMLElement | null
	while (node) {
		const tag = node.tagName.toLowerCase()
		if (VISUAL_LINE_TAGS.has(tag) && node.textContent?.trim()) {
			results.push(node)
		}
		node = walker.nextNode() as HTMLElement | null
	}

	// 深度越深优先级越高，匹配更精确的子元素
	results.sort((a, b) => domDepth(b) - domDepth(a))

	return results
}

function domDepth(el: Element): number {
	let depth = 0
	let cur: Element | null = el
	while (cur) {
		depth++
		cur = cur.parentElement
	}
	return depth
}

function positionInlineLabels(
	wrapper: HTMLElement,
	targetBlock: HTMLElement,
	labelEls: { el: HTMLElement; rule: AnnotationRule }[]
) {
	const INLINE_GAP = 100 // 距代码块文本右边缘的间距
	const wrapperRect = wrapper.getBoundingClientRect()
	const blockRect = targetBlock.getBoundingClientRect()
	// 代码块右边缘相对 wrapper 的 x
	const blockRightLocal = blockRect.right - wrapperRect.left

	for (const { el, rule } of labelEls) {
		if (!el.classList.contains('annotation-label--inline-right')) continue

		// 找目标文本的 y 位置
		let targetY = blockRect.top + blockRect.height / 2 - wrapperRect.top
		let textRight = 0

		if (rule.match) {
			const result = findTextRect(targetBlock, rule.match, rule.matchIndex ?? 1)
			if (result) {
				textRight = result.rect.right - wrapperRect.left
				targetY = result.rect.top + result.rect.height / 2 - wrapperRect.top
			}
		}

		// 如果匹配到文本(没有指定目标字符串)，用代码块右边缘
		if (textRight === 0) {
			// const blockRect = targetBlock.getBoundingClientRect()
			// textRight = blockRect.right - wrapperRect.left
			// targetY = blockRect.top + blockRect.height / 2 - wrapperRect.top
			textRight = blockRect.width
		}

		el.style.position = 'absolute'
		el.style.left = `${textRight + INLINE_GAP}px` // 紧跟文本右边
		el.style.top = `${targetY}px`
		el.style.transform = 'translateY(-50%) rotate(2deg)'
		el.style.pointerEvents = 'auto'
	}
}
