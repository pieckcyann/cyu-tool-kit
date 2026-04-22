/**
 * Wraps external `<img referrerpolicy>` elements in a `<span>` so they can
 * be styled/identified independently from internal Obsidian images.
 *
 * Skips:
 *  - Images already inside a `<span>`
 *  - Images with the `.banner-image` class (used by the Banners plugin)
 */
export function wrapExternalImages(container: HTMLElement): void {
	const imgs = container.findAll('img[referrerpolicy]') as HTMLImageElement[]

	for (const img of imgs) {
		if (img.classList.contains('banner-image')) continue
		if (img.parentNode instanceof HTMLSpanElement) continue

		const span = document.createElement('span')
		span.id = 'external-link-image'
		span.classList.add('image-embed')

		const src = img.getAttribute('src')
		const alt = img.alt

		if (src) span.setAttribute('src', src)
		if (alt) span.setAttribute('alt', alt.split('|')[1] ?? alt)

		img.parentNode?.insertBefore(span, img)
		span.appendChild(img)
	}
}
