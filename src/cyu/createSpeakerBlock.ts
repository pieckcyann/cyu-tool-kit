const TTS_PROXY = 'https://tts-proxy.cyuhaonan.workers.dev/?url='

/**
 * Per-page cache of Audio objects keyed by word.
 * Lives as a module-level singleton so blobs survive re-renders.
 */
const audioCache = new Map<string, HTMLAudioElement>()

/**
 * Scans `container` for `[data-speaker]` elements, fetches TTS audio,
 * and attaches a 🔊 link that plays on hover.
 *
 * Call inside `registerMarkdownPostProcessor`.
 */
export async function createSpeakerBlock(container: HTMLElement): Promise<void> {
	const elements = container.querySelectorAll<HTMLElement>('[data-speaker]')
	if (!elements.length) return

	// Shared lock — only one word plays at a time across the whole page
	let isPlaying = false

	const tasks = Array.from(elements).map(async (el) => {
		const word = el.getAttribute('data-speaker')
		if (!word) return

		const playLink = createPlayLink()
		el.insertAdjacentElement('afterend', playLink)

		// Reuse cached audio if available
		if (!audioCache.has(word)) {
			await prefetchAudio(word)
		}

		playLink.addEventListener('mouseenter', () => {
			if (isPlaying) return
			const audio = audioCache.get(word)
			if (!audio) return

			isPlaying = true
			audio.currentTime = 0
			audio.volume = 1
			audio.play().catch((err: Error) => console.warn(`TTS play failed: ${err.message}`))
			audio.onended = () => {
				isPlaying = false
			}
		})
	})

	await Promise.allSettled(tasks)
}

// ── helpers ───────────────────────────────────────────────────────────────────

function createPlayLink(): HTMLAnchorElement {
	const a = document.createElement('a')
	a.href = 'javascript:void(0)'
	a.textContent = '🔊'
	a.style.cssText = 'margin-left:4px; text-decoration:none; cursor:pointer;'
	return a
}

async function prefetchAudio(word: string): Promise<void> {
	const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q=${encodeURIComponent(word)}&tl=en`
	const proxiedUrl = TTS_PROXY + encodeURIComponent(ttsUrl)

	try {
		const res = await fetch(proxiedUrl)
		if (!res.ok) throw new Error(res.statusText)
		const blob = await res.blob()
		audioCache.set(word, new Audio(URL.createObjectURL(blob)))
	} catch (err: any) {
		console.warn(`TTS prefetch failed for "${word}": ${err.message}`)
	}
}
