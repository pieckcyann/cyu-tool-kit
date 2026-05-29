import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from '../setting/SettingData'

export default class ClickCopyBlock extends MarkdownRenderChild {
	constructor(
		public settings: CyuTookitSettings,
		public renderedDiv: HTMLElement
	) {
		super(renderedDiv)
	}

	async onload() {
		const cpbs = this.containerEl.findAll('.cpb') as HTMLLabelElement[]
		const enable = this.settings.enable_clickCopy_block

		for (const cpb of cpbs) {
			if (enable) {
				const codeElement = cpb.querySelector('code')
				// 如果包裹了行内代码，调整样式
				if (codeElement) {
					cpb.classList.add('cpb-code')
					cpb.innerText = codeElement.innerText
				}

				cpb.removeEventListener('click', this.clickHandler)
				cpb.addEventListener('click', this.clickHandler)
			} else {
				cpb.removeEventListener('click', this.clickHandler)
			}
		}
	}

	// 点击事件处理
	clickHandler = (event: MouseEvent) => {
		const clickedSpan = (event.target as HTMLElement)?.closest(
			// 'span.cpb:not(:has(*))'
			'span.cpb'
		) as HTMLElement

		const clickedImg = (event.target as HTMLElement)?.closest(
			':is(.cpb span) img'
		) as HTMLImageElement

		if (clickedSpan && !clickedImg) {
			this.handleCopyText(clickedSpan.innerText)
		}

		// 排除同时按下 ctrl 、shift 、 alt 、meta 键
		if (
			clickedImg &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey &&
			!event.metaKey
		) {
			this.handleCopyImg(clickedImg)
		}
	}

	// 复制文本
	handleCopyText = (text: string) => {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				// console.log(😀Text copied: ' + text);
				new Notice(`😀 ${text}`)
			})
			.catch((err) => {
				console.error('copy error', err)
				new Notice(`🛑 copy error: ${err}`)
			})
	}

	// 复制图片
	handleCopyImg = (imgEle: HTMLImageElement) => {
		const image = new Image()
		image.crossOrigin = 'anonymous'
		image.src = imgEle.src
		image.onload = () => {
			const canvas = document.createElement('canvas')
			canvas.width = image.width
			canvas.height = image.height
			const ctx = canvas.getContext('2d')
			if (ctx) {
				ctx.fillStyle = '#fff'
				ctx.fillRect(0, 0, canvas.width, canvas.height)
				ctx.drawImage(image, 0, 0)
			}
			try {
				canvas.toBlob(async (blob: Blob | null) => {
					if (blob == null) return
					await navigator.clipboard
						.write([
							new ClipboardItem({
								'image/png': blob,
							}),
						])
						.then(
							() => {
								new Notice(`😁Copied to clipboard:![[${imgEle.alt}]]`)
							},
							() => {
								new Notice('😭COPY IMAGE ERROR...')
							}
						)
				})
			} catch (error) {
				new Notice(`😭COPY IMAGE ERROR...`)
				console.error(error)
			}
		}
		image.onerror = () => {
			new Notice('😭COPY IMAGE ERROR...')
		}
	}
}
