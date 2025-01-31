/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownView,
	Notice,
	Plugin,
	WorkspaceLeaf,
	parseFrontMatterEntry,
	parseFrontMatterStringArray,
} from 'obsidian'
import { CyuToolkitSettingTab } from './settings/settingsTab'
import { CyuTookitSettings, DEFAULT_SETTINGS } from 'src/settings/settingsData'
import ClickCopyBlock from './core/ClickCopyBlock'
import renderColorGallery from './core/ColorGallery'
import { parseM3u8Video } from './core/parseVideoSrc'
import ArtGallery from './core/ArtGallery'

export default class CyuToolkitPlugin extends Plugin {
	settings: CyuTookitSettings = DEFAULT_SETTINGS

	async onload() {
		await this.loadSettings()

		this.registerCommands()
		this.addSettingTab(new CyuToolkitSettingTab(this.app, this))

		await this.registerEvents()
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
					'ignore-update-external-image'
				) as boolean)
				if (isNeedUpdateExternalImageTags) this.altExternalImageTags(el)

				// parse .m3u8 to .mp4
				if (this.settings.enable_parse_m3u8) parseM3u8Video(el)

				// remove the iframe scroll bar
				this.removeIframeScrollbars(el)
			}
		)
		// auto pin notes
		this.autoPinned()

		this.registerEvent(
			this.app.metadataCache.on('changed', () => {
				// this.renderColorGallery()
			})
		)

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {})
		)
	}

	renderClickCopyBlock() {
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				ctx.addChild(new ClickCopyBlock(this.settings, el))
			}
		)
	}

	renderArtGallery() {
		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				const cssclasses = parseFrontMatterStringArray(
					ctx.frontmatter,
					'cssclasses',
					true
				)
				const isArtGallery =
					Array.isArray(cssclasses) && cssclasses.includes('r34-twitter')

				if (isArtGallery) {
					ctx.addChild(new ArtGallery(this.settings, el))
				}
			}
		)
	}

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

	altExternalImageTags(container: HTMLElement): void {
		const imgs = container.findAll('img') as HTMLImageElement[]
		for (const img of imgs) {
			if (img.classList.contains('banner-image')) return // 避免影响banners插件
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
	}

	removeIframeScrollbars(container: HTMLElement): void {
		const iframes: NodeListOf<HTMLIFrameElement> = container.querySelectorAll('iframe')

		iframes.forEach((iframe: HTMLIFrameElement) => {
			iframe.setAttribute('scrolling', 'no')
		})
	}

	onunload() {}

	async registerCommands() {
		this.addCommand({
			id: 'create-click-copy-block',
			name: 'Create a click-copy block',
			editorCallback: (editor: Editor) => {
				const selectedText = editor.getSelection()

				if (selectedText) {
					const surroundedText = `<span class='cpb'>${selectedText}</span>`
					editor.replaceSelection(surroundedText)
				}
			},
		})

		this.addCommand({
			id: 'auto-pin-note',
			name: 'auto pin all notes',
			callback: () => {
				this.autoPinned()
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
