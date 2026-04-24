import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownRenderer,
	Notice,
} from 'obsidian'
import { parseAnnotationBlock, AnnotationRule } from './parser'
import { renderArrows, ArrowTarget } from './renderer'
import CyuToolkitPlugin from '../../main'

// ─── CSS 样式（只注入一次）────────────────────────────────────────────────────

// const STYLE_ID = 'cyu-annotation-styles'
//
// export function injectAnnotationStyles() {
// 	if (document.getElementById(STYLE_ID)) return
//
// 	const style = document.createElement('style')
// 	style.id = STYLE_ID
// 	style.textContent = `
// 		/* ── 外层 wrapper：相对定位，不改变原有元素的尺寸和流 ── */
// 		.annotation-wrapper {
// 			position: relative;
// 		}
//
// 		/* ── 注释列：绝对定位浮在文档两侧，不占文档流空间 ─────── */
// 		.annotation-col {
// 			position: absolute;
// 			top: 0;
// 			width: var(--annotation-col-width, 140px);
// 			display: flex;
// 			flex-direction: column;
// 			gap: 8px;
// 			pointer-events: none;
// 		}
//
// 		.annotation-col--left {
// 			/* 向左偏移，留出 gap */
// 			right: calc(100% + var(--annotation-gap, 12px));
// 		}
//
// 		.annotation-col--right {
// 			/* 向右偏移，留出 gap */
// 			left: calc(100% + var(--annotation-gap, 12px));
// 		}
//
// 		/* ── 注释标签 ──────────────────────────────────────────── */
// 		.annotation-label {
// 			font-size: var(--annotation-font-size, 0.82em);
// 			line-height: 1.4;
// 			color: var(--annotation-text-color, var(--text-muted));
// 			font-family: var(--annotation-font-family, var(--font-text));
// 			font-style: italic;
// 			padding: 2px 4px;
// 			pointer-events: auto;
// 		}
//
// 		.annotation-col--left  .annotation-label { text-align: right; }
// 		.annotation-col--right .annotation-label { text-align: left;  }
//
// 		/* ── SVG 箭头层 ────────────────────────────────────────── */
// 		.annotation-svg-overlay {
// 			position: absolute;
// 			top: 0;
// 			left: 0;
// 			pointer-events: none;
// 			overflow: visible;
// 			z-index: 10;
// 		}
// 	`
// 	document.head.appendChild(style)
// }

// ─── MarkdownRenderChild ──────────────────────────────────────────────────────

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
	/** 套在目标块外的 wrapper，onunload 时移除 */
	private wrapper: HTMLElement | null = null
	/** 被移入 wrapper 的目标块，onunload 时还原 */
	private targetBlock: HTMLElement | null = null

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

	// ─── 构建布局 ──────────────────────────────────────────────────────────────

	private buildLayout(targetBlock: HTMLElement, rules: AnnotationRule[]) {
		const leftRules = rules.filter((r) => r.side === 'left')
		const rightRules = rules.filter((r) => r.side === 'right')

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

		if (rightRules.length > 0) {
			const rightCol = this.createCol('right', rightRules, labelEls)
			wrapper.appendChild(rightCol)
		}

		// 等两帧确保 DOM 已绘制，DOMRect 才准确
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				drawArrows(wrapper, targetBlock, labelEls)
			})
		})

		// 容器尺寸变化时重绘（侧栏拖拽、窗口缩放等）
		this.ro = new ResizeObserver(() => {
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
			const label = this.createLabel(rule.label)
			col.appendChild(label)
			labelEls.push({ el: label, rule })
		}

		return col
	}

	// ─── 渲染 inline markdown 标签 ────────────────────────────────────────────

	private createLabel(markdownText: string): HTMLElement {
		const el = document.createElement('div')
		el.classList.add('annotation-label')

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

// ─── 注册入口 ─────────────────────────────────────────────────────────────────

/**
 * 在插件 onload 里调用，注册 annotation 代码块处理器。
 *
 * 用法：
 *   registerAnnotationProcessor(this)
 */
export function registerAnnotationProcessor(plugin: CyuToolkitPlugin) {
	// injectAnnotationStyles()

	plugin.registerMarkdownCodeBlockProcessor(
		'annotation',
		(src, el, ctx) => {
			ctx.addChild(new AnnotationChild(plugin.app, el, src, ctx))
		},
		// 优先级设低一点，确保目标块已经渲染完毕
		100
		// 0
	)
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
	const arrows: { target: ArrowTarget; seed: string }[] = []
	const SAFE_GAP = 10

	for (const { el: labelEl, rule } of labelEls) {
		const lineEl = findMatchingLine(targetBlock, rule.match, rule.matchIndex)
		if (!lineEl) continue

		const lineRect = lineEl.getBoundingClientRect()
		const labelRect = labelEl.getBoundingClientRect()

		// 强制外扩，避免贴边
		const adjustedLabelRect = new DOMRect(
			labelRect.x + (rule.side === 'left' ? SAFE_GAP : -SAFE_GAP),
			labelRect.y,
			labelRect.width,
			labelRect.height
		)

		arrows.push({
			target: {
				labelRect: adjustedLabelRect,
				lineRect,
				side: rule.side,
				containerRect,
			},
			seed: rule.match + rule.side,
		})
	}

	renderArrows(wrapper, arrows)
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
