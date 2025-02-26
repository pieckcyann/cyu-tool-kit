/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownView,
	Notice,
	Plugin,
	WorkspaceLeaf,
	WorkspaceRoot,
	WorkspaceSidedock,
	parseFrontMatterEntry,
	parseFrontMatterStringArray,
} from 'obsidian'
import { CyuToolkitSettingTab } from './settings/settingsTab'
import { CyuTookitSettings, DEFAULT_SETTINGS } from 'src/settings/settingsData'
import ClickCopyBlock from './core/ClickCopyBlock'
import renderColorGallery from './core/ColorGallery'
import { parseM3u8Video } from './core/parseVideoSrc'
import ArtGallery from './core/ArtGallery'
import { setTimeout } from 'timers/promises'

export default class CyuToolkitPlugin extends Plugin {
	settings: CyuTookitSettings = DEFAULT_SETTINGS
	eventsRegistered: boolean = false // 记录事件是否已注册
	leftRibbon: HTMLElement | null
	rightRibbon: HTMLElement | null
	middleArea: HTMLElement | null

	async onload() {
		// 加载设置
		await this.loadSettings()
		// 添加设置面板
		this.addSettingTab(new CyuToolkitSettingTab(this.app, this))

		this.app.workspace.onLayoutReady(() => {
			this.leftRibbon = document.querySelector('.side-dock-settings')
			this.rightRibbon = document.querySelector(
				'.workspace-ribbon.side-dock-ribbon.mod-right'
			)
			this.middleArea = document.querySelector('.mod-root')

			if (this.settings.setup_enable_hover_sider) this.hoverToggleSidebars()

			// 注册命令
			this.registerCommands()
		})

		// 运行各种功能函数
		await this.registerEvents()
		/*
		let velocity = 0 // 速度
		let ticking = false

		// 在外部定义smoothScroll，确保它能访问velocity和ticking
		const smoothScroll = () => {
			if (Math.abs(velocity) < 0.1) {
				ticking = false
				return // 速度太小停止滚动
			}

			// 更细腻的滚动
			document.documentElement.scrollBy(0, velocity)

			// 加强惯性效果，使得每次更新更细腻
			velocity *= 0.95 // 增大惯性，降低衰减系数

			requestAnimationFrame(smoothScroll) // 更高频率调用动画帧
		}

		// 注册滚轮事件
		this.registerDomEvent(
			document,
			'wheel',
			(event) => {
				if (event.ctrlKey) return // 防止缩放

				// 触发条件和滚动速度更灵敏
				const shouldPreventDefault = Math.abs(event.deltaY) > 5

				if (shouldPreventDefault) {
					event.preventDefault() // 禁止默认滚动

					// 增加更小的滚动步长，增加帧数
					velocity += event.deltaY * 0.02 // 每次滚动步长更小，增加帧数

					if (!ticking) {
						ticking = true
						requestAnimationFrame(smoothScroll) // 增强动画帧频率
					}
				}
			},
			{ passive: true }
		)
		*/
	}

	registerEvents = async () => {
		// click-copy block
		this.renderClickCopyBlock()

		// render pages
		this.renderColorGallery()
		this.renderArtGallery()

		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				// Add a layer of outer <span> for a separate <img> for a network image
				const isNeedUpdateExternalImageTags = !(parseFrontMatterEntry(
					ctx.frontmatter,
					'ignore-modify-external-image'
				) as boolean)
				// new Notice(`${isNeedUpdateExternalImageTags}`)
				if (isNeedUpdateExternalImageTags) this.altExternalImageTags(el)

				// parse .m3u8 to .mp4
				if (this.settings.enable_parse_m3u8) parseM3u8Video(el)

				// remove the iframe scroll bar
				// this.removeIframeScrollbars(el)

				this.addDropShadow(el)
			}
		)
		// auto pin notes
		this.autoPinned()

		// this.registerEvent(
		// 	this.app.metadataCache.on('changed', () => { })
		// 	this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {})
		// )
	}

	// 渲染点击复制块
	renderClickCopyBlock = () => {
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				ctx.addChild(new ClickCopyBlock(this.settings, el))
			}
		)
	}

	// 渲染艺术画廊
	renderArtGallery = () => {
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const cssclasses = parseFrontMatterStringArray(
					ctx.frontmatter,
					'cssclasses',
					true
				)
				const isArtGallery =
					Array.isArray(cssclasses) && cssclasses.includes('r34-profile')

				if (isArtGallery) {
					ctx.addChild(new ArtGallery(this.settings, el))
				}
			}
		)
	}

	// 渲染颜色库
	renderColorGallery() {
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const activeLeafView = this.app.workspace.getActiveViewOfType(MarkdownView)
				const isColorGallery = ctx.sourcePath === this.settings.folder_color_galler

				if (activeLeafView && isColorGallery) {
					ctx.addChild(new renderColorGallery(this.settings, el))
				}
			}
		)
	}

	// 自动固定所有笔记
	autoPinned() {
		const enable_auto_pin = this.settings.enable_auto_pin
		if (!enable_auto_pin) return

		// 获取工作区中的所有笔记页面
		const allLeaves = this.app.workspace.getLeavesOfType('markdown')

		// 为每个笔记页面设置 pinned 状态
		allLeaves.forEach((leaf) => {
			if (!leaf.getViewState().pinned) {
				leaf.setPinned(true)
			}
		})
	}

	// 为外部图片添加 span
	altExternalImageTags(container: HTMLElement): void {
		const imgs = container.findAll('img[referrerpolicy]') as HTMLImageElement[]
		for (const img of imgs) {
			if (img.classList.contains('banner-image')) return // 避免影响 banners 插件
			if (img.parentNode instanceof HTMLSpanElement) return // 检查是否有了 span

			// 创建
			const span = document.createElement('span')
			// const imgWid = img.width.toString()
			const imgSrc = img.getAttribute('src')
			const imgAlt = img.alt

			// if (imgWid) span.setAttribute('width', imgWid)
			if (imgSrc) span.setAttribute('src', imgSrc)
			if (imgAlt) span.setAttribute('alt', imgAlt.split('|')[1] || imgAlt)

			span.setAttribute('id', 'external-link-image')
			span.classList.add('image-embed')
			// ArtGallery.identifyUnhostedImages(span, img)

			// 插入
			img.parentNode?.insertBefore(span, img)
			span.appendChild(img)
		}

		// 为外部视频添加 span
		/*
		const sources = container.findAll('source') as HTMLSourceElement[]
		for (const source of sources) {
			if (!source.src) return
			// 创建
			const span = document.createElement('span')
			span.setAttribute('id', 'span-video')

			const video = source.parentElement as HTMLVideoElement
			// ArtGallery.identifyUnhostedVideos(span, source)

			// 插入
			video.parentNode?.insertBefore(span, video)
			span.appendChild(video)
		}
		*/
	}

	// 移除 iframe 滚动条
	removeIframeScrollbars(container: HTMLElement): void {
		const iframes: NodeListOf<HTMLIFrameElement> = container.querySelectorAll('iframe')

		iframes.forEach((iframe: HTMLIFrameElement) => {
			iframe.setAttribute('scrolling', 'no')
		})
	}

	// Admonitions & Callouts
	// Add Drop Shadow
	// A drop shadow will be added to admonitions.
	addDropShadow(container: HTMLElement): void {
		const callouts: NodeListOf<HTMLDivElement> = container.querySelectorAll('.callout')
		if (!callouts) return

		callouts.forEach((callout: HTMLIFrameElement) => {
			if (!callout.classList.contains('drop-shadow')) {
				callout.classList.add('drop-shadow')
			}
		})
	}

	// 源码模式下排序列表
	sortHeadings() {
		const vault = this.app.vault
		const file = this.app.workspace.getActiveFile()
		if (!file) return

		return vault.process(file, (data) => {
			let h1Count = 0 // 记录一级标题的数量
			let h2Count = 0 // 记录当前 H1 下的 H2 序号
			const h2Numbers = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.']
			const h3Numbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
			let h3Counters: number[] = new Array(10).fill(0)
			let curH2Index = -1
			let insideCodeBlock = false // 标记是否在代码块内

			// 清理标题
			const cleanHeading = (line: string) => {
				const h3Regex = /[①②③④⑤⑥⑦⑧⑨⑩]/g
				const h3Regex2 = /[①②③④⑤⑥⑦⑧⑨⑩] /g
				return line
					.replace(/^(#|##|###) (\[\[.*?\|)\d{1,2}\.\s+/u, '$1 $2') // `# [[笔记名称|3. 标题]]`
					.replace(/^(#|##|###) (\[\[.*?)\d{1,2}\.\s+/u, '$1 $2') // `# [[3. 标题]]`
					.replace(/^(#|##|###) (\[)\d{1,2}\.\s+/u, '$1 $2') // `# [3. 标题](链接文本)`
					.replace(/^(#|##|###) \d{1,2}\.\s+/u, '$1 ') // `# 3. 标题`
					.replace(h3Regex2, '') // 这两个的顺序不能改变
					.replace(h3Regex, '')
			}

			const testAndReplace = (level: number, pattern: RegExp, text: string) => {
				return text.replace(
					pattern,
					(_, prefix, title) =>
						`${level === 2 ? '##' : '###'} ${prefix || ''}${
							level === 2 ? h2Numbers[h2Count++] : h3Numbers[h3Counters[curH2Index]++]
						} ${title}`
				)
			}

			const lines = data.split('\n')
			// 遍历每一行
			for (let i = 0; i < lines.length; i++) {
				lines[i]
				if (/^```/.test(lines[i])) {
					insideCodeBlock = !insideCodeBlock // 切换代码块状态
					continue
				}
				if (insideCodeBlock) continue // 跳过代码块中的所有内容

				lines[i] = cleanHeading(lines[i])

				// 处理一级标题 `#`
				if (/^# (\[\[.*?\|)?(.*?)]?$/.test(lines[i])) {
					h1Count++
					h2Count = 0 // 遇到新的 H1，H2 计数清零
				}

				// 处理二级标题 `##`
				if (/^## /.test(lines[i]) && h2Count < 10) {
					curH2Index = h2Count
					h3Counters[curH2Index] = 0 // 重置 h3 计数

					if (/[✦★☆✧]/.test(lines[i])) continue

					lines[i] = testAndReplace(2, /^## (?!\[\[)(\[)?(.*?)]?$/, lines[i]) // `# 标题`、`# [标题](链接文本)`
					lines[i] = testAndReplace(2, /^## (\[\[)([^\|]+)$/, lines[i]) // `# [[标题]]`(不带 `|` 的)
					lines[i] = testAndReplace(2, /^## (\[\[.*?\|)(.*?)?$/, lines[i]) // `# [[笔记名称|标题]]` (带 `|` 的)
				}

				// 处理三级标题 `###`
				if (/^### /.test(lines[i]) && curH2Index !== -1) {
					if (/[✦★☆✧]/.test(lines[i])) continue

					if (h3Counters[curH2Index] < 10) {
						lines[i] = testAndReplace(3, /^### (?!\[\[)(\[)?(.*?)]?$/, lines[i])
						lines[i] = testAndReplace(3, /^### (\[\[)([^\|]+)$/, lines[i])
						lines[i] = testAndReplace(3, /^### (\[\[.*?\|)(.*?)?$/, lines[i])
					}
				}
			}

			return lines.join('\n')
		})
	}

	onunload() {}

	hoverToggleSidebars() {
		if (this.leftRibbon && this.middleArea && this.rightRibbon) {
			// 左侧展开/收缩逻辑
			this.leftRibbon.addEventListener('mouseenter', this.toggleLeftSidebar)

			// 中间区域展开/收缩逻辑
			this.middleArea.addEventListener('mouseenter', this.toggleMiddleSidebar)

			// 右侧展开/收缩逻辑
			this.rightRibbon.addEventListener('mouseenter', this.toggleRightSidebar)
		}
	}

	clickToggleSidebars() {
		if (this.leftRibbon && this.middleArea && this.rightRibbon) {
			// 左侧展开/收缩逻辑
			this.leftRibbon.addEventListener('click', this.toggleLeftSidebar)

			// 中间区域展开/收缩逻辑
			this.middleArea.addEventListener('click', this.toggleMiddleSidebar)

			// 右侧展开/收缩逻辑
			this.rightRibbon.addEventListener('click', this.toggleRightSidebar)
		}
	}

	removeHoverToggleSidebars() {
		if (this.leftRibbon && this.middleArea && this.rightRibbon) {
			this.leftRibbon.removeEventListener('mouseenter', this.toggleLeftSidebar)
			this.middleArea.removeEventListener('mouseenter', this.toggleMiddleSidebar)
			this.rightRibbon.removeEventListener('mouseenter', this.toggleRightSidebar)
		}
	}

	removeClickToggleSidebars() {
		if (this.leftRibbon && this.middleArea && this.rightRibbon) {
			this.leftRibbon.removeEventListener('click', this.toggleLeftSidebar)
			this.middleArea.removeEventListener('click', this.toggleMiddleSidebar)
			this.rightRibbon.removeEventListener('click', this.toggleRightSidebar)
		}
	}

	toggleLeftSidebar = () => {
		const isLeftCollapsed = this.app.workspace.leftSplit.collapsed
		if (isLeftCollapsed) {
			this.app.workspace.leftSplit.toggle()
		}
	}

	toggleMiddleSidebar = () => {
		window.setTimeout(() => {
			const isLeftCollapsed = this.app.workspace.leftSplit.collapsed
			if (!isLeftCollapsed) {
				this.app.workspace.leftSplit.toggle()
			}

			const isRightCollapsed = this.app.workspace.rightSplit.collapsed
			if (!isRightCollapsed) {
				this.app.workspace.rightSplit.toggle()
			}
		}, 200)
	}

	toggleRightSidebar = () => {
		const isRightCollapsed = this.app.workspace.rightSplit.collapsed
		if (isRightCollapsed) {
			this.app.workspace.rightSplit.toggle()
		}
	}

	registerCommands() {
		this.addCommand({
			id: 'hover-toggle-sidebars-toggle',
			name: 'hover toggle sidebars toggle',
			hotkeys: [{ modifiers: ['Ctrl', 'Alt'], key: 'W' }],
			callback: () => {
				if (!this.eventsRegistered) {
					this.removeHoverToggleSidebars()
					this.clickToggleSidebars()
					new Notice('已改为 “点击触发”')
				} else {
					this.removeClickToggleSidebars()
					this.hoverToggleSidebars()
					new Notice('已改为 “悬浮触发”')
				}
				this.eventsRegistered = !this.eventsRegistered // 切换状态
			},
		})

		this.addCommand({
			id: 'auto-pin-note',
			name: 'auto pin all notes',
			callback: () => {
				this.autoPinned()
			},
		})

		this.addCommand({
			id: 'add-word-comment-in-source',
			name: '源码模式下排序列表',
			hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'Q' }],
			editorCallback: (_editor: Editor, _markdownView: MarkdownView) => {
				this.sortHeadings()
			},
		})
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		this.saveData(this.settings)
	}
}
