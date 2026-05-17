import Hls from 'hls.js'

// --- 私有常量与内部正则 ---
const linkRegex = /^(.*\.m3u8)/ // 链接匹配
const timestampRegex = /#t=(\d+)(?:,(\d+))?/ // 时间戳匹配

/**
 * 获取视频源详情 (内部辅助函数)
 */
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

/**
 * 初始化 HLS 逻辑
 * @param videoElement 视频 DOM 元素
 * @param timestampMatch 时间戳正则匹配结果
 */
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

		// 只有在有时间戳需求时才挂载这些监听器
		const onLoadedMetadata = function () {
			videoElement.currentTime = startTime
			// 避免重复触发
			videoElement.removeEventListener('loadedmetadata', onLoadedMetadata)
		}

		const onTimeUpdate = function () {
			if (endTime !== null && videoElement.currentTime >= endTime) {
				videoElement.pause()
			}
		}

		videoElement.addEventListener('loadedmetadata', onLoadedMetadata)
		videoElement.addEventListener('timeupdate', onTimeUpdate)
	}

	if (Hls.isSupported()) {
		const hls = new Hls()
		hls.loadSource(details.src)
		hls.attachMedia(videoElement)
	} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
		// 兼容 Safari 原生播放
		videoElement.src = details.src
	}
}

/**
 * 暴露给外部的主方法：解析并初始化容器内所有 M3U8 视频
 * @param container 包含 video 标签的父级 DOM 元素
 */
export function parseM3u8Video(container: HTMLElement) {
	const videos = container.querySelectorAll('video')

	videos.forEach((videoElement) => {
		const details = getSourceDetails(videoElement)
		if (!details || !details.linkMatch) return

		initializeHLS(videoElement, details.timestampMatch)

		// 错误重试逻辑
		videoElement.addEventListener('error', () => {
			console.log(
				`[cyu-tool-kit] Error occurred in video: ${videoElement.src}. Retrying...`
			)
			initializeHLS(videoElement, details.timestampMatch)
		})
	})
}
