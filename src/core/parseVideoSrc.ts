import Hls from 'hls.js'

const linkRegex = /^(.*\.m3u8)/ // 链接
const timestampRegex = /#t=(\d+)(?:,(\d+))?/ // 时间戳，支持单个或多个时间值

function getSourceDetails(videoElement: HTMLVideoElement) {
	const sourceElement = videoElement.querySelector('source')
	if (!sourceElement) return null

	const src = sourceElement.src
	return {
		sourceElement,
		src,
		linkMatch: src.match(linkRegex),
		timestampMatch: src.match(timestampRegex),
	}
}

export function parseM3u8Video(container: HTMLElement) {
	container.querySelectorAll('video').forEach((videoElement) => {
		const details = getSourceDetails(videoElement)
		if (!details || !details.linkMatch) return

		initializeHLS(videoElement, details.timestampMatch)

		videoElement.addEventListener('error', () => {
			console.log(
				`[cyu-tool-kit] Error occurred in video: ${videoElement.src}. Retrying...`
			)
			initializeHLS(videoElement, details.timestampMatch)
		})
	})
}

function initializeHLS(
	videoElement: HTMLVideoElement,
	timestampMatch: RegExpMatchArray | null
) {
	const details = getSourceDetails(videoElement)
	if (!details) return

	let startTime: number = 0
	let endTime: number | null = null

	if (timestampMatch) {
		startTime = Number(timestampMatch[1])
		if (timestampMatch[2]) {
			endTime = Number(timestampMatch[2])
		}

		videoElement.addEventListener('loadedmetadata', function () {
			videoElement.currentTime = startTime
		})

		videoElement.addEventListener('timeupdate', function () {
			if (endTime !== null && videoElement.currentTime >= endTime) {
				videoElement.pause()
			}
		})
	}

	if (Hls.isSupported()) {
		const hls = new Hls()
		hls.loadSource(details.src)
		hls.attachMedia(videoElement)
	}
}
