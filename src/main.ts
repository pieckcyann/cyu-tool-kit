/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	WorkspaceRoot,
	WorkspaceSidedock,
	parseFrontMatterEntry,
	parseFrontMatterStringArray,
} from 'obsidian'
import { CyuToolkitSettingTab } from './setting/settingsTab'
import { CyuTookitSettings, DEFAULT_SETTINGS } from 'src/settings/settingsData'
import ClickCopyBlock from './core/ClickCopyBlock'
import renderColorGallery from './core/ColorGallery'
import renderIconGallery from './core/IconGallery'
import { parseM3u8Video } from './core/parseVideoSrc'
import ArtGallery from './core/ArtGallery'
import { setTimeout } from 'timers/promises'

export default class CyuToolkitPlugin extends Plugin {
	settings: CyuTookitSettings = DEFAULT_SETTINGS
	eventsRegistered: boolean = !this.settings.setup_enable_hover_sider // 记录事件是否已注册
	toggleMode: number = 0 // 初始化状态为0（hover）
	leftRibbon: HTMLElement | null
	rightRibbon: HTMLElement | null
	middleArea: HTMLElement | null

	audioCache = new Map<string, HTMLAudioElement>() // 用来缓存音频文件

	// private lenis?: Lenis

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
			// else this.clickToggleSidebars()

			// 注册命令
			this.registerCommands()
		})

		// 运行各种功能函数
		this.registerEvents()

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
		this.renderGallerys()
		// this.renderArtGallery()

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

				// click to pronunciation
				this.setupSpeakerClickEvent(el)

				// remove the iframe scroll bar
				// this.removeIframeScrollbars(el)
			}
		)
		// auto pin notes
		this.autoPinned()

		// this.registerEvent(
		// 	this.app.metadataCache.on('changed', () => { })
		// 	this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {})
		// )

		// 调用即可显示波浪动画
		// this.createWaveAnimation()
	}

	createWaveAnimation(): void {
		// 注入 CSS 样式
		const style: HTMLStyleElement = document.createElement('style')
		style.type = 'text/css'
		style.innerHTML = `
		  .wave-svg {
			pointer-events: none;
			position: fixed;
			left: 0;
			bottom: 0;
			width: 100vw;
			height: 88px;
			z-index: 1;
		  }
		  .wave-main > use {
			animation: wave-move 12s linear infinite;
		  }
		  .wave-main > use:nth-child(1) {
			animation-delay: -2s;
		  }
		  .wave-main > use:nth-child(2) {
			animation-delay: -2s;
			animation-duration: 5s;
		  }
		  .wave-main > use:nth-child(3) {
			animation-delay: -4s;
			animation-duration: 3s;
		  }
		  @keyframes wave-move {
			0% { transform: translate(-90px, 0); }
			100% { transform: translate(85px, 0); }
		  }
		`
		document.head.appendChild(style)

		// 创建 SVG 波浪
		const svgHTML: string = `
		  <svg class="wave-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
			   viewBox="0 24 150 28" preserveAspectRatio="none">
			<defs>
			  <path id="wave-path" d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"></path>
			</defs>
			<g class="wave-main">
			  <use xlink:href="#wave-path" x="50" y="0" fill="rgba(224,233,239,.5)" />
			  <use xlink:href="#wave-path" x="50" y="3" fill="rgba(224,233,239,.5)" />
			  <use xlink:href="#wave-path" x="50" y="6" fill="rgba(224,233,239,.5)" />
			</g>
		  </svg>
		`
		const parser = new DOMParser()
		const doc = parser.parseFromString(svgHTML, 'image/svg+xml')
		const svgElement: SVGSVGElement | null = doc.querySelector('svg')

		if (svgElement) {
			document.body.appendChild(svgElement)
		}
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
	// renderArtGallery = async () => {
	// 	let preEleMap = new Map<HTMLDivElement, HTMLDivElement>()
	// 	let h2ElemMap = new Map<HTMLDivElement, HTMLDivElement>()

	// 	let ulListArr: HTMLDivElement[] = []
	// 	let preEleArr: HTMLDivElement[] = []
	// 	let h2ElemArr: HTMLDivElement[] = []
	// 	let curH2Elem: HTMLDivElement | null = null

	// 	let index = -1
	// 	// let isStart = true

	// 	this.registerMarkdownPostProcessor(
	// 		(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	// 			const cssclasses = parseFrontMatterStringArray(
	// 				ctx.frontmatter,
	// 				'cssclasses',
	// 				true
	// 			)
	// 			const isArtGallery =
	// 				Array.isArray(cssclasses) && cssclasses.includes('r34-profile')
	// 			if (!isArtGallery) return

	// 			// if (!isStart) return

	// 			if (
	// 				!h2ElemArr.includes(el as HTMLDivElement) &&
	// 				el.classList.length == 1 &&
	// 				el.classList.contains('el-h2')
	// 			) {
	// 				curH2Elem = el as HTMLDivElement
	// 			}

	// 			// 确保 ulListDiv 不重复添加
	// 			if (!ulListArr.includes(el as HTMLDivElement) && el.classList.contains('el-ul')) {
	// 				index++
	// 				ulListArr.push(el as HTMLDivElement)
	// 				h2ElemArr.push(curH2Elem as HTMLDivElement)
	// 				h2ElemMap.set(ulListArr[index], h2ElemArr[index])
	// 			}

	// 			if (
	// 				!preEleArr.includes(el as HTMLDivElement) &&
	// 				el.classList.length == 1 &&
	// 				el.classList.contains('el-pre')
	// 			) {
	// 				preEleArr.push(el as HTMLDivElement)
	// 				preEleMap.set(ulListArr[index], preEleArr[index])
	// 			}
	// 		}
	// 	)

	// 	// window.setTimeout(() => {
	// 	// 	isStart = false
	// 	// }, 5000)

	// 	this.registerMarkdownPostProcessor(
	// 		(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	// 			if (!el.classList.contains('el-ul')) return

	// 			const cssclasses = parseFrontMatterStringArray(
	// 				ctx.frontmatter,
	// 				'cssclasses',
	// 				true
	// 			)

	// 			const isArtGallery =
	// 				Array.isArray(cssclasses) && cssclasses.includes('r34-profile')

	// 			if (!isArtGallery) return
	// 			ctx.addChild(
	// 				new ArtGallery(
	// 					this.settings,
	// 					el,
	// 					h2ElemMap.get(el as HTMLDivElement),
	// 					preEleMap.get(el as HTMLDivElement)
	// 				)
	// 			)
	// 			// new Notice(`${h2ElemMap.has(el as HTMLDivElement)}`)
	// 			// new Notice(`${preEleMap.has(el as HTMLDivElement)}`)
	// 			// new Notice(`---------`)
	// 		}
	// 	)
	// }

	// 渲染颜色库
	renderGallerys() {
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const activeLeafView = this.app.workspace.getActiveViewOfType(MarkdownView)
				const isColorGallery = ctx.sourcePath === this.settings.folder_color_gallery
				const isIconGallery = ctx.sourcePath === this.settings.folder_icon_gallery

				if (activeLeafView && isColorGallery) {
					ctx.addChild(new renderColorGallery(this.settings, el))
				}

				if (activeLeafView && isIconGallery) {
					ctx.addChild(new renderIconGallery(this.settings, el))
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

	// 点击发音
	setupSpeakerClickEvent(container: HTMLElement): void {
		const speakerElements = container.querySelectorAll('[data-speaker]')
		const proxyPrefix = 'https://tts-proxy.cyuhaonan.workers.dev/?url='

		let isPlaying = false

		speakerElements.forEach(async (element) => {
			const word = element.getAttribute('data-speaker')
			if (!word) return

			const playLink = document.createElement('a')
			playLink.href = 'javascript:void(0)'
			playLink.textContent = '🔊'
			playLink.style.marginLeft = '4px'
			playLink.style.textDecoration = 'none'
			playLink.style.cursor = 'pointer'

			const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=${encodeURIComponent(
				word
			)}&tl=en`
			const proxiedUrl = proxyPrefix + encodeURIComponent(ttsUrl)

			try {
				const response = await fetch(proxiedUrl)
				if (!response.ok) throw new Error(`请求失败: ${response.statusText}`)

				const blob = await response.blob()
				const blobUrl = URL.createObjectURL(blob)

				const audio = new Audio(blobUrl)
				this.audioCache.set(word, audio)

				playLink.addEventListener('mouseenter', () => {
					if (isPlaying) return
					isPlaying = true

					const cachedAudio = this.audioCache.get(word)
					if (cachedAudio) {
						cachedAudio.currentTime = 0
						cachedAudio.volume = 1
						cachedAudio.play().catch((err: Error) => {
							console.warn(`音频播放失败：${err.message}`)
							new Notice(`音频播放失败：${err.message}`)
							isPlaying = false
						})
						cachedAudio.onended = () => {
							isPlaying = false
						}
					}
				})
			} catch (err: any) {
				console.warn(`音频预加载失败: ${err.message}`)
				new Notice(`音频预加载失败: ${err.message}`)
			}

			element.insertAdjacentElement('afterend', playLink)
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

	// 源码模式下排序标题
	sortHeadings() {
		const vault = this.app.vault
		const file = this.app.workspace.getActiveFile()
		if (!file) return

		return vault.process(file, (data) => {
			let h1Count = 0 // 记录一级标题的数量
			let h2Count = 0 // 二级标题的全局序号（用于显示编号）
			// const h1Numbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
			const h1Numbers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
			const h2Numbers = Array.from({ length: 20 }, (_, i) => `${i + 1}.`)
			const h3Numbers = Array.from({ length: 20 }, (_, i) => `${i + 1}`)
			const h3Numbers2 = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

			let h3Counters: number[] = new Array(10).fill(0)
			let h2Counters: number[] = new Array(10).fill(0)
			let curH2Index = -1
			let curH1Index = -1
			let insideCodeBlock = false // 标记是否在代码块内

			// 清理标题
			const cleanHeading = (line: string) => {
				const h1Regex = /(?:I、|II、|III、|IV、|V、|VI、|VII、|VIII、|IX、|X、)/g
				const h3Regex = /[①②③④⑤⑥⑦⑧⑨⑩]/g
				const h3Regex2 = /[①②③④⑤⑥⑦⑧⑨⑩] /g
				return line
					.replace(/^(#) 第.*?章/g, '$1') // 删除“第…章”结构
					.replace(/^(#|##|###) (\[\[.*?\|)\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2') // `[[笔记名称|3. 标题]]`
					.replace(/^(#|##|###) (\[\[.*?\])\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2') // `[[3. 标题]]`
					.replace(/^(#|##|###) (\[)\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2') // `# [3. 标题](链接文本)`
					.replace(/^(#|##|###) \d{1,2}\.?\d?\.?\d?\s+/u, '$1 ') // `# 3. 标题`
					.replace(/^(#|##|###) \d{1,2}\.?\d?\.?\d?\s+/u, '$1 ') // `# 3. 标题`
					.replace(h1Regex, '')
					.replace(h3Regex2, '') // 这两个的顺序不能改变
					.replace(h3Regex, '')
			}

			const testAndReplaceH1 = (pattern: RegExp, text: string) => {
				return text.replace(
					pattern,
					(_, prefix, title) => `# ${prefix || ''}${h1Numbers[h1Count++]}、${title}`
				)
			}

			const testAndReplaceH2 = (pattern: RegExp, text: string) => {
				return text.replace(
					pattern,
					(_, prefix, title) => `## ${prefix || ''}${h2Numbers[h2Count++]} ${title}`
				)
			}

			const testAndReplaceH3 = (
				pattern: RegExp,
				text: string,
				h2Prefix: number,
				isSkip: boolean
			) => {
				return text.replace(
					pattern,
					(_, prefix, title) =>
						`### ${prefix || ''}${
							isSkip === true
								? `${h3Numbers2[h3Counters[curH2Index]++]} ${title}` // 如果需要跳过，则使用 h3Numbers2
								: `${h2Prefix}.${h3Numbers[h3Counters[curH2Index]++]} ${title}` // 否则使用 h3Numbers
						}`
				)
			}

			const lines = data.split('\n')
			// 遍历每一行
			let isSkip = false
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
					isSkip = /[✦★☆✧@]/.test(lines[i])

					curH1Index = h1Count
					h2Count = 0 // 遇到新的 H1，H2 计数清零

					lines[i] = testAndReplaceH1(/^# (?!\[\[)(\[)?(.*?)]?$/, lines[i])
					lines[i] = testAndReplaceH1(/^# (\[\[)([^\|]+)$/, lines[i])
					lines[i] = testAndReplaceH1(/^# (\[\[.*?\|)(.*?)?$/, lines[i])
					continue
				}

				// 处理二级标题 `##`
				if (/^## /.test(lines[i]) && h2Count < 20) {
					isSkip = /[✦★☆✧@]/.test(lines[i])
					if (isSkip) continue

					curH2Index = h2Count
					h3Counters[curH2Index] = 0 // 重置 h3 计数

					lines[i] = testAndReplaceH2(/^## (?!\[\[)(\[)?(.*?)]?$/, lines[i]) // `# 标题`、`# [标题](链接文本)`
					lines[i] = testAndReplaceH2(/^## (\[\[)([^\|]+)$/, lines[i]) // `# [[标题]]`(不带 `|` 的)
					lines[i] = testAndReplaceH2(/^## (\[\[.*?\|)(.*?)?$/, lines[i]) // `# [[笔记名称|标题]]` (带 `|` 的)
					continue
				}

				// 处理三级标题 `###`
				if (/^### /.test(lines[i]) && curH2Index !== -1) {
					if (/[✦★☆✧@]/.test(lines[i])) continue

					if (h3Counters[curH2Index] < 10) {
						lines[i] = testAndReplaceH3(
							/^### (?!\[\[)(\[)?(.*?)]?$/,
							lines[i],
							h2Count,
							isSkip
						)
						lines[i] = testAndReplaceH3(/^### (\[\[)([^\|]+)$/, lines[i], h2Count, isSkip)
						lines[i] = testAndReplaceH3(
							/^### (\[\[.*?\|)(.*?)?$/,
							lines[i],
							h2Count,
							isSkip
						)
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

	// removeClickToggleSidebars() {
	// 	if (this.leftRibbon && this.middleArea && this.rightRibbon) {
	// 		this.leftRibbon.removeEventListener('click', this.toggleLeftSidebar)
	// 		this.middleArea.removeEventListener('click', this.toggleMiddleSidebar)
	// 		this.rightRibbon.removeEventListener('click', this.toggleRightSidebar)
	// 	}
	// }

	toggleLeftSidebar = () => {
		const isLeftCollapsed = this.app.workspace.leftSplit.collapsed
		if (isLeftCollapsed) this.app.workspace.leftSplit.toggle()
	}

	toggleMiddleSidebar = () => {
		window.setTimeout(() => {
			const isLeftCollapsed = this.app.workspace.leftSplit.collapsed
			if (!isLeftCollapsed) this.app.workspace.leftSplit.toggle()

			const isRightCollapsed = this.app.workspace.rightSplit.collapsed
			if (!isRightCollapsed) this.app.workspace.rightSplit.toggle()
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
				// 先清除所有事件监听（确保不会重复注册）
				this.removeHoverToggleSidebars?.()
				// this.removeClickToggleSidebars?.()

				if (this.toggleMode === 0) {
					this.hoverToggleSidebars?.()
					new Notice('已改为 “悬浮触发”')
				}
				// else if (this.toggleMode === 1) {
				// 	this.clickToggleSidebars?.()
				// 	new Notice('已改为 “点击触发”')
				// }
				else {
					new Notice('已改为 “不触发”')
				}

				// 状态切换（0 → 1 → 2 → 0）
				// this.toggleMode = (this.toggleMode + 1) % 3

				this.toggleMode = (this.toggleMode + 1) % 2
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

		this.addCommand({
			id: 'open-specific-note',
			name: '打开主页笔记',
			hotkeys: [{ modifiers: ['Alt'], key: '`' }],
			callback: async () => {
				openNoteByPath('Kanban/Home/Home.kanban.md') // ← 修改成你的路径

				/*
				const leftmostLeaf = this.app.workspace.getLeaf(false)
				const newLeaf = this.app.workspace.createLeafBySplit(leftmostLeaf, false)

				const abstractFile = this.app.vault.getAbstractFileByPath(
					'Kanban/Home/Home.kanban.md'
				)

				if (abstractFile && abstractFile instanceof TFile) {
					// 这里确定是文件
					await newLeaf.openFile(abstractFile)
					this.app.workspace.setActiveLeaf(newLeaf, { focus: true })
				} else {
					console.log('指定路径不是文件，或文件不存在')
				}
				*/
			},
		})

		const openNoteByPath = async (notePath: string) => {
			const abstractFile = this.app.vault.getAbstractFileByPath(notePath)
			if (!(abstractFile instanceof TFile)) {
				console.warn('未找到有效的 Markdown 文件:', notePath)
				return
			}

			const file = abstractFile as TFile

			// ✅ 主区域新建一个 leaf（新 tab）
			const newLeaf = this.app.workspace.getLeaf('tab')

			/*
			// ✅ 获取父容器（通常是 WorkspaceSplit），将新 leaf 插入最左侧
			const parent = (newLeaf as any).parent
			if (parent && parent.children && Array.isArray(parent.children)) {
				// 把 newLeaf 从当前位置移除
				const index = parent.children.indexOf(newLeaf)
				if (index > -1) parent.children.splice(index, 1)
				// 插入到第一个位置
				parent.children.unshift(newLeaf)
			}
			*/

			// ✅ 在新建的 leaf 中打开文件
			await newLeaf.openFile(file, { active: true })

			window.setTimeout(() => {
				this.app.workspace.setActiveLeaf(newLeaf, { focus: true })
			}, 0) // 50ms 通常够用，如果不行可以调大点

			if (!newLeaf.getViewState().pinned) {
				newLeaf.setPinned(true)
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		this.saveData(this.settings)
	}
}
