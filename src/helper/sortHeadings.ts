import { App, Notice, ReferenceCache, TFile } from 'obsidian'

/**
 * Sorts / re-numbers headings (H1–H3) in the active file.
 *
 * Rules:
 *  - H1 → Roman numerals (I, II, III …)
 *  - H2 → Arabic with dot (1. 2. 3. …)
 *  - H3 → `<h2-number>.<h3-number>` or circled numbers (①②…) when the
 *          parent H2 contains a skip marker (✦ ★ ☆ ✧ @)
 *  - Headings containing skip markers are left unnumbered
 *  - Code blocks are ignored
 */

const H1_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const H2_LABELS = Array.from({ length: 20 }, (_, i) => `${i + 1}.`)
const H3_LABELS = Array.from({ length: 20 }, (_, i) => `${i + 1}`)
const H3_CIRCLE = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
const SKIP_RE = /[✦★☆✧@]/

// 用于剥离前缀的正则：匹配常见的 I、 1. 1.1 ① 等
const PREFIX_RE = /^#{1,3} ([IVX]+、|\d+\.\d+\s|\d+\.\s|[①-⑩]\s)/

/**
 * 排序标题并同步更新全库引用
 */
export async function sortHeadings(app: App): Promise<boolean> {
	const file = app.workspace.getActiveFile()
	if (!file || !(file instanceof TFile)) return false

	// 用于记录标题的变化映射：{ "旧标题文字": "新标题文字" }
	const renameMap = new Map<string, string>()

	// 1. 更新当前文件内容
	await app.vault.process(file, (data) => {
		let h1Count = 0
		let h2Count = 0
		let curH2Index = -1
		const h3Counters: number[] = new Array(10).fill(0)
		let insideCodeBlock = false // 忽略代码块语法的内部
		let skipNextH3 = false

		const lines = data.split('\n').map((line) => {
			// 跳过代码块
			if (/^```/.test(line)) {
				insideCodeBlock = !insideCodeBlock
				return line
			}
			if (insideCodeBlock) return line

			// 跳过非标题
			const isHeading = /^#{1,3} /.test(line)
			if (!isHeading) return line

			// 提取原始标题文字（用于全库搜索的 Key）
			const oldHeadingFull = line.replace(/^#{1,3} /, '').trim()

			// 剥离当前行已有的旧前缀，得到“纯净标题”
			let cleanLine = line
			if (PREFIX_RE.test(line)) {
				cleanLine = line.replace(PREFIX_RE, (match, p1) => match.replace(p1, ''))
			}
			let newLine = cleanLine
			const levelMatch = line.match(/^(#{1,3}) /)
			const level = levelMatch ? levelMatch[1].length : 0

			// 3. 计算并添加新前缀
			if (level === 1) {
				skipNextH3 = SKIP_RE.test(cleanLine)
				h2Count = 0
				newLine = addLabel(cleanLine, 1, H1_LABELS[h1Count++] + '、')
			} else if (level === 2) {
				if (SKIP_RE.test(cleanLine)) {
					skipNextH3 = true
				} else {
					skipNextH3 = false
					curH2Index = h2Count
					h3Counters[curH2Index] = 0
					newLine = addLabel(cleanLine, 2, H2_LABELS[h2Count++] + ' ')
				}
			} else if (level === 3 && curH2Index !== -1) {
				if (!SKIP_RE.test(cleanLine) && h3Counters[curH2Index] < 10) {
					const idx = h3Counters[curH2Index]++
					const label = skipNextH3
						? H3_CIRCLE[idx] + ' '
						: `${h2Count}.${H3_LABELS[idx]} `
					newLine = addLabel(cleanLine, 3, label)
				}
			}

			// 记录变化映射
			if (newLine !== line) {
				const newHeadingFull = newLine.replace(/^#{1,3} /, '').trim()
				if (oldHeadingFull && newHeadingFull) {
					renameMap.set(oldHeadingFull, newHeadingFull)
				}
			}

			return newLine
		})

		return lines.join('\n')
	})

	// 有更新才反向修改引用
	if (renameMap.size > 0) {
		await updateAllLinks(app, file, renameMap)
		return true
	}
	
	return false
}

/**
 * 内部函数：更新全库中指向该文件的标题引用
 */
async function updateAllLinks(
	app: App,
	targetFile: TFile,
	renameMap: Map<string, string>
) {
	const { vault, metadataCache } = app
	const resolvedLinks = metadataCache.resolvedLinks

	// 获取所有引用了此文件的文件列表
	const filesToUpdate = Object.keys(resolvedLinks).filter(
		(path) => resolvedLinks[path][targetFile.path]
	)

	for (const linkerPath of filesToUpdate) {
		const linkerFile = vault.getAbstractFileByPath(linkerPath)
		if (!(linkerFile instanceof TFile)) continue

		await vault.process(linkerFile, (data) => {
			let newData = data
			renameMap.forEach((newTitle, oldTitle) => {
				// 1. 处理 WikiLinks: [[file#oldTitle]] 或 [[file#oldTitle|alias]]
				// 只替换 # 后面且在 | 或 ]] 前面的部分
				const escapedOld = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
				const wikiRegex = new RegExp(`(#${escapedOld})(?=\\||\\]\\])`, 'g')
				newData = newData.replace(wikiRegex, `#${newTitle}`)

				// 2. 处理 Markdown Links: [text](file#oldTitle)
				// 注意：Markdown 链接中的空格可能被编码为 %20
				const escapedOldEncoded = escapedOld.replace(/ /g, '(?: |%20)')
				const mdRegex = new RegExp(`(#${escapedOldEncoded})(?=\\))`, 'g')
				newData = newData.replace(mdRegex, `#${newTitle}`)
			})
			return newData
		})
	}
}

/**
 * 辅助函数：在井号之后插入前缀
 */
function addLabel(line: string, level: number, label: string): string {
	const hashes = '#'.repeat(level) + ' '
	return line.replace(new RegExp(`^#{${level}} `), `${hashes}${label}`)
}

/**
 * 剥离标题前缀
 * 示例：匹配常见的数字前缀如 "1. " 或 "I、" 并剔除
 */
export function removeHeadingPrefix(data: string): string {
	return data
		.split('\n')
		.map((line) => {
			if (/^#{1,3} /.test(line)) {
				return (
					line
						.replace(/^(#{1,3} )([IVX]+、|\d+\.\d+\s|\d+\.\s|[①-⑩]\s)/, '$1')
						// 这种直接删除
						.replace(/[①②③④⑤⑥⑦⑧⑨⑩] /g, '')
						.replace(/(?:I|II|III|IV|V|VI|VII|VIII|IX|X)、/g, '')
				)
			}
			return line
		})
		.join('\n')
}

// export function removeHeadingPrefix(app: App): void {
// 	const file = app.workspace.getActiveFile()
// 	if (!file) return
//
// 	app.vault.process(file, (data) => {
// 		// ── strip old numbering ───────────────────────────────────────────────
// 		const clean = (line: string) =>
// 			line
// 				.replace(/^(#) 第.*?章/g, '$1')
// 				.replace(/^(#|##|###) (\[\[.*?\|)\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2')
// 				.replace(/^(#|##|###) (\[\[.*?\])\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2')
// 				.replace(/^(#|##|###) (\[)\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2')
// 				.replace(/^(#|##|###) \d{1,2}\.?\d?\.?\d?\s+/u, '$1 ')
// 				.replace(/^(#|##|###) \d{1,2}\.?\d?\.?\d?\s+/u, '$1 ')
// 				.replace(/(?:I|II|III|IV|V|VI|VII|VIII|IX|X)、/g, '')
// 				.replace(/[①②③④⑤⑥⑦⑧⑨⑩] /g, '')
// 				.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
//
// 		const lines = data.split('\n').map((raw) => clean(raw))
// 		return lines.join('\n')
// 	})
// }
