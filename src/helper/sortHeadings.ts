import { App } from 'obsidian'

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
export function sortHeadings(app: App): void {
	const file = app.workspace.getActiveFile()
	if (!file) return

	app.vault.process(file, (data) => {
		const H1_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
		const H2_LABELS = Array.from({ length: 20 }, (_, i) => `${i + 1}.`)
		const H3_LABELS = Array.from({ length: 20 }, (_, i) => `${i + 1}`)
		const H3_CIRCLE = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
		const SKIP_RE = /[✦★☆✧@]/

		let h1Count = 0
		let h2Count = 0
		let curH2Index = -1
		const h3Counters: number[] = new Array(10).fill(0)
		let insideCodeBlock = false
		let skipNextH3 = false

		// ── strip old numbering ───────────────────────────────────────────────
		const clean = (line: string) =>
			line
				.replace(/^(#) 第.*?章/g, '$1')
				.replace(/^(#|##|###) (\[\[.*?\|)\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2')
				.replace(/^(#|##|###) (\[\[.*?\])\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2')
				.replace(/^(#|##|###) (\[)\d{1,2}\.?\d?\.?\d?\s+/u, '$1 $2')
				.replace(/^(#|##|###) \d{1,2}\.?\d?\.?\d?\s+/u, '$1 ')
				.replace(/^(#|##|###) \d{1,2}\.?\d?\.?\d?\s+/u, '$1 ')
				.replace(/(?:I|II|III|IV|V|VI|VII|VIII|IX|X)、/g, '')
				.replace(/[①②③④⑤⑥⑦⑧⑨⑩] /g, '')
				.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')

		// ── heading patterns ──────────────────────────────────────────────────
		const H_PLAIN = /^(#{1,3}) (?!\[\[)(\[)?(.*?)]?$/
		const H_LINK = /^(#{1,3}) (\[\[)([^\|]+)$/
		const H_ALIAS = /^(#{1,3}) (\[\[.*?\|)(.*?)?$/

		const lines = data.split('\n').map((raw) => {
			if (/^```/.test(raw)) {
				insideCodeBlock = !insideCodeBlock
				return raw
			}
			if (insideCodeBlock) return raw

			const line = clean(raw)

			// H1
			if (/^# /.test(line)) {
				skipNextH3 = SKIP_RE.test(line)
				h2Count = 0
				const label = H1_LABELS[h1Count++]
				return addLabel(line, 1, label + '、')
			}

			// H2
			if (/^## /.test(line)) {
				if (SKIP_RE.test(line)) {
					skipNextH3 = true
					return line
				}
				skipNextH3 = false
				curH2Index = h2Count
				h3Counters[curH2Index] = 0
				return addLabel(line, 2, H2_LABELS[h2Count++] + ' ')
			}

			// H3
			if (/^### /.test(line) && curH2Index !== -1) {
				if (SKIP_RE.test(line)) return line
				if (h3Counters[curH2Index] >= 10) return line

				const idx = h3Counters[curH2Index]++
				const label = skipNextH3 ? H3_CIRCLE[idx] + ' ' : `${h2Count}.${H3_LABELS[idx]} `
				return addLabel(line, 3, label)
			}

			return line
		})

		return lines.join('\n')
	})
}

// ── helper ────────────────────────────────────────────────────────────────────

function addLabel(line: string, level: number, label: string): string {
	const hashes = '#'.repeat(level) + ' '
	// Insert label right after the hashes (before any [[ or [ or plain text)
	return line.replace(new RegExp(`^#{${level}} `), `${hashes}${label}`)
}
