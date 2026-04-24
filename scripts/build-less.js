const fs = require('fs')
const path = require('path')
const less = require('less')
const chokidar = require('chokidar')

const SRC_DIR = path.resolve(__dirname, '../src/styles')
const OUT_FILE = path.resolve(__dirname, '../styles.css')

// 递归读取所有 less
function getAllLessFiles(dir) {
	let results = []
	const list = fs.readdirSync(dir)
	list.forEach(file => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		if (stat && stat.isDirectory()) {
			results = results.concat(getAllLessFiles(filePath))
		} else if (file.endsWith('.less')) {
			results.push(filePath)
		}
	})
	return results
}

// 合并编译
async function build() {
	try {
		const files = getAllLessFiles(SRC_DIR)

		// 拼成一个入口 (避免多次编译)
		const content = files
			.map(f => `@import "${f.replace(/\\/g, '/')}";`)
			// .filter(f => !path.basename(f).startsWith('_')) // 过滤文件
			.join('\n')

		const output = await less.render(content, {
			filename: 'entry.less', // 需要给 less 一个虚拟入口
			compress: true, // 压缩
		})

		fs.writeFileSync(OUT_FILE, output.css)
		console.log('[less] built')
	} catch (e) {
		console.error('[less] error:', e)
	}
}

// 初次执行
build()

// 监听
chokidar.watch(SRC_DIR, { ignoreInitial: true })
	.on('all', () => {
		build()
	})