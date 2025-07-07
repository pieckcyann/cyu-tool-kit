import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from 'src/settings/settingsData'
import { getDominantColor, getTextColor } from 'src/utils/HandleColor'

export default class ArtGallery extends MarkdownRenderChild {
	constructor(
		public settings: CyuTookitSettings,
		public renderedDiv: HTMLElement,
		public curH2Ele: HTMLDivElement | undefined,
		public curPreEl: HTMLDivElement | undefined
	) {
		super(renderedDiv)
		this.curH2Ele = curH2Ele
		this.curPreEl = curPreEl
	}

	async onload() {
		await this.setForUllist(this.containerEl)
		this.setForOllist(this.containerEl)
	}

	/**
	 * @param ulListDiv ul 元素
	 * @returns void
	 * @description 为 ul 元素设置样式
	 */
	async setForUllist(ulListDiv: HTMLElement): Promise<void> {
		if (!ulListDiv.classList.contains('el-ul')) return
		if (ulListDiv.getAttribute('style')) return

		const img = ulListDiv.querySelector('strong>img') as HTMLImageElement
		if (!img) return

		const imgSrc = img.src
		const originImgSrc = img.src // 保存原始图片 URL

		let imgThemeN = 0
		if (img.hasAttribute('width'))
			imgThemeN = parseInt(img.getAttribute('width')!, 10) - 1 // 转换为整数

		img.crossOrigin = 'anonymous'
		if (imgSrc.includes('imgbox.com')) {
			// 使用 proxy.cors.sh 代理请求，并添加 API Key
			const proxyUrl = 'https://proxy.cors.sh/' + imgSrc
			try {
				const response = await fetch(proxyUrl, {
					headers: { 'x-cors-api-key': 'temp_0cbd61248d3a5eca7b7a554ec5b42eaf' },
				})

				if (!response.ok) throw new Error(`x代理请求失败: ${response.statusText}`)

				const blob = await response.blob()
				img.src = URL.createObjectURL(blob)
			} catch (error) {
				new Notice('z代理请求失败: ' + error.message)
				return
			}
		}

		try {
			await this.waitForImageLoad(img)

			const hexColors = getDominantColor(img)
			if (!hexColors.length) return

			// const themeColor = getMostVisibleColor(hexColors)
			const themeColor = hexColors[imgThemeN]
			if (!themeColor) return

			// const textColor = getTextColor(themeColor)
			const textColor = '#FFFFFF'

			img.removeAttribute('crossOrigin') // 完全移除 crossOrigin 属性
			img.src = originImgSrc // 恢复原始图片 URL

			// ulListDiv.setAttribute('attr-theme-olor', themeColor)
			// ulListDiv.setAttribute('attr-text-olor', themeColor)
			ulListDiv.style.setProperty('--cyu-theme-olor', themeColor)
			// bold font color
			ulListDiv.style.setProperty('--bold-color', themeColor)
			// list before color
			ulListDiv.style.setProperty('--interactive-accent', themeColor)
			ulListDiv.style.setProperty('--cyu-profile-border-color', themeColor)
			ulListDiv.style.setProperty('--cyu-avatar-border-color', themeColor)
			ulListDiv.style.setProperty('--cyu-list-marker-color', themeColor)
			ulListDiv.style.setProperty('--cyu-cpb-bgcolor', themeColor)
			ulListDiv.style.setProperty('--cyu-cpb-txcolor', textColor)

			if (this.curH2Ele && !this.curH2Ele.hasAttribute('style'))
				this.curH2Ele.style.setProperty('--h2-color', themeColor)
			if (this.curPreEl && !this.curPreEl.hasAttribute('style'))
				this.curPreEl.style.setProperty('--cyu-theme-olor', themeColor)
		} catch (err) {
			// new Notice('提取颜色失败:', err)
		}
	}

	/**
	 * @param olListDiv ol 元素
	 * @returns void
	 * @description 为 ol 元素设置与前一个 ul 元素相同的样式
	 * @description 用于设置 ol 元素的样式，使其与前一个 ul 元素的样式相同
	 */
	setForOllist(olListDiv: HTMLElement): void {
		if (!olListDiv.classList.contains('el-ol')) return
		// if (olListDiv.hasAttribute('style')) return

		// 上一个元素
		const ulListDiv = olListDiv.previousElementSibling as HTMLDivElement
		const themeColor = ulListDiv.getAttribute('attr-theme-olor')
		const textColor = '#FFFFFF'

		olListDiv.style.setProperty('--cyu-profile-border-color', themeColor)
		olListDiv.style.setProperty('--cyu-avatar-border-color', themeColor)
		olListDiv.style.setProperty('--cyu-list-marker-color', themeColor)
		olListDiv.style.setProperty('--cyu-cpb-bgcolor', themeColor)
		olListDiv.style.setProperty('--cyu-cpb-txcolor', textColor)
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
