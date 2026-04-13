# HistoryMap 历史地图

一款基于 Web 的互动历史地图应用，将中国史与世界史的重要事件可视化呈现在地图上，结合时间轴导航与 AI 讲解。

## 功能特性

- **互动地图**：基于 ECharts，展示中国及世界历史事件的地理位置与迁移路径
- **时间轴导航**：拖动时间范围，筛选公元前 2700 年至今的历史事件
- **事件详情**：点击地图标记，查看事件卡片，并可通过内置 AI 获取详细讲解
- **地理图层**：可叠加显示主要河流、山脉
- **人物关系**：显示历史人物之间的关联
- **分类筛选**：按"中国史"或"世界史"过滤事件，支持按历史人物筛选
- **AI 对话**：集成 OpenAI 兼容接口，为每个历史事件提供情境化讲解

## 技术栈

- **框架**：React 19 + TypeScript
- **构建**：Vite 6
- **UI**：MUI (Material UI) v6
- **地图**：ECharts 5
- **AI**：OpenAI SDK（兼容自定义 API 端点）
- **打包**：@yao-pkg/pkg（生成独立可执行文件）

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录，入口文件为 `dist/index_app.html`，支持以 `file://` 协议直接打开。

### 打包为独立可执行文件

```bash
npm run package
```

输出文件位于 `release/HistoryMap`（Windows 下为 `release/HistoryMap.exe`）。

## 配置 AI

在应用内点击右上角设置图标，填写：

- **API Base URL**：OpenAI 兼容接口地址（如 `https://api.openai.com/v1`）
- **API Key**：你的 API 密钥
- **模型名称**：如 `gpt-4o`、`deepseek-chat` 等

配置保存在浏览器 `localStorage` 中。

## 项目结构

```
src/
  components/       # UI 组件（地图、时间轴、事件卡片、设置对话框）
  data/             # 历史事件数据、常量、地理特征定义、人物关系
  utils/            # 地图加载、地理特征加载、AI 接口封装
  assets/geo/       # 随包内嵌的 GeoJSON 数据
public/             # 开发期静态资源
```

## 数据来源

地理数据（`china.json`、`world.json`、`rivers.json`、`mountains.json`）均为开放数据，历史事件内容参考人教版历史教材编写。

## 许可证

见 [LICENSE](LICENSE) 文件。
