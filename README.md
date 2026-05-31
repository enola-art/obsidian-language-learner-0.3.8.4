# Language Learner v0.3.3.5

Obsidian 语言学习插件，集阅读、查词、复习、统计于一体。

---

## 开箱即用

1. 将 `main.js`、`styles.css`、`manifest.json` 放入 Obsidian 插件目录：
   ```
   {vault}/.obsidian/plugins/obsidian-language-learner/
   ```
2. 重启 Obsidian，在设置中启用插件
3. 首次使用需配置 **Word Database Path**（建议 `word-db.md`）和 **词形变体数据库路径**（默认 `word-variants.md`）

---

## 核心功能

### 阅读模式

- 打开任意英文 Markdown 文件，点击右上角书本图标进入阅读模式
- 所有已学单词将高亮标记（Learning / Familiar / Known / Learned）
- 未学单词以灰色显示，点击可查询并添加
- 已学单词的变体形式（如过去式、复数）自动识别并反哺标记
- 桌面端支持 Ctrl+点击多选短语查询
- 键盘翻页：方向键 / Home / End

### 单词学习面板

- 输入单词自动从有道词典获取中英文释义
- 支持手动填写或修改含义、例句、笔记、标签
- 自动词形还原（如输入 `running` 自动识别为 `run` 的变体）
- 提交时自动生成并保存所有词形变体（过去式、过去分词、现在分词、第三人称单数、名词复数、比较级、最高级）
- 变体中文含义自动从有道词典查询填充

### 词形变体系统

**数据源分工：**
- ECDICT 词典 -- 提供单词有哪些变体形态（仅形态，不含含义）
- 有道词典 -- 提供单词及变体的中文含义
- 规则推导 -- ECDICT 未覆盖的规则复数（如 partnerships）由代码自动生成

**存储分工：**
- IndexedDB -- 单词主记录（expression / meaning_cn / meaning_en / status / tags）
- word-variants.md -- 词形变体独立存储（按变体类型组织，如 p=过去式, d=过去分词, i=现在分词, 3=第三人称单数, s=名词复数, r=比较级, t=最高级）
- word-db.md -- 单词文本数据库（三行一组：单词 / 英文释义 / 中文释义）

**空值处理：**
- Markdown 输出时空字段写入字面量"空"，防止解析串行

### 词典查询

- 选中文本或点击单词，自动查询有道、剑桥、沪江、句酷、DeepL 等多词典
- 支持发音（美式/英式）
- 支持弹窗模式

### 数据管理

- 单词列表支持按状态、考试级别（CET4/6、IELTS、TOEFL、GRE 等）筛选
- 级别分布面板（横向列表展示）
- 批量操作：更改状态、添加标签
- 支持 IndexedDB 导入导出
- 自动同步到 vault 备份（`.obsidian/langr-db.json`）

### 复习系统

- 生成符合 Obsidian Spaced Repetition 格式的复习卡片
- 支持美式/英式发音切换

---

## 设置项说明

| 设置 | 说明 | 默认值 |
|------|------|--------|
| Word Database Path | 单词文本数据库路径 | 空（需手动填写，如 `word-db.md`） |
| Review Database Path | 复习卡片文件路径 | 空 |
| 词形变体数据库路径 | 变体存储 Note 文件路径 | `word-variants.md` |
| Auto refresh | 提交时自动刷新文本数据库 | 开启 |
| Auto fill meanings | 添加单词时自动从词典填充中文含义 | 关闭 |
| Auto Lemmatize | 输入时自动还原词形 | 关闭 |
| Use Server | 使用独立后端服务器 | 关闭 |

---

## 词形变体文件格式 (word-variants.md)

```markdown
# Word Variants

## collaborate
- collaborated | d | 过去分词 | 合作;协作
- collaborating | i | 现在分词 | 合作;协作
- collaborates | 3 | 第三人称单数 | 合作;协作
- collaborations | s | 复数 | 合作;协作

## reimagine
- reimagined | d | 过去分词 | 重新构想;重新想象
```

格式：`- {变体拼写} | {类型标签} | {类型中文} | {有道中文含义}`

---

## 开发构建

```bash
npm install
npm run build
```

构建产物：
- `main.js` -- 插件主文件
- `styles.css` -- 样式文件

---

## 版本历史

### v0.3.3.5 (2026-05-21)

- 词形变体独立存储至 Note 文件（word-variants.md），与主表数据解耦
- 变体中文含义完全由有道词典查询填充，去除 ECDICT 拼接兜底
- Markdown 文本数据库空字段写入"空"，防止三行格式串位
- IndexedDB 新增 variant_refs 列，Schema 升级至 v2
- 有道 query 空结果时自动词形还原重试（复数变体查不回中文的修复）
- 原文变体点击跳转到原形单词
- 变体类型扩展到名词复数/比较级/最高级
- 级别分布 UI 优化为横向列表布局
- searchBasic 移除 error-typo 短路返回

### v0.3.3.2 (2026-05-20)

- 词形反哺系统：原文变体自动识别并标记
- ECDICT 词形变体数据集成
- VariantEntry 数据结构初版

### v0.3.3.1 (2026-05-14)

- 基础单词学习、阅读标记、词典查询功能
- ECDICT 词形变体反哺系统
- 考试级别标记与统计
- IndexedDB 本地存储 + vault JSON 备份

### v0.3.3

- 初始版本

---

## 许可

MIT License
