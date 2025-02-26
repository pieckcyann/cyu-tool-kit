import ColorThief from 'colorthief'
// import { Notice } from 'obsidian'

export function getDominantColor(img: HTMLImageElement): string[] {
	const colorThief = new ColorThief()
	try {
		const palette = colorThief.getPalette(img, 5) // 获取五个颜色
		const hexColors = palette.map(rgbToHex) // 将每个 RGB 转为 HEX 颜色
		return hexColors // 返回五个 HEX 颜色值的数组
	} catch (err) {
		// new Notice(`获取颜色失败: ${err}`)
		return [] // 返回空数组，避免继续执行后面的代码
	}
}

// 根据背景颜色返回最适合的突出文字色
export function getTextColor(backgroundColor: string): string {
	const rgb = hexToRgb(backgroundColor)
	if (!rgb) return '#000000' // 默认黑色

	const luminance = (r: number, g: number, b: number) => {
		const a = [r, g, b].map(function (v) {
			v /= 255
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
		})
		return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
	}

	const bgLuminance = luminance(rgb.r, rgb.g, rgb.b)
	const textColor = bgLuminance > 0.179 ? '#000000' : '#FFFFFF'
	// 如果背景亮度较高，则使用黑色文字，否则使用白色文字
	return textColor
}

// 选择最显眼的颜色（综合对比度、鲜艳度、色彩距离）

export function getMostVisibleColor(colors: string[]): string {
	let bestColor = colors[0]
	let bestScore = -Infinity

	for (const color of colors) {
		const luminance = getLuminance(color)
		const chroma = getChroma(color)
		const colorDist = colorDistanceFromGray(color)

		// 计算综合得分（调节权重，突出鲜艳颜色）
		const score = chroma * 2.5 + colorDist * 1.5 - Math.abs(luminance - 0.5)

		if (score > bestScore) {
			bestScore = score
			bestColor = color
		}
	}

	return bestColor
}

/*
export function getMostVisibleColor(hexColors: string[]): string {
	const getSaturation = (color: string): number => {
		const rgb = hexToRgb(color)
		if (!rgb) return 0

		const { r, g, b } = rgb
		const max = Math.max(r, g, b)
		const min = Math.min(r, g, b)

		if (max === min) return 0 // 无饱和度

		const delta = max - min
		const lightness = (max + min) / 2
		const saturation = delta / (1 - Math.abs(2 * lightness - 1))
		return saturation
	}

	const getLuminance = (r: number, g: number, b: number): number => {
		const a = [r, g, b].map((v) =>
			v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4)
		)
		return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
	}

	// 选取最显眼的颜色（亮度、饱和度、去除低饱和度）
	let mostVisibleColor = hexColors[0]
	let maxScore = -1

	for (const color of hexColors) {
		const rgb = hexToRgb(color)
		if (!rgb) continue

		const { r, g, b } = rgb
		const luminance = getLuminance(r, g, b)
		const saturation = getSaturation(color)

		// 只考虑饱和度大于 0.2 的颜色，避免低饱和度的颜色（如黑色）
		if (saturation < 0.2) continue

		// 计算总分数：考虑亮度、饱和度和颜色的自然显眼度
		const score = luminance * saturation // 显眼度 = 亮度 * 饱和度

		if (score > maxScore) {
			maxScore = score
			mostVisibleColor = color
		}
	}

	return mostVisibleColor
}
*/

// RGB 转 HEX
function rgbToHex(rgb: [number, number, number]): string {
	return `#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}
// HEX 转 RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const match = hex.match(/^#([a-fA-F0-9]{6})$/)
	if (!match) return null

	const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].substring(i, i + 2), 16))
	return { r, g, b }
}

// 计算相对亮度（luminance），用于对比度计算
function getLuminance(hex: string): number {
	const rgb = hexToRgb(hex)
	if (!rgb) return 0

	const normalize = (value: number) => {
		value /= 255
		return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
	}

	const r = normalize(rgb.r)
	const g = normalize(rgb.g)
	const b = normalize(rgb.b)

	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// 计算颜色的鲜艳度（Chroma），数值越大颜色越显眼
function getChroma(hex: string): number {
	const rgb = hexToRgb(hex)
	if (!rgb) return 0

	const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255]
	return Math.max(r, g, b) - Math.min(r, g, b) // 计算色彩强度
}

// 计算颜色与灰度的距离（避免选择太暗的颜色）
function colorDistanceFromGray(hex: string): number {
	const rgb = hexToRgb(hex)
	if (!rgb) return 0

	const avg = (rgb.r + rgb.g + rgb.b) / 3
	return Math.sqrt((rgb.r - avg) ** 2 + (rgb.g - avg) ** 2 + (rgb.b - avg) ** 2)
}
