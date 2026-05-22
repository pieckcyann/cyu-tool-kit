import { TemplaterError } from '../setting/suggesters/Error'
import { App, normalizePath, TAbstractFile, TFile, TFolder, Vault } from 'obsidian'

/**
 * 获取所有分割后的部分
 * @param input 原始字符串
 * @param separator 分隔符
 * @param escapeChar 转义字符，默认为 '\'，允许和 separator 一样
 * @returns 分割后的字符串数组
 */
export function splitWithEscape(
	input: string,
	separator: string,
	escapeChar?: string
): string[] {
	if (!input) return []

	const hasEscape = !!escapeChar

	const parts: string[] = []
	let current = ''
	let i = 0
	let inEscape = false

	while (i < input.length) {
		const char = input[i]

		// separator 和 escapeChar 相同：双字符转义
		if (hasEscape && escapeChar === separator) {
			if (char === separator) {
				const next = input[i + 1]

				// 连续两个 separator => 转义后的普通字符
				if (next === separator) {
					current += separator
					i += 2
					continue
				}

				// 单个 separator => 真正分隔
				parts.push(current)
				current = ''
				i++
				continue
			}

			current += char
			i++
			continue
		}

		// 普通转义模式
		if (hasEscape && inEscape) {
			current += char
			inEscape = false
			i++
			continue
		}

		if (hasEscape && char === escapeChar) {
			inEscape = true
			i++
			continue
		}

		if (char === separator) {
			parts.push(current)
			current = ''
			i++
			continue
		}

		current += char
		i++
	}

	// 末尾孤立 escapeChar
	if (inEscape && escapeChar) {
		current += escapeChar
	}

	parts.push(current)

	return parts
}

/**
 * 首字母大写
 */
export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

let singletonDot: HTMLDivElement | null = null

/**
 * 在页面上绘制一个红点，用于指示坐标
 */
export function debugPoint(x: number, y: number, isSingleton = false, color = 'red') {
	// 如果是单例模式，先尝试复用旧元素
	let dot: HTMLDivElement

	if (isSingleton) {
		if (!singletonDot) {
			singletonDot = document.createElement('div')
			document.body.appendChild(singletonDot)
		}
		dot = singletonDot
	} else {
		dot = document.createElement('div')
		document.body.appendChild(dot)
		// 非单例版：3秒后自动消失
		// setTimeout(() => dot.remove(), 3000)
	}

	// 绘制样式
	applyBaseStyle(dot, { left: x, top: y, width: 8, height: 8 })
	dot.style.borderRadius = '50%'
	dot.style.backgroundColor = color
	dot.style.transform = 'translate(-50%, -50%)'
	dot.style.border = '2px solid white'
}

/**
 * 根据 DOMRect 在页面上显示一个半透明的高亮块
 */
export function showRectIndicator(
	rect: DOMRect | null,
	isSingleton = false,
	color = 'rgba(0, 120, 215, 0.3)'
) {
	if (!rect) return

	const SINGLETON_ID = 'debug-rect-singleton'
	let mask: HTMLDivElement

	if (isSingleton) {
		// 单例模式：通过 ID 查找复用
		let existing = document.getElementById(SINGLETON_ID) as HTMLDivElement
		if (!existing) {
			existing = document.createElement('div')
			existing.id = SINGLETON_ID
			document.body.appendChild(existing)
		}
		mask = existing
	} else {
		// 普通模式：直接创建
		mask = document.createElement('div')
		document.body.appendChild(mask)
		// setTimeout(() => mask.remove(), 2000)
	}

	// 复用绘制逻辑
	applyBaseStyle(mask, rect)
	mask.style.backgroundColor = color
	mask.style.border = `1px solid ${color.replace('0.3', '0.8')}`
}

// 内部通用的样式注入函数
function applyBaseStyle(
	el: HTMLElement,
	rect: { left: number; top: number; width: number; height: number }
) {
	Object.assign(el.style, {
		position: 'fixed',
		left: `${rect.left}px`,
		top: `${rect.top}px`,
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		zIndex: '10000',
		pointerEvents: 'none',
		boxSizing: 'border-box',
	})
}

/**
 * 将 string 类型的 seed 转为 number 类型的 seed
 * @param str
 * @returns
 */
export const hashString = (str: string): number => {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // 转为 32 位整数
	}
	return Math.abs(hash)
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function escape_RegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function generate_command_regex(): RegExp {
	return /<%(?:-|_)?\s*[*~]{0,1}((?:.|\s)*?)(?:-|_)?%>/g
}

export function generate_dynamic_command_regex(): RegExp {
	return /(<%(?:-|_)?\s*[*~]{0,1})\+((?:.|\s)*?%>)/g
}

export function resolve_tfolder(folder_str: string): TFolder {
	folder_str = normalizePath(folder_str)

	const folder = app.vault.getAbstractFileByPath(folder_str)
	if (!folder) {
		throw new TemplaterError(`Folder "${folder_str}" doesn't exist`)
	}
	if (!(folder instanceof TFolder)) {
		throw new TemplaterError(`${folder_str} is a file, not a folder`)
	}

	return folder
}

export function resolve_tfile(file_str: string): TFile {
	file_str = normalizePath(file_str)

	const file = app.vault.getAbstractFileByPath(file_str)
	if (!file) {
		throw new TemplaterError(`File "${file_str}" doesn't exist`)
	}
	if (!(file instanceof TFile)) {
		throw new TemplaterError(`${file_str} is a folder, not a file`)
	}

	return file
}

export function get_tfiles_from_folder(folder_str: string): Array<TFile> {
	const folder = resolve_tfolder(folder_str)

	const files: Array<TFile> = []
	Vault.recurseChildren(folder, (file: TAbstractFile) => {
		if (file instanceof TFile) {
			files.push(file)
		}
	})

	files.sort((a, b) => {
		return a.basename.localeCompare(b.basename)
	})

	return files
}

export function arraymove<T>(arr: T[], fromIndex: number, toIndex: number): void {
	if (toIndex < 0 || toIndex === arr.length) {
		return
	}
	const element = arr[fromIndex]
	arr[fromIndex] = arr[toIndex]
	arr[toIndex] = element
}

export function get_active_file(app: App) {
	return app.workspace.activeEditor?.file ?? app.workspace.getActiveFile()
}

/**
 * @param path Normalized file path
 * @returns Folder path
 * @example
 * get_folder_path_from_path(normalizePath("path/to/folder/file", "md")) // path/to/folder
 */
export function get_folder_path_from_file_path(path: string) {
	const path_separator = path.lastIndexOf('/')
	if (path_separator !== -1) return path.slice(0, path_separator)
	return ''
}
