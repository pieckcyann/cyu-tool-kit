import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from 'src/settings/settingsData'
import {
	getDominantColor,
	getMostVisibleColor,
	getTextColor,
} from 'src/utils/HandleColor'

export default class ArtGallery extends MarkdownRenderChild {
	constructor(public settings: CyuTookitSettings, public renderedDiv: HTMLElement) {
		super(renderedDiv)
	}

	async onload() {
		await this.extractAndSetThemeColor(this.containerEl)
	}

	async extractAndSetThemeColor(container: HTMLElement): Promise<void> {
		if (!container.classList.contains('el-ul')) return

		const img = container.querySelector('strong>img') as HTMLImageElement
		// const img = container.querySelector('img') as HTMLImageElement
		if (!img) return
		// if (!img.src.contains('imgbox.com')) img.crossOrigin = 'Anonymous' // 处理跨域问题
		img.crossOrigin = 'anonymous'

		// img.addEventListener('load', function () {
		// 	new Notice(`加载成功`)
		// })

		try {
			await this.waitForImageLoad(img)

			const hexColors = getDominantColor(img)
			if (!hexColors.length) return

			// const themeColor = hexColors[0]
			const themeColor = getMostVisibleColor(hexColors)
			const textColor = getTextColor(themeColor)

			container.style.setProperty('--background-modifier-border-hover', themeColor)
			container.style.setProperty('--background-modifier-border', themeColor)
			container.style.setProperty('--cyu-avatar-border-color', themeColor)
			container.style.setProperty('--cyu-list-marker-color', themeColor)
			container.style.setProperty('--cyu-cpb-bgcolor', themeColor)
			container.style.setProperty('--cyu-cpb-txcolor', textColor)
			img.crossOrigin = ''
		} catch (err) {
			new Notice('提取颜色失败:', err)
		}
	}

	private waitForImageLoad(img: HTMLImageElement): Promise<void> {
		return new Promise((resolve, reject) => {
			if (img.complete && img.naturalWidth > 0) {
				resolve() // 图片已加载
			} else {
				img.onload = () => resolve()
				img.onerror = () => reject(new Error('图片加载失败: ' + img.src))
			}
		})
	}

	// extractAndSetThemeColor(container: HTMLElement) {
	// 	// if (!container.classList.contains('el-ul')) return
	// 	// const bgColor = getComputedStyle(container).getPropertyValue('--cyu-cpb-bgcolor')
	// 	// if (bgColor !== '#dd600b') return

	// 	const img = container.find('strong img') as HTMLImageElement
	// 	if (!img) return

	// 	img.crossOrigin = 'Anonymous' // 处理跨域问题
	// 	const hexColors = getDominantColor(img) as string[]
	// 	const themeColor = getMostVisibleColor(hexColors)
	// 	const textColor = getTextColor(themeColor)

	// 	container.style.setProperty('--background-modifier-border', themeColor)
	// 	container.style.setProperty('--background-modifier-border-hover', themeColor)
	// 	container.style.setProperty('--cyu-avatar-border-color', themeColor)
	// 	container.style.setProperty('--link-external-color', themeColor)
	// 	container.style.setProperty('--cyu-cpb-bgcolor', themeColor)
	// 	container.style.setProperty('--cyu-cpb-txcolor', textColor)
	// }

	/**
	 * 判断是否是应该上传的imgEl并为spanEl设置类名
	 * @param spanEl
	 * @param imgEl
	 */
	public static identifyUnhostedImages(spanEl: HTMLSpanElement, imgEl: HTMLImageElement) {
		const imgSrc = imgEl.src
		// console.log(`hasAttribute: ${imgEl.hasAttribute('src')}`)

		const hostImageWebsite = ['imgbox', 'iili.io']
		const isUnhostedImage = !hostImageWebsite.some((website) => imgSrc.includes(website)) // true:未上传
		const isSpanNotHasClassName = !spanEl.classList.contains('unhosted') // true:还没添加类名
		if (isUnhostedImage && isSpanNotHasClassName) {
			spanEl.classList.add('unhosted')
		}
	}

	/**
	 * 判断是否是应该上传的sourceEl并为spanEl设置类名
	 * @param spanEl
	 * @param sourceEl
	 */
	public static identifyUnhostedVideos(
		spanEl: HTMLSpanElement,
		sourceEl: HTMLSourceElement
	) {
		const sourceSrc = sourceEl.src
		const isUnhostedVideo = !sourceSrc.contains('imgchest') // true:未上传
		if (isUnhostedVideo) {
			spanEl.classList.add('unhosted')
		}
	}
}
