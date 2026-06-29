![Jumping Clawd](https://img.laosunwendao.com/skill-uploads/e70a2316aaa24c0e972fe920e89e260c.png)

# Jumping Clawd

Jumping Clawd 是一个基于 [WXT](https://wxt.dev/) 的浏览器扩展小游戏。它可以在当前网页上以遮罩层形式启动，也可以在空白页、新标签页等场景下打开独立游戏页。

## 开发环境

- Node.js `>=20.12.0`：WXT `0.20.26` 的要求。
- npm：项目使用 `package-lock.json` 锁定依赖版本。
- Chromium 系浏览器或 Firefox：用于加载开发版扩展。

首次拉取后安装依赖：

```bash
npm install
```

安装后 WXT 会通过 `postinstall` 自动生成 `.wxt/` 类型与运行时文件。这个目录是本地生成产物，不需要提交。

## 本地开发

启动 Chrome/Chromium 开发模式：

```bash
npm run dev
```

启动 Firefox 开发模式：

```bash
npm run dev:firefox
```

常用检查与打包命令：

```bash
npm run compile
npm run build
npm run build:firefox
npm run zip
npm run zip:firefox
```

开发阶段通常使用 `npm run dev` 即可，发布前再运行类型检查、构建和打包。

## 如何在此基础上开发

主要目录：

| 路径 | 作用 |
| --- | --- |
| `wxt.config.ts` | 扩展 manifest 配置，包括权限、图标、快捷键、可访问资源。 |
| `entrypoints/background.ts` | 后台脚本，负责响应扩展快捷键并打开游戏。 |
| `entrypoints/popup/` | 扩展弹窗 UI，包含开始/退出游戏和背景模糊设置。 |
| `entrypoints/page-game-overlay.ts` | 注入网页的遮罩层脚本，负责创建 iframe、消息通信、关闭游戏和页面背景处理。 |
| `entrypoints/game.html` | 游戏页 HTML，既用于独立页，也用于网页遮罩 iframe。 |
| `src/extension/` | 扩展侧通用逻辑，包括打开游戏、消息类型、背景模糊存储。 |
| `src/game/` | 游戏主体逻辑、动画、排行榜、DOM 引用、样式和参数配置。 |
| `public/icon/` | 扩展图标资源。 |

开发游戏玩法时，优先从这些文件入手：

- `src/game/config.js`：调整平台距离、跳跃节奏、角色尺寸、尖刺、蓄力条和挑战模式参数。
- `src/game/clawd-motion.js`：调整 Clawd 的跳跃姿态、拉伸、残影和手臂动画。
- `src/game/app.js`：处理游戏状态机、输入、碰撞、得分、复活和排行榜弹窗。
- `src/game/styles.css`：调整舞台、角色、平台、尖刺和游戏结束面板视觉样式。

开发扩展能力时，优先从这些文件入手：

- `src/extension/open-game.ts`：修改打开独立页或网页遮罩层的策略。
- `entrypoints/page-game-overlay.ts`：修改网页注入、遮罩行为、快捷键、iframe 通信和页面背景处理。
- `entrypoints/popup/main.ts`：修改弹窗按钮、状态和设置项。
- `wxt.config.ts`：新增权限、host permissions、快捷键或扩展资源。

排行榜逻辑在 `src/game/leaderboard.js`。当前代码使用 Supabase publishable key 直接从浏览器访问 REST API；如果更换 Supabase 项目或表结构，需要同步更新：

- `src/game/leaderboard.js` 中的 REST URL、publishable key 和表字段。
- `wxt.config.ts` 中的 `host_permissions`。
- Supabase 端的 RLS/权限策略，确保公开客户端只能执行预期读写操作。

## Git 与生成文件

应提交的开发环境和源码文件已经包含在仓库中：

- `package.json`、`package-lock.json`
- `wxt.config.ts`、`tsconfig.json`
- `entrypoints/`、`src/`、`public/`、`assets/`、`components/`
- `AGENTS.md`

不应提交的本地生成文件已经由 `.gitignore` 忽略：

- `node_modules/`
- `.wxt/`
- `.output/`
- `out/`
- `.env*`
- `.DS_Store`
- 本地编辑器配置

如果后续有必须随项目共享的 VS Code 推荐插件，可以新增 `.vscode/extensions.json`；其他 `.vscode` 本机设置默认不提交。
