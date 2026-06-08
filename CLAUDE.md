# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 常用命令

```bash
npm run dev       # 开发模式：esbuild watch + LESS watch 并发运行
npm run build     # 生产构建：TypeScript 类型检查 + esbuild 压缩打包
npm run version   # 版本号更新，同步写入 manifest.json 和 versions.json
```

无测试套件。ESLint 已配置（`.eslintrc`）但没有 npm 脚本，需要时直接运行 `npx eslint src/`。代码格式配置在 `.prettierrc.json`（Tab 缩进、90 字符行宽、单引号）。

> **构建注意**：`npm run build` 的 TypeScript 类型检查阶段会报 `suggest.ts` / `types.ts` 等文件的 Obsidian 类型缺失错误（预存在，非本项目引入），不影响 esbuild 出包。若只需快速验证能否编译，可直接运行：
> ```bash
> node_modules/.bin/esbuild src/main.ts --bundle --platform=node --external:obsidian "--external:@codemirror/*" --outfile=main.js --format=cjs
> ```

## 整体架构

这是一个 Obsidian 插件，入口为 `src/main.ts`，主类 `CyuToolkitPlugin extends Plugin`。`onload()` 注册所有子系统，各功能可通过设置项独立开关。

### 两种渲染上下文

所有功能都必须同时处理两种 Obsidian 渲染模式：

- **阅读模式** — 实现为 Markdown 后处理器，统一注册在 `src/obsidian/preview/registerPreviewProcessors.ts`
- **源码 / 实时预览模式** — 实现为 CodeMirror 6 编辑器扩展（ViewPlugin、StateField）

### 功能目录结构

```
src/cyu/               # 各功能的自包含模块
src/obsidian/
  preview/             # Markdown 后处理器（阅读模式）
  command/             # 热键命令（attachCommands.ts）
  codeblock/           # 自定义代码块处理器
src/setting/           # SettingData.ts（接口 + 默认值）、SettingTab.ts（设置 UI）
src/util/              # 共享工具函数
src/types/types.ts     # Obsidian API 类型补充（Vault、FoldInfo 等）
src/styles/            # 各功能的 LESS 文件，编译为 styles.css
```

### 核心模式

**MarkdownRenderChild** — 在阅读模式中操作 DOM 的功能继承此类（如 `ColorGallery`、`ClickCopyBlock`、`AnnotationChild`），由 Obsidian 管理生命周期（笔记关闭时自动注销）。

**CodeMirror 6 ViewPlugin** — 源码模式功能（时间标签、行内代码高亮、自动折叠）实现 `PluginValue`，通过 `registerEditorExtension()` 注册。

**设置项开关** — 大多数功能在注册前检查对应设置标志。Gallery 类功能还额外检查配置的文件路径（如 `settings.folder_color_gallery`）。

### 本插件处理的自定义语法

| 语法 | 功能 | 实现位置 |
|------|------|---------|
| `@{YYYY-MM-DD HH:MM:SS}` | 时间戳渲染 | `src/cyu/time-tag/`（CM6 ViewPlugin） |
| `cyu-annotation` 代码块 | SVG 箭头侧边注释 | `src/cyu/arrow-annotation/` + `src/obsidian/codeblock/` |
| 表头 `[width]` 前缀 | 列宽控制 | `registerPreviewProcessors.ts` |
| 表格首列标志（`-` `~` `x`） | 表格行样式 | `registerPreviewProcessors.ts` |

### 构建产物

esbuild 将 `src/main.ts` 打包为 `main.js`（CommonJS 格式）。Obsidian API 和所有 `@codemirror/*` 包均标记为 `external`，由 Obsidian 在运行时提供。LESS 文件通过 `scripts/build-less.js` 单独编译为 `styles.css`。

---

## Arrow Annotation 侧边注释组件

### 功能概述

在 Markdown 笔记中，可以将一个 `cyu-annotation` 代码块紧跟在任意内容块（段落、列表、代码块、图片等）后面，插件会在该内容块两侧渲染浮动注释标签，并用 SVG 箭头连接标签与被注释的目标文字或目标行。

### 语法

````markdown
这是一段需要注释的文字，其中有一个关键词。

```cyu-annotation
right "关键词" 这是右侧注释
left #2 第二行的左侧注释
> 整块注释（无引号 = 指向整块）
```
````

**规则行格式：**

```
<side> "<match>" [#<index>] <label>   # 双引号 → 块级（栏外）注释
<side> '<match>' [#<index>] <label>   # 单引号 → 行内注释（紧贴文字旁）
<side> [#<index>] <label>             # 无引号 → 整块模式，指向整个目标块
```

- `side`：`left` / `right` / `l` / `r` / `<` / `>`
- `match`：目标文字，留空则按行号定位
- `#index`：第几次出现（1-based，支持负数），默认为第 1 次
- `label`：注释内容，支持 inline Markdown，可换行续写
- `#` 开头的行为注释行，会被忽略

### 三种展示模式（`AnnotationDisplay`）

| 模式 | 触发方式 | 布局 |
|------|---------|------|
| `block` | 双引号 `"match"` | 标签绝对定位在目标块两侧的固定列中，多个标签用 flex 垂直排列，不重叠 |
| `inline` | 单引号 `'match'` | 标签绝对定位，Y 坐标与被注释文字对齐，多个标签按 Y 值排序后防重叠间距处理 |
| `whole` | 无引号（不带 match） | 箭头指向整个目标块的中心，标签在侧列中 |

### 数据流与文件职责

```
registerCodeblockProcessors.ts   ← 注册 codeblock，追踪"上一个块"
        ↓ new AnnotationChild(prevEl)
AnnotationChild.ts               ← 生命周期管理、DOM 布局构建
        ↓ parseAnnotationBlock(src)
annParser.ts                     ← 将代码块文本解析为 AnnotationRule[]
        ↓ findTextRect / findLineEndRect / ...
annRanger.ts                     ← 用 TreeWalker + Range API 精确定位目标文字的 DOMRect
        ↓ renderArrows(wrapper, targets)
annRenderer.ts                   ← 用 SVG + rough.js 绘制箭头和高亮标记
```

**`annCommand.ts`** — 提供两个编辑器命令（左/右方向），将光标处选中文字包裹为 `cyu-annotation` 代码块并插入到下方第一个空行。

### DOM 布局策略

`AnnotationChild.buildLayout()` 不改变目标块在文档流中的位置，而是：

1. 在目标块外套一层 `<div class="annotation-wrapper">` 作为相对定位上下文
2. 块级注释标签（`block` / `whole`）放入 `annotation-col--left` / `annotation-col--right` 列中，用 flex 列布局自然撑开不重叠
3. 行内注释标签（`inline`）直接挂在 wrapper 上，由 `positionInlineLabels()` 用绝对定位按 Y 坐标对齐到对应行
4. SVG 覆盖层（`annotation-svg-overlay`）绝对定位叠在 wrapper 上，覆盖范围 `overflow: visible`

`onunload()` 会将目标块从 wrapper 中还原到 wrapper 之前，再移除 wrapper，确保 Obsidian 重新触发后 DOM 结构是干净的。

### 目标块追踪机制（prevEl）

代码块处理器（`registerMarkdownCodeBlockProcessor`）本身无法获取"上一个块"，因此采用双处理器方案：

- **优先级 -100 的全局后处理器**：每次渲染一个普通块时，将 `el` 写入 `lastBlockRegistry: Map<sourcePath, HTMLElement>`
- **优先级 100 的 cyu-annotation 处理器**：执行时从 registry 取出 `prevEl`，传给 `AnnotationChild`

`layout-change` 事件触发时清理已关闭笔记的 registry 条目，防止 stale 引用。

### 文字定位（annRanger.ts）

所有定位都通过 `document.createRange()` 和 `.getBoundingClientRect()` 实现，不依赖 CSS 类名或 DOM 结构假设：

- `findTextRect(root, matchText, matchIndex)` — TreeWalker 收集所有文本节点，拼成 flatText，用 `indexOf` 找第 N 次出现，再将全局偏移映射回具体节点 + 偏移量，创建 Range 取矩形
- `findLineEndRect / findLineStartRect` — 按行号（`\n` 计数）遍历文本节点，定位行首/行尾字符位置
- `findLineEndRectByText / findLineStartRectByText` — 结合文本匹配与行首/行尾查找，用于 inline 模式定位标签的 X 坐标

矩形均为视口坐标（viewport-relative），传给 renderer 前会通过 `toLocal(containerRect, x, y)` 转为相对于 wrapper 的本地坐标。

#### `buildBlockTextMap` 的空白节点处理（重要）

`buildBlockTextMap` 是所有定位函数的基础，它把目标块的碎片化 Text 节点线性化为 `flatText`。

**两类需区分的空白节点：**

| 类型 | 位置 | `getBoundingClientRect()` | 处理方式 |
|------|------|--------------------------|---------|
| HTML 格式化空白 | `<div>`/`<ul>`/`<li>` 等块级元素之间 | 全零（无视觉坐标） | **跳过** |
| 代码内容空白 | `<code>`/`<pre>` 内部（`\n`、缩进） | 有视觉高度，非零 | **保留** |

若把代码块内的 `\n` 也过滤掉，`flatText` 将没有换行符，所有 `lineStartOffset(N)`（N≥2）均返回 `flatText.length`，导致第 2 行起所有注释都打到最后一行。

**实现机制：**

- `BLOCK_TAGS_FOR_SEPARATOR`：块级标签集合（P、LI、H1–H6、BLOCKQUOTE、TR、TD、TH、DD、DT）
- `nearestBlockAncestor(node, root)`：向上查找最近块级祖先；不同块级祖先之间切换时在 `flatText` 注入虚拟 `\n`，使 callout/列表等 HTML 结构化内容能正确计行
- `isInsidePreformattedContext(node, root)`：向上检查是否有 `<code>/<pre>` 祖先；在预格式化上下文内的空白节点不过滤

过滤条件：`content.trim() === '' && !isInsidePreformattedContext(node, root)` → 跳过。

#### 已知适配问题与修复历史

**Bug 1（已修复）— callout 目标块：行内注释标签定位到屏幕左下角（top≈-167px, left≈-234px）**

- 根因：callout HTML 中 `<ul>`/`<div>` 元素之间存在真实的 `\n` 文本节点（HTML 格式化产物）。这些节点的 `getBoundingClientRect()` 为全零。原始 `buildBlockTextMap` 将它们纳入 `nodes[]`，`lineEndOffset` 定位到这些节点后，`caretRectAt` 返回零 rect，最终 `relativeY = 0 - wrapperRect.top`、`relativeX = 0 - wrapperRect.left` → 标签飞到屏幕外。
- 修复：`buildBlockTextMap` 跳过 `content.trim() === ''` 的节点；行边界改由 `nearestBlockAncestor` 切换时注入虚拟 `\n` 标记。

**Bug 2（已修复）— 代码块目标块：第 2 行起所有注释均指向最后一行**

- 根因：Bug 1 的修复过于激进，将代码块内有语义的 `\n` 文本节点（Prism.js 分词后行间的独立 `\n` 节点）也一并过滤，`flatText` 无换行，所有行号 ≥ 2 的查询退回到 `flatText.length`。
- 修复：引入 `isInsidePreformattedContext`，过滤条件改为仅跳过**不在** `<code>/<pre>` 内的空白节点，保留代码块内的 `\n` 行分隔。

### 外观样式集（可在设置中切换）

注释外观完全由 CSS 变量驱动，提供 5 套预设样式，可在「设置 → Annotation 侧边注释 → 注释样式」下拉框中随时切换并实时生效（无需重新渲染笔记）。

| 样式 | 值 | 风格 |
|------|-----|------|
| 手绘 | `sketch`（默认） | 暖色手绘、斜体无底色，贴合纸张主题 |
| 便签 | `note` | 柔和卡片，带淡底色 / 细边框 / 轻投影 |
| 简约 | `minimal` | 无衬底、无旋转、细线条 |
| 荧光 | `marker` | 荧光笔底色，醒目圆润 |
| 墨迹 | `ink` | 衬线斜体、深色墨水感 |

**实现机制：**

- 设置项 `annotation_style`（`SettingData.ts` 的 `AnnotationStyle` 联合类型，选项元信息在 `ANNOTATION_STYLES`）
- `CyuToolkitPlugin.applyAnnotationStyle()` 在 `<body>` 上挂 `cyu-ann-style-<name>` 类名（先清除旧的同前缀类名）。`onload` 时调用，下拉框 `onChange` 时再次调用实现实时切换，`onunload` 清除
- `src/styles/arrow-annotation.less` 中每个 `body.cyu-ann-style-<name>` 只重设一组 CSS 变量：标签外观（`--ann-color` / `--ann-bg` / `--ann-border` / `--ann-radius` / `--ann-padding` / `--ann-shadow` / `--ann-font-*` / `--ann-rotate` 等）、悬浮激活（`--ann-active-color/bg/shadow`）、以及 SVG（`--annotation-arrow-color` / `--annotation-arrow-active-color` / `--annotation-highlight-color`）
- 变量定义在 body 上，借 CSS 自定义属性的继承级联同时作用于标签 DOM 与 SVG 箭头层。结构 CSS（`.annotation-label` 等）只消费变量并带回退值
- 颜色多用 `color-mix(in srgb, var(--text-accent) … )` 与主题变量混合，自动适配明 / 暗与各类主题
- 行内标签旋转角度在 `AnnotationChild.positionInlineLabels` 中写成 `rotate(var(--ann-rotate, 1deg))`，使简约风可取消倾斜

### SVG 绘制（annRenderer.ts）

`renderArrows(container, targets)` 为每条规则绘制一个 `<g class="ann-group">`：

**高亮标记**（根据 `highlightType` 选择）：

| `highlightType` | 触发条件 | 绘制方式 |
|----------------|---------|---------|
| `circle` | match 文字 < 9 字符 | rough.js 手绘椭圆，参数由 `hashString(seed)` 确定，保证重绘结果一致 |
| `wave` | match 文字 9–79 字符 | 三次贝塞尔波浪线，绘制在文字下方 3px 处 |
| `none` | match 文字 ≥ 80 字符或行模式 | 无高亮，箭头直接指向行首/行尾 |
| `whole` | 整块模式 | 无高亮，箭头指向块中心 |

**连线**：

- 水平距离 ≤ 200px（`BREAK_THRESHOLD`）：整条贝塞尔曲线，`seededJitter` 加入微扰模拟手绘感
- 水平距离 > 200px（远距离）：标签侧渐隐短线（stub）+ 目标侧固定长度短箭头，两段分离，视觉上表示"跨越距离"

**Hover 联动**（`setupHover`）：标签 DOM 和 SVG 高亮元素共享一个引用计数器，任意一侧 `mouseenter` 触发时，整组 `ann-group` 切换 `.active` 类，箭头 marker 切换为 `--active` 变体颜色，标签容器及其直接子元素切换 `.ann-label-active` / `.ann-label-active-inner`。

### 文件变化实时更新

`AnnotationChild` 监听 `editor-change` 事件（每次击键触发），通过 500ms 防抖的 `scheduleReload()` 重绘注释层。reload 时调用 `onunload()` 还原 DOM，再重新找 prevEl 并执行 `buildLayout()`。双 `requestAnimationFrame` 确保布局计算时 DOM 已完成绘制。`ResizeObserver` 监听 wrapper 尺寸变化，侧栏拖拽或窗口缩放时自动重绘。
