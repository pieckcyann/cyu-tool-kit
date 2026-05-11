// Annotation.ts
import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	MarkdownRenderer,
	Notice,
} from 'obsidian'
import { parseAnnotationBlock, AnnotationRule, AnnotationSide } from './annParser'
import { renderArrows, ArrowTarget, HighlightType } from './annRenderer'
import CyuToolkitPlugin from '../../main'
import {
	findImageRect,
	findLineEndRect,
	findLineEndRectByText,
	findLineStartRect,
	findLineStartRectByText,
	findTextRect,
} from './annRanger'
import { showRectIndicator } from '../../util/cyuUtil'

const InlineRightClassName = 'annotation-label--inline-right'
const InlineLeftClassName = 'annotation-label--inline-left'

export type LabelElementInfos = {
	el: HTMLElement
	rule: AnnotationRule
}[]

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
	private prevEl: HTMLElement | null // 直接传入，不再查找

	constructor(
		app: App,
		containerEl: HTMLElement,
		src: string,
		ctx: MarkdownPostProcessorContext,
		prevEl: HTMLElement | null // 上一个目标元素块
	) {
		super(containerEl)
		this.app = app
		this.src = src
		this.ctx = ctx
		this.prevEl = prevEl
	}

	onload() {
		// new Notice('加载')
		// console.log('prevEl:', this.prevEl)

		// 尝试解析语法，如果符合则获得规则
		const { rules } = parseAnnotationBlock(this.src)
		if (rules.length === 0) {
			this.containerEl.style.display = 'none'
			return
		}

		if (!this.prevEl) {
			this.containerEl.style.display = 'none'
			new Notice('没找到注释目标块')
			return
		}

		// 找目标块 (上一个完整的块)
		// const targetBlock = findPreviousBlock(this.containerEl)
		// if (!targetBlock) {
		// 	this.containerEl.style.display = 'none'
		// 	new Notice('没找到注释目标块')
		// 	return
		// }

		// prevEl 是外壳 el，取第一个子元素才是真正的内容块
		// console.log('this.prevEl:', this.prevEl)
		const targetBlock = (this.prevEl.firstElementChild as HTMLElement) ?? this.prevEl
		// console.log('targetBlock:', targetBlock)
		this.targetBlock = targetBlock
		this.buildLayout(targetBlock, rules)

		// 监听文件变化，目标块更新时重载
		this.registerFileChangeListener()
	}

	private registerFileChangeListener() {
		// editor-change 在每次击键后触发
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, info) => {
				if (info.file?.path !== this.ctx.sourcePath) return
				// new Notice('文件修改，已刷新')
				this.scheduleReload()
				// this.onload()
			})
		)
	}

	private reloadTimer: ReturnType<typeof setTimeout> | null = null

	private scheduleReload() {
		if (this.reloadTimer) clearTimeout(this.reloadTimer)
		this.reloadTimer = setTimeout(() => {
			this.reloadTimer = null
			// reload 时直接传入当前 DOM 里找到的 prevEl
			this.onunload()

			const { rules } = parseAnnotationBlock(this.src)
			if (rules.length === 0) {
				this.containerEl.style.display = 'none'
				return
			}

			// 此时 containerEl 还在 DOM 里，可以直接找兄弟
			const targetBlock = findPreviousBlock(this.containerEl)
			// console.log('targetBlock:', targetBlock)
			if (!targetBlock) {
				this.containerEl.style.display = 'none'
				return
			}

			this.targetBlock = targetBlock
			this.buildLayout(targetBlock, rules)
		}, 500)
	}

	/**
	 * 断开监听、还原 DOM 结构
	 */
	onunload() {
		this.ro?.disconnect()
		this.ro = null // 记得重置为 null

		// 把目标块从 wrapper 里还原到 wrapper 之前，再删除 wrapper
		// 这样下次 onload 时 findPreviousBlock 仍能正确找到目标块
		if (this.wrapper && this.targetBlock) {
			this.wrapper.parentElement?.insertBefore(this.targetBlock, this.wrapper)
			this.wrapper.remove()
			this.wrapper = null
			this.targetBlock = null
		}
	}

	/**
	 * 外部调用的重载方法
	 * @param newSrc 可选：如果注解内容变了，可以传入新的源码
	 */
	public reload(newSrc?: string) {
		if (newSrc !== undefined) {
			this.src = newSrc
		}

		// 1. 执行现有的卸载逻辑
		this.onunload()

		// 2. 重新执行加载逻辑
		this.onload()
	}

	// ─── 构建左中右布局 ──────────────────────────────────────────────────────────────

	private buildLayout(targetBlock: HTMLElement, rules: AnnotationRule[]) {
		const isCodeBlock =
			targetBlock.tagName === 'PRE' ||
			targetBlock.tagName === 'CODE' ||
			targetBlock.querySelector('pre, code')

		const leftBlockAndWholeRules = rules.filter(
			(r) => r.side === 'left' && (r.display === 'block' || r.display === 'whole')
		)
		const rightBlockAndWholeRules = rules.filter(
			(r) => r.side === 'right' && (r.display === 'block' || r.display === 'whole')
		)

		const leftInlineRules = rules.filter(
			(r) => r.side === 'left' && r.display === 'inline'
		)
		const rightInlineRules = rules.filter(
			(r) => r.side === 'right' && r.display === 'inline'
		)

		// const leftWholeRules = rules.filter((r) => r.side === 'left' && r.display === 'whole')
		// const rightWholeRules = rules.filter(
		// 	(r) => r.side === 'right' && r.display === 'whole'
		// )

		/* wrapper 套在目标块外，提供相对定位上下文 */
		const wrapper = document.createElement('div')
		wrapper.classList.add('annotation-wrapper')
		this.wrapper = wrapper
		targetBlock.parentElement!.insertBefore(wrapper, targetBlock)
		wrapper.appendChild(targetBlock)

		// annotation fence 自己不展示
		this.containerEl.style.display = 'none'

		// 渲染标签并记录对应规则，供箭头定位使用
		const labelEls: { el: HTMLElement; rule: AnnotationRule }[] = []

		/* 块级注释：直接创建对应的元素挂载 wrapper 下 */
		if (leftBlockAndWholeRules.length > 0) {
			const leftCol = this.createCol('left', leftBlockAndWholeRules, labelEls)
			wrapper.appendChild(leftCol)
		}

		if (rightBlockAndWholeRules.length > 0) {
			const rightCol = this.createCol('right', rightBlockAndWholeRules, labelEls)
			wrapper.appendChild(rightCol)
		}

		/* 行内注释：先创建好挂到 wrapper，drawArrows 里再定位 */
		for (const rule of rightInlineRules) {
			const labelEl = this.createLabel(rule.label)
			labelEl.classList.add(InlineRightClassName)
			wrapper.appendChild(labelEl)
			labelEls.push({ el: labelEl, rule }) // 注释元素 & 语法规则
		}

		for (const rule of leftInlineRules) {
			const labelEl = this.createLabel(rule.label)
			labelEl.classList.add(InlineLeftClassName)
			wrapper.appendChild(labelEl)
			labelEls.push({ el: labelEl, rule })
		}

		// 已收集完所有的注释块
		// 等两帧确保 DOM 已绘制，DOMRect 才准确
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				// 定位 inline labels
				positionInlineLabels(wrapper, targetBlock, labelEls)
				positionAndDrawArrows(wrapper, targetBlock, labelEls)
			})
		})

		// 容器尺寸变化时重绘 (侧栏拖拽、窗口缩放等)
		this.ro = new ResizeObserver(() => {
			positionInlineLabels(wrapper, targetBlock, labelEls)
			positionAndDrawArrows(wrapper, targetBlock, labelEls)
		})
		this.ro.observe(wrapper)
	}

	// ─── 创建块级注释列 ────────────────────────────────────────────────────────────

	/**
	 * [块级]：创建对应方向的侧列 + 填充对应的注释 (flex 布局包装不重叠)
	 * @param side 方向
	 * @param rules
	 * @param labelEls
	 * @returns
	 */
	private createCol(
		side: AnnotationSide,
		rules: AnnotationRule[],
		labelEls: { el: HTMLElement; rule: AnnotationRule }[]
	): HTMLElement {
		const col = document.createElement('div')
		col.classList.add('annotation-col', `annotation-col--${side}`)

		for (const rule of rules) {
			const labelEl = this.createLabel(rule.label)
			col.appendChild(labelEl)
			labelEls.push({ el: labelEl, rule }) // 注释块元素、语法规则
		}

		return col
	}

	// ─── 渲染注释 + 渲染 markdown 语法 ────────────────────────────────────────────

	/**
	 * 绘制注释块(通用)
	 * @param markdownText 解析出的注释文本
	 * @returns 新创建的注释块
	 */
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
		// long：稍后 renderer 画波浪线
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
 * 异步寻找前一个块，如果没找到会重试指定的次数
 * @param el 当前元素
 * @param retries 重试次数，默认 5 次
 */
// async function findPreviousBlockAsync(
// 	el: HTMLElement,
// 	retries = 0
// ): Promise<HTMLElement | null> {
// 	const elPre = el.parentElement
// 	if (!elPre) return null
//
// 	let prevShell = elPre.previousElementSibling as HTMLElement | null
//
// 	// 跳过已处理的 annotation-wrapper
// 	while (prevShell && prevShell.classList.contains('annotation-wrapper')) {
// 		prevShell = prevShell.previousElementSibling as HTMLElement | null
// 	}
//
// 	if (prevShell) {
// 		// 找到了，直接返回
// 		return (prevShell.firstElementChild as HTMLElement) ?? prevShell
// 	}
//
// 	// 如果没找到且还有重试次数
// 	if (retries > 0) {
// 		// 等待下一帧绘制
// 		await new Promise((resolve) => requestAnimationFrame(resolve))
// 		// 递归重试
// 		return findPreviousBlockAsync(el, retries - 1)
// 	}
//
// 	// 最后再试一次！
// 	window.setTimeout(() => {
// 		findPreviousBlockAsync(el, 0)
// 	}, 500)
//
// 	return null
// }

/**
 * 绘制所有箭头：为每条规则在目标块内找到匹配行，
 * 计算 DOMRect 后交给 renderArrows 统一绘制 SVG
 * 在这里决定箭头位置
 */
function positionAndDrawArrows(
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

		// 测试每个注释的规则
		labelEl.addEventListener('click', () => {
			console.log('rule:', rule)
		})

		let textRect: DOMRect | null = null
		let lineRect: DOMRect
		let highlightType: HighlightType

		let lineEl: HTMLElement | null = null

		if (!rule.match) {
			if (rule.display !== 'whole') {
				// 空 match -> 指向指定行
				const lineIndex = rule.matchIndex ?? 1

				let rect
				if (rule.side === 'right') rect = findLineEndRect(targetBlock, lineIndex)
				else rect = findLineStartRect(targetBlock, lineIndex)
				if (!rect) {
					rect = findImageRect(targetBlock)
					if (!rect) continue
				}

				lineRect = rect
				textRect = null
				highlightType = 'none'
			} else {
				// 整块模式
				let rect
				// 先尝试找图片
				rect = findImageRect(targetBlock)
				if (!rect) {
					// 没找到就用整个块元素
					rect = targetBlock.getBoundingClientRect()
				}

				lineRect = rect
				textRect = null
				highlightType = 'whole'
			}
		} else {
			// 用 Range 精确定位
			const result = findTextRect(targetBlock, rule.match, rule.matchIndex ?? 1)
			if (!result) continue
			textRect = result.rect

			// lineRect fallback：取文本所在的行容器
			lineEl = findLineElementContaining(targetBlock, result.range)
			lineRect = lineEl ? lineEl.getBoundingClientRect() : textRect

			// 按文本长度分类
			const charLen = rule.match.length
			highlightType = charLen < 12 ? 'circle' : charLen < 80 ? 'wave' : 'none'
		}
		console.log('rule:', rule)

		// const isInline = labelEl.classList.contains('annotation-label--inline-right')
		const isInline = rule.display === 'inline'

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
		'IMG', // 支持图片
		'SPAN', // 因为图片包裹在一个 span 中
		// 'SVG', // TODO 新增 mermaid 支持
	])
	let node: Node | null = range.startContainer
	while (node && node !== root) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement
			// 检查是否是基础行标签，或者是带图片类名的 span
			if (LINE_TAGS.has(el.tagName) || el.classList.contains('image-embed')) {
				return el
			}
		}
		node = node.parentNode
	}
	return null
}

/**
 * 调整每个行内注释块的位置
 * @param wrapper 目标块的包装
 * @param targetBlock 目标整块
 * @param labelElInfos 所有注释块信息
 */
function positionInlineLabels(
	wrapper: HTMLElement,
	targetBlock: HTMLElement,
	labelElInfos: LabelElementInfos
) {
	const INLINE_GAP = 50 // 距行内文本的间距
	const MIN_GAP = 20 // 最小垂直间距，防重叠
	const wrapperRect = wrapper.getBoundingClientRect()
	const blockRect = targetBlock.getBoundingClientRect()

	// 分左右处理，分别记录上一条 Y
	const lastYMap: Record<'left' | 'right', number> = {
		left: -Infinity,
		right: -Infinity,
	}

	// 按 targetY 排序可以减少叠加跳跃
	const sortedLabels = labelElInfos
		.filter(
			({ el }) =>
				el.classList.contains(InlineLeftClassName) ||
				el.classList.contains(InlineRightClassName)
		)
		.map(({ el, rule }) => {
			let targetY = 0
			let anchorX = 0
			let found = false

			const isLeft = rule.side === 'left'
			const finalMatchIndex = rule.matchIndex ?? 1 // text or line

			// 1. 文本匹配
			if (rule.match) {
				const rectForX = isLeft
					? findLineStartRectByText(targetBlock, rule.match, finalMatchIndex)
					: findLineEndRectByText(targetBlock, rule.match, finalMatchIndex)
				// ? findLineStartRect(targetBlock, finalMatchIndex)
				// : findLineEndRect(targetBlock, finalMatchIndex)

				const rectForY = findTextRect(targetBlock, rule.match, finalMatchIndex)?.rect

				if (rectForX && rectForY) {
					// anchorX = isLeft ? rectForY.left : rectForY.right
					anchorX = isLeft ? rectForX.left : rectForX.right
					targetY = rectForY.top + rectForY.height / 2
					found = true
				} else {
					// new Notice(`有没匹配到的规则文本:${rule.match}`)
				}
			}

			// 2. 行定位 fallback
			else if (!found) {
				// 先尝试找图片
				let rect = findImageRect(targetBlock)
				if (!rect) {
					rect = isLeft
						? findLineStartRect(targetBlock, finalMatchIndex)
						: findLineEndRect(targetBlock, finalMatchIndex)
				}

				if (rect) {
					anchorX = isLeft ? rect.left : rect.right
					targetY = rect.top + rect.height / 2
					found = true
				}
			}

			return { el, rule, targetY, anchorX, isLeft }
		})
		.sort((a, b) => a.targetY - b.targetY) // 上到下排序

	for (const info of sortedLabels) {
		const { el, rule, isLeft } = info

		// 防重叠
		if (info.targetY - lastYMap[isLeft ? 'left' : 'right'] < MIN_GAP) {
			info.targetY = lastYMap[isLeft ? 'left' : 'right'] + MIN_GAP
		}
		lastYMap[isLeft ? 'left' : 'right'] = info.targetY

		const relativeX = info.anchorX - wrapperRect.left
		const relativeY = info.targetY - wrapperRect.top

		el.style.position = 'absolute'
		el.style.top = `${relativeY}px`
		el.style.transform = 'translateY(-50%) rotate(2deg)'

		if (isLeft) {
			el.style.left = 'auto'
			el.style.right = `${wrapperRect.width - relativeX + INLINE_GAP}px`
		} else {
			el.style.right = 'auto'
			el.style.left = `${relativeX + INLINE_GAP}px`
		}
		// el.style.backgroundColor = 'cyan' // 行内注释
	}
}
