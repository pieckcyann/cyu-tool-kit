import { MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from 'obsidian'

export class TimeTagChild extends MarkdownRenderChild {
	private ctx: MarkdownPostProcessorContext
	// 增加标识符，方便 layout-change 时寻找
	public isTimeTag = true
	private originalHTML: string

	constructor(containerEl: HTMLElement, context: MarkdownPostProcessorContext) {
		super(containerEl)
		// 记录原始 HTML，方便 reload 时重置
		this.originalHTML = containerEl.innerHTML
		this.ctx = context
	}

	onload() {
		this.process()
	}

	public reload() {
		// 重置回原始状态，防止重复嵌套标签
		this.containerEl.innerHTML = this.originalHTML
		this.process()
	}

	private process() {
		const regex = /@\{(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2}:\d{2})?)\}/g
		const walker = document.createTreeWalker(this.containerEl, NodeFilter.SHOW_TEXT, null)

		let textNode: Text
		const matches: { range: Range; timestamp: string }[] = []

		while ((textNode = walker.nextNode() as Text)) {
			const text = textNode.nodeValue || ''
			let match
			regex.lastIndex = 0
			while ((match = regex.exec(text)) !== null) {
				const range = document.createRange()
				range.setStart(textNode, match.index)
				range.setEnd(textNode, match.index + match[0].length)
				matches.push({ range, timestamp: match[1] })
			}
		}

		// 倒序替换
		for (let i = matches.length - 1; i >= 0; i--) {
			const { range, timestamp } = matches[i]
			const container = document.createElement('span')
			range.deleteContents()
			range.insertNode(container)
			this.renderTimeTag(container, timestamp)
		}
	}
	private renderTimeTag(tagSpan: HTMLElement, timestamp: string) {
		const baseClassName = 'ctk-time-tag'
		tagSpan.addClass(baseClassName)

		// 1. 判断是否紧跟标题 (通过 Metadata)
		const headingLevel = this.getHeadingLevelAbove()

		// 2. 判断是否在 Callout 标题中 (通过 DOM)
		const isCalloutTitle = tagSpan.closest('.callout-title-inner') !== null

		tagSpan.addClass(baseClassName)

		if (headingLevel !== null) {
			const divElP = tagSpan.parentElement!!.parentElement!!
			divElP.addClass('after-heading')

			tagSpan.addClass(`${baseClassName}--after-heading`)
			tagSpan.addClass(`${baseClassName}--h${headingLevel}`)
		} else if (isCalloutTitle) {
			tagSpan.addClass(`${baseClassName}--in-callout`)
		} else {
			tagSpan.addClass(`${baseClassName}--generic`)
		}

		// 渲染 HTML 内容
		tagSpan.innerHTML = `
        <span class="ctk-time-icon">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        </span>
        <span class="ctk-time-text">${timestamp}</span>
    `
	}

	/**
	 * 获取当前内容块上方的标题等级，如果不紧跟标题则返回 null
	 */
	private getHeadingLevelAbove(): number | null {
		// 获取当前块的行号信息
		const sectionInfo = this.ctx.getSectionInfo(this.containerEl)
		if (!sectionInfo) return null

		const startLine = sectionInfo.lineStart
		const activeFile = app.workspace.getActiveFile()
		if (!activeFile) return null 

		// 从缓存读取标题
		const cache = app.metadataCache.getFileCache(activeFile)
		const headings = cache?.headings || []

		// 寻找结束行正好是当前块起始行前一行的标题
		// 注意：Obsidian 的 lineStart 是从 0 开始的
		const prevLine = startLine - 1
		const targetHeading = headings.find((h) => h.position.end.line === prevLine)

		return targetHeading ? targetHeading.level : null
	}
}
