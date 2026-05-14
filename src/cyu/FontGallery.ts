import {
	App,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	TFile,
} from 'obsidian'
import { CyuTookitSettings } from '../setting/SettingData'

export default class FontGallery extends MarkdownRenderChild {
	private ctx: MarkdownPostProcessorContext
	// 注意：把 preIndex 放在类外部或者作为一个静态变量/插件全局变量
	// 因为每个块都会 new 一个 FontGallery，实例内的 preIndex 永远是 0

	constructor(
		public app: App, // 需要传入 app 来访问 metadataCache
		public settings: CyuTookitSettings,
		public renderedDiv: HTMLElement,
		public context: MarkdownPostProcessorContext
	) {
		super(renderedDiv)
		this.ctx = context
	}

	onload() {
		this.renderFontGallery()
	}

	async renderFontGallery() {
		const enText = 'The quick brown fox jumps over the lazy dog. 1234567890.'
		const zhText = '落霞与孤鹜齐飞，秋水共长天一色。'
		const symbolText = '✅❌🚀🍘!@#$%^&*()_+-=[]{}|;\':",./<>?`~'

		const sectionInfo = this.ctx.getSectionInfo(this.containerEl)
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) return

		const cache = this.app.metadataCache.getFileCache(activeFile)
		// const fontNames =
		// 	cache?.headings?.filter((h) => h.level === 3).map((h) => h.heading) || []

		// 1. 处理 H3
		// const h3 = this.containerEl.querySelector('h3')
		// if (h3) {
		// 	const fontName = h3.textContent?.trim() ?? ''
		// 	const isInstalled = this.isFontInstalled(fontName)
		// 	if (!isInstalled) {
		// 		h3.style.color = 'var(--text-muted)'
		// 		h3.style.textDecoration = 'line-through'
		// 	}
		// 	h3.style.cursor = 'pointer'
		// 	this.registerDomEvent(h3, 'click', () => {
		// 		navigator.clipboard.writeText(fontName)
		// 		new Notice(`已复制字体：${fontName}`)
		// 	})
		// 	return
		// }

		// 2. 处理 PRE
		const pre = this.containerEl.querySelector('pre')
		if (pre && !pre.classList.contains('frontmatter')) {
			// const currentFont = fontNames[FontGallery.globalPreIndex]
			const currentFont = this.getHeadingAbove()
			if (!currentFont) return

			// 如果系统未安装，尝试加载本地文件
			if (!this.isFontInstalled(currentFont)) {
				const filePath = pre.innerText.trim()

				await this.applyLocalFont(currentFont, filePath)
				// this.applyLocalFont('得意黑', 'smiley-sans-v2.0.1\\SmileySans-Oblique.otf')

				// 给浏览器一点喘息时间，确保 @font-face 生效
				await document.fonts.load(`72px "${currentFont}"`)
			}

			// 再次确认加载后再进行后续逻辑
			const isReady = await this.isFontReallyLoaded(currentFont)

			if (!isReady) {
				new Notice('isReady error！')
				return
			}

			// 检测字体对中英文的支持情况
			const support = this.checkFontSupport(currentFont)

			// 动态构建预览文本
			let finalPreview = ''
			if (support.en) finalPreview += enText + '\n'
			// if (support.zh) finalPreview += zhText + '\n'
			if (support.zh) finalPreview += zhText + '\n'
			if (!support.en && !support.zh) {
				finalPreview = `[字体 "${currentFont}" 无法加载或不支持中英文]\n`
			} else {
				finalPreview += symbolText
				finalPreview +=
					'\n\nTest 测试123中文ABC汉字abg(xyz)(w/o)（国果） This is a sample text. 这是·测试文本。①②⑨ 한국어 あさひ・テレビ／骨曜将葛，地玄系、片海示。'
			}

			pre.setText(finalPreview)
			// pre.style.fontFamily = `"${currentFont}", monospace`
			pre.style.fontFamily = `"${currentFont}"`
			// pre.style.setProperty('--font-monospace', `"${currentFont}"`)
			pre.style.whiteSpace = 'pre-wrap'
			pre.style.padding = '15px'
			pre.style.border = '1px solid var(--background-modifier-border)'
			pre.style.borderRadius = '8px'
			pre.style.backgroundColor = 'var(--background-secondary)'
		}

		// 4. 处理行内 span.cpb
		// const fontCodes = this.containerEl.querySelectorAll<HTMLSpanElement>('span.cpb')
		// fontCodes.forEach((fontCode) => {
		// 	const fontName = fontCode.textContent?.trim() ?? ''
		// 	if (!fontName) return
		// 	const preview = createDiv({
		// 		cls: 'font-preview-area',
		// 		text: previewText,
		// 	})
		// 	fontCode.insertAdjacentElement('afterend', preview)
		// 	// preview.style.fontFamily = `"${fontName}"`
		// 	fontCode.style.setProperty('--font-monospace', fontName)
		// 	preview.style.whiteSpace = 'pre-wrap'
		// 	preview.style.padding = '15px'
		// 	preview.style.border = '1px solid var(--background-modifier-border)'
		// 	preview.style.borderRadius = '8px'
		// 	preview.style.backgroundColor = 'var(--background-secondary)'
		// })
	}

	// 改进后的检测方法
	async isFontReallyLoaded(fontName: string): Promise<boolean> {
		// 1. 先确保字体已经下载并加载完成
		await document.fonts.ready

		// 2. 使用浏览器原生方法检测该字体是否在渲染上下文中可用
		// 注意：check 的参数是 CSS font 字符串
		return document.fonts.check(`12px "${fontName}"`)
	}

	/**
	 * 获取当前块上方紧邻的标题文本
	 */
	private getHeadingAbove(): string | null {
		const sectionInfo = this.ctx.getSectionInfo(this.containerEl)
		if (!sectionInfo) return null

		const startLine = sectionInfo.lineStart
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) return null

		const cache = this.app.metadataCache.getFileCache(activeFile)
		const headings = cache?.headings || []

		// 找所有在当前块之上的标题
		// 只保留 H3，并且在当前块之上
		const candidates = headings.filter(
			(h) => h.level === 3 && h.position.end.line < startLine
		)

		if (candidates.length === 0) return null

		// 取“最近的一个”（line 最大）
		const nearest = candidates.reduce((prev, curr) =>
			curr.position.end.line > prev.position.end.line ? curr : prev
		)

		return nearest.heading
	}

	/**
	 * 精确检测字体对中英文的支持
	 * 检测字形差异： 同一个中文字符，被目标字体渲染 vs 被系统 fallback 渲染，字形的垂直度量（ascent/descent）会有差异，比宽度更敏感
	 */
	checkFontSupport(fontName: string): { zh: boolean; en: boolean } {
		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')
		if (!ctx) return { zh: false, en: false }

		const fontSize = 72

		const measureMetrics = (text: string, font: string) => {
			ctx.font = `${fontSize}px ${font}`
			const m = ctx.measureText(text)
			return {
				width: m.width,
				ascent: m.actualBoundingBoxAscent,
				descent: m.actualBoundingBoxDescent,
			}
		}

		const checkSupport = (testStr: string, isZh: boolean): boolean => {
			// 用一个私有区字符校准：target 字体和 fallback 字体在此字符上应该表现一致
			// （都走系统 fallback），这样我们就能"归一化"掉系统 fallback 的影响

			const fallbackFont = 'sans-serif'

			const baseMetrics = measureMetrics(testStr, fallbackFont)
			const targetMetrics = measureMetrics(testStr, `"${fontName}", ${fallbackFont}`)

			const widthDiff = Math.abs(targetMetrics.width - baseMetrics.width)
			const ascentDiff = Math.abs(targetMetrics.ascent - baseMetrics.ascent)
			const descentDiff = Math.abs(targetMetrics.descent - baseMetrics.descent)

			if (isZh) {
				// 中文：宽度几乎必然一样（全角等宽），靠 ascent/descent 区分字形
				return ascentDiff > 0.5 || descentDiff > 0.5
			} else {
				// 英文：宽度差异足够可靠
				return widthDiff > 1
			}
		}

		return {
			en: checkSupport('miwI', false),
			zh: checkSupport('测试文本服乙', true),
		}
	}
	// 	checkFontSupport(fontName: string): { zh: boolean; en: boolean } {
	// 		// 已经在 isFontReallyLoaded 里 await fonts.ready，这里同步 check 即可
	// 		const enChars = 'ABCDEFGabcdefg'
	// 		const zhChars = '测试文字'
	//
	// 		const enLoaded = document.fonts.check(`72px "${fontName}"`, enChars)
	// 		const zhLoaded = document.fonts.check(`72px "${fontName}"`, zhChars)
	//
	// 		return { en: enLoaded, zh: zhLoaded }
	// 	}

	isFontInstalled(fontName: string): boolean {
		const support = this.checkFontSupport(fontName)
		return support.en || support.zh
	}

	async applyLocalFont(
		fontName: string,
		filePath: string,
		targetEl: HTMLElement | undefined = undefined
	) {
		if (!fontName || !filePath) return
		// console.log('==============================')
		// console.log('fontName:', fontName)
		// console.log('filePath:', filePath)

		const fullPath = `Attachment/fonts/${filePath}`.replace('\\', '/')
		// console.log('fullPath:', fullPath)

		// filePath 是库内路径，例如 "attachments/myfont.woff2"
		const file = this.app.vault.getAbstractFileByPath(fullPath)

		// console.log('file:', file)
		// console.log('==============================')

		if (file instanceof TFile) {
			// 转换成类似 app://... 的内部路径
			const resourcePath = this.app.vault.adapter.getResourcePath(file.path)
			const styleId = `font-load-${fontName.replace(/\s+/g, '-')}`

			// 动态注入样式
			if (!document.getElementById(styleId)) {
				const style = document.createElement('style')
				style.id = styleId
				style.textContent = `
                @font-face {
                    font-family: '${fontName}';
                    src: url('${resourcePath}');
                }
            `
				document.head.appendChild(style)

				// 给浏览器一点点时间解析字体
				await new Promise((resolve) => setTimeout(resolve, 50))
			}

			// 应用到元素
			if (targetEl) targetEl.style.fontFamily = `"${fontName}"`
		}
	}
}
