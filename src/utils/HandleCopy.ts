import { Notice } from 'obsidian'

// 复制文本
export function handleCopyText(text: string) {
	navigator.clipboard
		.writeText(text)
		.then(() => {
			// console.log(😀Text copied: ' + text);
			new Notice('😀Text copied: ' + text)
		})
		.catch((err) => {
			// console.error('copy text error', err)
			new Notice('copy text error: ', err)
		})
}

// 复制图片
export function handleCopyImg(imgEle: HTMLImageElement) {
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
			canvas.toBlob(async (blob: Blob) => {
				await navigator.clipboard
					.write([
						new ClipboardItem({
							'image/png': blob,
						}),
					])
					.then(
						() => {
							new Notice('😁Copied to clipboard: ' + '![[' + imgEle.alt + ']]')
						},
						() => {
							new Notice('😭COPY IMAGE ERROR...')
						}
					)
			})
		} catch (error) {
			new Notice('😭COPY IMAGE ERROR...')
			console.error(error)
		}
	}
	image.onerror = () => {
		new Notice('😭COPY IMAGE ERROR...')
	}
}
