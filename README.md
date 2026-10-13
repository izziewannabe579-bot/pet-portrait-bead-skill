# 宠物手绘头像与拼豆图纸 Skill

从宠物照片与用户风格参考制作手绘水粉头像，再从指定插画输出默认 **52×52、复杂版、自由 RGB 不限色** 的拼豆设计。

包含手绘与英伦风指导、表情/五官要求，以及独立的 Node.js 制图工具。无需安装其他拼豆 skill，不含本机路径、图像生成 API 密钥或第三方品牌色表。原始照片、风格图和历史作品不在公开仓库中，请自行提供有权使用的参考。

## 安装

将仓库作为名为 `pet-portrait-beads` 的文件夹克隆到 Codex skills 目录；以下为默认位置，有自定义 CODEX_HOME 时使用其 skills 子目录：

```sh
git clone https://github.com/izziewannabe579-bot/pet-portrait-bead-skill.git "$HOME/.codex/skills/pet-portrait-beads"
cd "$HOME/.codex/skills/pet-portrait-beads"
npm ci
npm test
```

若目标目录已存在，先检查现有内容，不覆盖；可将本仓库安装到另一个临时目录后比较。重新启动或新开支持 skill 的会话后调用：

> 使用 $pet-portrait-beads，参考这些照片和原始风格图，制作清楚保留神态的宠物手绘头像及 52×52 复杂版拼豆图纸。

只要求插画时不自动制图。头像生成依赖所在环境提供的图像生成工具；本 skill 不是独立图像生成模型。

## 不经过 AI 的直接制图

```sh
node scripts/generate.cjs /absolute/path/portrait.png \
  --out /absolute/path/猫咪/猫咪_v1 --title "猫咪 · 手绘复杂版" --full-legend
```

输出编号施工图、52×52 导入 PNG、放大预览、JSON、完整 HEX/RGB 用量 CSV，以及可选分页图例。脚本拒绝覆盖已有输出；使用新的版本前缀。

编号是本图自定义颜色索引，**不是品牌豆色号**。不限色会产生很多 RGB 色值；真实购买和制作前如需品牌映射，必须另行生成明确的材料版。导入 PNG 是通用图片输入，不是拼好豆私有项目格式，未宣称测试过其内部映射行为。

## 结构与验证

- `SKILL.md`：skill 入口与路由。
- `references/portrait.md`：手绘笔触、参考输入、表情与复古配饰规范。
- `references/pattern.md`：颜色、背景、输出契约及校验。
- `scripts/generate.cjs`：不依赖本机已有 skill 的自由 RGB 制图。
- `scripts/test.cjs`：不强制限色、留空/白珠、图纸与 CSV、版本保护等回归测试。

Node.js 18+；sharp 为唯一直接依赖，版本由 lockfile 固定。包的 `private: true` 只防止误发布 npm，不代表 GitHub 仓库私有。仓库公开不代表拥有参考原图的著作权；本仓库不为未授权参考图片提供再分发许可。
