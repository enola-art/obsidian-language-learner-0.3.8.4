# Language Learner

**Obsidian 一站式语言学习插件**

语言学习插件 language-learner 基础操作可参见B站视频和原项目地址，本项目为在此基础续开发，

[中文](#中文) | [English](#english)

---

## 中文

一款为语言学习者打造的 Obsidian 插件，将阅读、查词、词汇管理、复习、使用统计全部整合在一个插件中。

### 功能特性

- **阅读模式** — NLP 引擎解析英文文本（句子/单词/短语分词），点击任意单词即可查词
- **词典查询** — 多词典支持（有道/剑桥/句酷/海词/DeepL），支持弹窗和面板两种模式
- **词汇管理** — 添加单词及释义、标签、状态追踪（忽略/学习/熟悉/已掌握/已学会）
- **学习面板** — 完整的词条 CRUD：提交、编辑、打标签、管理变体、自动词形还原
- **数据面板** — 可搜索数据表，级别分布（四六级/雅思/托福/GRE）
- **统计视图** — ECharts 驱动的词量与级别分布图表
- **考试词汇集成** — 基于 ECDICT 的考试级别标注（可选，设置中开关）
- **变体管理** — 词形变体追踪（如 considered → consider），支持规则推导生成
- **间隔重复** *(开发中)*
- **后端服务器模式** — 可选远程数据库，多设备同步

### 性能优化

插件采用多 bundle 懒加载架构，最小化启动时间：

| Bundle | 大小 | 加载时机 |
|--------|------|---------|
| `main.js` | ~1 MB | 启动时（核心） |
| `stat-bundle.mjs` | ~987 KB | 后台预加载（echarts） |
| `nlp-bundle.mjs` | ~47 KB | 首次解析文本时（NLP引擎） |
| 变体数据 | ~4 MB | 按需加载（开启时） |
| 考试词汇数据 | ~454 KB | 按需加载（开启时） |

> **提示：** 在设置中关闭「启用词性/变体功能」可获得最快启动速度（跳过约 4.5MB 数据加载）。

### 技术栈

- **Vue 3** + **Naive UI**（组件库）
- **Dexie.js**（IndexedDB 封装）
- **ECharts**（统计可视化）
- **unified / retext-english**（NLP 文本解析）
- **esbuild**（打包器，支持代码分割）
- **TypeScript** + **SCSS**

### 安装方式

1. 从 [Releases](https://github.com/enola-art/obsidian-language-learmer-0.2.8/releases) 下载最新版本
2. 解压到仓库的 `.obsidian/plugins/language-learner/` 目录
3. 在 设置 → 社区插件 中启用

也可通过 BRAT 插件安装。

### 从源码构建

```bash
cd obsidian-language-learner-0.3.3.5
npm install
npm run build
```

输出文件：`main.js`、`main.css`、`stat-bundle.mjs`、`nlp-bundle.mjs`

### 许可证

MIT

---

## English

An Obsidian plugin for language learners that combines reading, dictionary lookup, vocabulary management, review, usage tracking, and statistics in one seamless experience.

### Features

- **Reading Mode** — Parse English text with NLP (sentence/word/phrase segmentation), click any word to look it up
- **Dictionary Lookup** — Multi-dictionary support (Youdao, Cambridge, Jukuu, HJDict, DeepL) with popup or panel mode
- **Vocabulary Management** — Add words with meanings, tags, status tracking (ignore/learning/familiar/known/learned)
- **Learn Panel** — Full CRUD for expressions: submit, edit, tag, manage variants, auto-lemmatize
- **Data Panel** — Searchable data table with level distribution (CET4/CET6/IELTS/TOEFL/GRE)
- **Statistics View** — ECharts-powered word count & level distribution charts
- **Exam Vocab Integration** — ECDICT-based exam level tagging (optional, toggle in settings)
- **Variant Management** — Lemma variant tracking (e.g. considered → consider) with rule-based generation
- **Spaced Repetition** *(in development)*
- **Backend Server Mode** — Optional remote database server for multi-device sync

### Performance

The plugin uses a multi-bundle lazy-loading architecture to minimize startup time:

| Bundle | Size | Load Timing |
|--------|------|-------------|
| `main.js` | ~1 MB | On startup (core) |
| `stat-bundle.mjs` | ~987 KB | Background preload (echarts) |
| `nlp-bundle.mjs` | ~47 KB | On first text parse (NLP engine) |
| Variant data | ~4 MB | On demand (when enabled) |
| Exam vocab data | ~454 KB | On demand (when enabled) |

> **Tip:** Disable "Enable variant/POS features" in settings for fastest startup (skips ~4.5 MB of data loading).

### Tech Stack

- **Vue 3** + **Naive UI** (component library)
- **Dexie.js** (IndexedDB wrapper)
- **ECharts** (statistics visualization)
- **unified / retext-english** (NLP text parsing)
- **esbuild** (bundler with code splitting)
- **TypeScript** + **SCSS**

### Installation

1. Download the latest release from [Releases](https://github.com/enola-art/obsidian-language-learmer-0.2.8/releases)
2. Extract to `.obsidian/plugins/language-learner/` in your vault
3. Enable the plugin in Settings → Community plugins

Or install via BRAT (Beta Release Auto-Updating Tool).

### Build from Source

```bash
cd obsidian-language-learner-0.3.3.5
npm install
npm run build
```

Output files: `main.js`, `main.css`, `stat-bundle.mjs`, `nlp-bundle.mjs`

### License

MIT
