# 答辩展示网站 · 设计说明书（DESIGN.md）

> 本文是**唯一需求来源**。执行者（Codex/GPT）按本文实现；所有技术内容、数字、图片都已在 `public/` 中准备好，**禁止自行编写或修改任何技术数字/结论文字**，只能从 `public/data/content.json` 与 `public/data/parts.json` 读取并渲染。

## 0. 目标与使用场景
- 用途：大学课程《三维机械设计》PBL 项目答辩。答辩人在教室投影电脑（1920×1080，Chrome/Edge）上打开公网网址，**按答辩顺序点击各页面**讲解，并现场操作三维模型回答老师提问。
- 关键要求：①美观、专业、"国家自然科学基金申报书"式的严谨学术风格；②三维模型可交互（拖动滑块驱动真实机构运动、爆炸、点选零件看信息）；③所有材料（零件、图、视频、PPT、报告、源文件）都能在网站里一键打开或下载；④在中国大陆网络下可用：**不得引用任何外部 CDN / Google Fonts / 外部统计脚本**，所有依赖通过 npm 打包进产物。
- 部署：GitHub Pages 静态托管，路径形如 `https://<user>.github.io/<repo>/`，因此 **Vite `base: './'`**，所有资源用相对路径。

## 1. 技术栈与工程结构
- Vite 5 + 原生 JavaScript（ES modules，不用框架）+ `three`（npm 安装，使用 `three/examples/jsm/...` 中的 `GLTFLoader`、`OrbitControls`、`RoomEnvironment`）。
- 不引入 UI 框架；样式用一个 `src/styles.css`（CSS 变量）。可选：无。
- 目录：
```
答辩网站/
  index.html
  vite.config.js (base: './', build.outDir 'dist', assetsInlineLimit 0)
  package.json   (scripts: dev, build, preview)
  src/main.js    (路由 + 页面渲染)
  src/viewer.js         (三维查看器模块)
  src/pages/*.js        (每页一个渲染函数，可选)
  src/styles.css
  public/        (已准备好，勿改动其中文件；只读)
```
- 路由：hash 路由（`#/home`、`#/viewer` …），刷新保持当前页；浏览器前进/后退可用。

## 2. 视觉规范（与答辩 PPT 一致）
- 颜色：主色深蓝 `--deep:#163A70`，中蓝 `--mid:#2F5D9E`，浅底 `--pale:#E6EEF8`，强调橙 `--acc:#C8541B`，绿色 `--grn:#2E7D4F`，正文 `#222`，次要 `#6B7280`，页面背景 `#F5F7FB`，卡片白色带 1px `#D5DEEB` 边框与轻阴影。
- 字体：`"Microsoft YaHei","PingFang SC","Noto Sans SC","Source Han Sans SC",system-ui,sans-serif`；数字可用 `font-variant-numeric: tabular-nums`。
- 版式：左侧固定导航栏（宽 248px，深蓝底，白字，当前项左侧 4px 橙色竖条 + 浅色高亮）；导航项按"汇报顺序"编号（见 §3）。右侧内容区最大宽 1480px，内边距 32px。页面标题区：小号灰蓝"章节编号"+ 大号深蓝粗体标题 + 标题下 3px 橙色短线（与 PPT 一致）。
- "要点框"组件（NSFC 风格）：浅灰蓝底 `#F4F7FB`、左侧 6px 色条（深蓝/橙/绿可选）、粗体小标题、正文。
- 表格：表头深蓝白字，斑马纹 `#EEF2F8`，结果列可橙色高亮。
- 动效克制：页面切换 150ms 淡入；卡片 hover 轻微上浮。不要花哨渐变、不要 emoji。
- 适配：以 1920×1080 投影为主；≥1280 宽度正常显示；<900px 时导航收为顶部汉堡菜单（手机可浏览）。
- 顶栏右侧工具：「演示模式」按钮（进入浏览器全屏 `document.documentElement.requestFullscreen()`，并隐藏侧栏，此时 `←/→` 键在导航页之间切换）；页码指示 "3 / 13"。

## 3. 页面清单（导航顺序 = 答辩讲解顺序）
数据来源：`C = content.json`，`P = parts.json`。图片路径均为 `public/` 下相对路径（如 `img/R2_work_scene.jpg`）。所有图片可点击打开 **灯箱**（全屏查看、滚轮缩放、拖拽平移、Esc 关闭、左右键切换同组图片）。

| # | 路由 | 导航名 | 内容 |
|---|---|---|---|
| 0 | `#/home` | 封面 | 左侧大标题 `C.meta.title`、副标题、选题/关键词标签、组号成员占位；右侧大图 `img/R1_hero_studio.jpg`（或 R4 果园图轮播，5 s 淡入淡出，R4→R2→R1）；底部 8 个统计卡 `C.stats`（大数字+单位+说明）；三个主按钮：「交互三维模型」→viewer，「播放演示视频」→media，「答辩幻灯片」→slides。再下方"汇报提纲"7 项 `C.outline`（编号方块+标题，点击跳对应路由）。 |
| 1 | `#/requirements` | 一 作业问题与需求 | 驱动性问题要点框 `C.problem.question`；约束 5 条（两列卡片）；`C.problem.note` 灰色小字；12 项指标表 `C.indicators`（列：#、需求、技术指标、验证方法、结果、状态；状态 true 显示绿色"✔ 已验证"，false 显示橙色"待测"）；配图 `img/R2_work_scene.jpg`。 |
| 2 | `#/scheme` | 二 总体方案 | 功能链图 `C.diagrams.chain`（宽幅）；方案比较表 `C.schemes.rows`（方案 A 列高亮）；评分表 `C.schemes.criteria`（列：准则、权重、A、B、C；最后加一行"加权总分"由数据计算 Σw·score，结果应为 8.05/7.00/5.55，若不一致说明数据有误，直接显示计算值）；雷达图 `C.diagrams.radar`；取舍理由要点框 `C.schemes.reasons`；技术路线图 `C.diagrams.route`。 |
| 3 | `#/mechanisms` | 三 关键机构 | 顶部三个标签页（剪叉升降 / 2R 关节臂 / 末端夹爪）对应 `C.mechanisms[i]`：左侧"计算依据"要点框列出 `formulas`（等宽字体渲染公式行），下方 `points` 列表；右侧图片 `img[]` 堆叠。每个标签页右上角按钮「在三维模型中查看」→ 跳转 viewer 并预设（lift: θ=55；arm: 视角 iso；gripper: 隔离"末端夹爪"组并聚焦）。 |
| 4 | `#/control` | 四 感知与控制 | 传感器布置图 `img/C8_sensor_layout.jpg` + 传感器表 `C.sensors` + `C.sensor_note`；状态机图 `C.diagrams.state`；状态流程条（`C.states` 8 个状态横向箭头链，当前悬停高亮）；异常处置表 `C.anomalies`；控制流程图 `C.diagrams.flow`。 |
| 5 | `#/viewer` | 五 交互三维模型 | **核心页面，详见 §4。** |
| 6 | `#/parts` | 五 零件库 | `P.parts` 44 种零件卡片网格（缩略图 `thumb`、中文名 `cn`、文件名 `part`、数量 `qty`、材料、质量 g、包络 mm）；顶部按子系统 `group` 过滤（全部/移动底盘/剪叉升降/升降平台/机械臂/视觉桅杆/末端夹爪）+ 搜索框（中英文名）；点击卡片弹出详情对话框（大缩略图 + 全部属性 + 「在三维模型中定位」按钮 → 跳 viewer 并选中该零件的第一个实例、隔离显示其所在组、相机聚焦）。 |
| 7 | `#/drawings` | 五 工程图与装配 | `C.drawings` 6 张图卡片网格（标题+图），点开灯箱；`C.validation` 验证表（干涉/配置/一致性）。 |
| 8 | `#/analysis` | 五 验证分析 | 有限元汇总表 `C.fea`（零件、工况、单元数、自由度、σmax、99.5%分位、位移μm、安全系数 n；n 列橙色）；点击行在下方大图区显示该零件云图 `img`；网格收敛表 `C.convergence` + 图 `C.diagrams.conv`；方法与局限要点框 `C.fea_notes`；稳定性：`img/A3_lift_tipping.jpg`、`C.diagrams.mass` + 三个数字卡（整机 `C.stability.mass_kg` kg、横向最小临界角 `tip_lat_min`°、纵向 `tip_lon_min`°）+ `note`；工作空间图 `img/A5_workspace.jpg`。 |
| 9 | `#/gallery` | 六 渲染与创新点 | 渲染图画廊 `C.renders`（第一张大图，其余缩略条，点击切换主图 + 灯箱）；创新点 4 张卡 `C.innovations`（编号方块"创新点 1..4"深蓝/中蓝交替 + 标题 + 正文）。 |
| 10 | `#/media` | 六 演示视频 | `C.videos` 两个 `<video controls preload="metadata">`，16:9，带标题说明；第一个设为主视频大尺寸。 |
| 11 | `#/slides` | 答辩幻灯片 | 幻灯片播放器：`img/slides/s01.jpg … s30.jpg`（`C.slides.count`）；大图 + 底部缩略条（横向滚动，当前项橙框）；`←/→`、点击左右半区翻页；「全屏放映」按钮（对播放器元素 requestFullscreen，全屏时只显示幻灯片，黑底）；右上角「下载 PPT」→ `files/defense_slides.pptx`。 |
| 12 | `#/ai` | 七 AI、分工与改进 | AI 使用记录表 `C.ai`（环节、工具/用途、核验）；团队分工表 `C.team`（注明"成员信息由小组填写"）；甘特图 `C.diagrams.gantt`；改进方向表 `C.improvements`；结论要点框 `C.conclusion`（绿色条）。 |
| 13 | `#/downloads` | 资料下载 | `C.downloads` 列表：图标（按类型 pptx/pdf/docx/zip/step/glb/md 用纯 CSS 彩色徽章文字，不用图片字体）+ 名称 + 文件大小（运行时 `fetch(url,{method:'HEAD'})` 读 `content-length`，失败则不显示）+「下载」按钮（`<a download>`）；PDF 额外「在线阅读」（新标签打开）；`data/speech.md` 额外「查看讲稿」在弹窗中用简易 Markdown 渲染（标题/列表/表格/粗体，自行实现简单解析，不引第三方库亦可用 `marked`）。 |

## 4. 交互三维模型（`src/viewer.js`）——验收重点
### 4.1 数据
- `models/robot.glb`：95 个节点，名称 `inst_000 … inst_094`，与 `P.instances[i].id` 一一对应（顺序一致）。几何为 **SW/glTF Y-up，单位米**，已带顶点/面颜色（每个零件单色）。节点自身 matrix 为默认姿态（θ=32°，开口 65 mm，滚转 0°）。
- `data/kinematics.json`（**矩阵均为列主序 4×4，可直接 `new THREE.Matrix4().fromArray(a)`**）：
  - `thetas`：[12..55] 整数度；`gaps`：[40..90] 整数 mm。
  - `nonGripperCount = 58`：`P.instances` 中 `gripper=false` 的实例恰好是前 58 个（索引 0–57），`gripper=true` 的为 58–94（37 个）。
  - `lift[String(theta)]`：长度 58 的矩阵数组 → 非夹爪实例的世界矩阵。
  - `gripLocal[String(gap)]`：长度 37 的矩阵数组（按夹爪实例在 instances 中的出现顺序）→ 夹爪局部矩阵。
  - `mod`：夹爪安装矩阵（单个 4×4）。
  - 夹爪世界矩阵：`M = T(0, dh, 0) · MOD · R · gripLocal[gap][j]`，其中 `dh = 0.72*(sin(θ) − sin(32°))`（米，θ 用弧度计算），`R = wrist_static ? I : RotY(roll)`（`P.instances[i].wrist_static`；roll 为腕部滚转角，弧度，绕 **局部 Y 轴**，即 `new Matrix4().makeRotationY(roll)`）。
  - `explode`：长度 95 的 [x,y,z]（米，世界坐标），爆炸系数 k∈[0,1] 时最终矩阵 = `T(k·explode[i]) · M`。
  - `padsLocal`：`[[0.0225,0.0895,0],[-0.0225,0.0895,0]]`，分别是左软垫（part=`Grip_Pad_Left`）与右软垫（part=`Grip_Pad_Right`）**在各自实例局部坐标中的中心点**。果实中心 = ( M_left·[padsLocal[0],1] + M_right·[padsLocal[1],1] ) / 2，其中 M_left/M_right 为两软垫实例当前的最终世界矩阵（含爆炸平移时以不含爆炸的矩阵为准）。
  - θ/gap 为非整数时：取相邻两个整数表的矩阵做**逐元素线性插值**（误差可忽略）；或滑块步长就设为 1，任选其一（推荐插值，滑块 step=0.5）。
- 由于矩阵已是"世界矩阵"，加载 GLB 后把每个实例节点设为 `node.matrixAutoUpdate=false`，并确保它们的父节点为单位矩阵（GLB 根下直接是这些节点；若 GLTFLoader 包了一层 Scene，保持该层为单位即可），每次参数变化时 `node.matrix.copy(Mfinal)`；`node.matrixWorldNeedsUpdate = true`。

### 4.2 外观（"CATIA 实体 + 特征边"风格，不要游戏化）
- 背景：竖直渐变（上 `#66789E` → 下 `#EEF0F6`），可用全屏 CSS 背景 + `renderer.setClearAlpha(0)`。
- 材质：`MeshStandardMaterial`（metalness 0.15–0.35，roughness 0.45），使用 GLB 中的颜色；`RoomEnvironment` 生成 PMREM 环境光 + 一盏方向光 + 半球光；开启抗锯齿；色调映射 ACESFilmic、sRGB 输出。
- **特征边**：对每个 mesh 生成 `new THREE.EdgesGeometry(geometry, 28)`，用 `LineSegments`（颜色 `#14161c`，不透明度 0.85）作为该节点子对象（这样随节点矩阵移动）。提供开关"显示特征边"（默认开）。
- 地面：可选浅色网格 `GridHelper`（尺寸 2 m，间隔 0.1 m，透明度 0.25），放在模型最低点（约 y=-0.075）。开关"显示地面网格"。
- 右下角小坐标轴罗盘（独立小视口或 `AxesHelper` 叠加），标注 X/Y/Z。

### 4.3 控件（右侧面板，宽 340px，卡片分组）
1. **工位与姿态**：
   - 剪叉角 θ：滑块 12–55°（默认 32），旁边实时读数 `θ = 32.0°  平台升程 ΔH = 2·360·sinθ = 382 mm`（ΔH 实时计算，保留整数）。
   - 夹爪开口 s：滑块 40–90 mm（默认 65），读数 `s = 65 mm  曲柄角 φ = asin(s/140) = 27.7°`。
   - 腕部滚转：滑块 0–180°（默认 0）。
   - 预设按钮组：`低位 12°` `中位 32°` `高位 55°`；`开口 40` `65` `90`；每次点击用 600 ms 缓动动画过渡。
2. **爆炸视图**：滑块 0–100%（默认 0）+ 按钮「一键爆炸/复原」（1 s 动画）。
3. **显示**：六个子系统复选框（移动底盘/剪叉升降/升降平台/机械臂/视觉桅杆/末端夹爪，来自 instances.group，颜色小方块），「仅显示所选」隔离按钮、「全部显示」；开关：特征边、地面网格、半透明（所有零件 opacity 0.35 便于看内部）、显示果实。
4. **视角**：`轴测` `正视` `侧视` `俯视` `聚焦夹爪` 按钮（相机平滑过渡 700 ms）；「自动旋转」开关。
5. **演示动作**：按钮「▶ 播放采摘动作」：按时间线自动驱动（共约 14 s）：θ 12→32（3 s）→ s 90→65（2 s）→ roll 0→90（2 s，此后果实随夹爪）→ θ 32→12（3 s）→ 停留 2 s → 复位（2 s）。播放中显示当前阶段文字（"升降就位 / 柔顺夹持 / 旋拧分离 / 下降回收"）于画布左下角字幕条，可点击暂停。
- **果实**：红色球 `SphereGeometry(0.0325)`（直径 65 mm，`MeshPhysicalMaterial` 红色 clearcoat），默认显示在两软垫中点；采摘动作开始前果实固定在"θ=32、s=65、roll=0"时的软垫中点（即挂在枝上），旋拧阶段开始后跟随软垫中点。可加一条细绿色线段作为果梗（旋拧后隐藏）。

### 4.4 选取与信息
- 鼠标悬停零件：轮廓高亮（把该 mesh 的 emissive 设为 `#2F5D9E` 强度 0.35 即可）+ 光标提示中文名。
- 点击零件：选中（emissive 橙 `#C8541B` 0.45），左侧（或右侧面板顶部）"零件信息"卡显示：缩略图、中文名 `cn`、文件名 `part`、子系统、材料、质量、包络、同类数量 qty，按钮「隔离此零件」「在零件库中查看」。再次点击空白处取消选中。
- 左侧可折叠"结构树"面板：子系统 → 零件(×数量) → 实例，点击定位。

### 4.5 性能与健壮性
- 首次加载显示进度条（GLTFLoader onProgress）；kinematics.json 与 GLB 并行加载。
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`；窗口大小变化自适应；页面切走时暂停渲染循环（离开 viewer 时 `setAnimationLoop(null)`）。
- 支持 URL 参数预设：`#/viewer?theta=55&gap=90&roll=0&explode=0&iso=末端夹爪&select=inst_070`（供其他页面跳转使用）。

## 5. 验收标准（执行者自测后在 `ACCEPTANCE.md` 中逐条打勾并说明）
1. `npm run build` 无错误；`dist/` 可用 `npx vite preview` 打开；所有页面无控制台报错。
2. 网络面板中**没有任何外部域名请求**（仅同源）。
3. viewer：拖动 θ 时剪叉臂交叉转动、上平台与臂/夹爪整体升降，零件之间不出现明显错位；拖动开口时两夹指对称平动；滚转时只有腕部以上部件旋转；爆炸滑块各组分离；数字读数正确（θ=55 → ΔH=590 mm；s=40 → φ=16.6°）。
4. 点击零件显示正确信息；零件库"在三维中定位"可跳转并选中。
5. 幻灯片播放器 30 页可翻页与全屏；视频可播放；所有下载链接 200。
6. 1920×1080 下首页一屏内显示标题、主图与统计卡；900px 以下布局不溢出。
7. 所有中文文字来自 JSON，代码中除导航名/按钮名/界面标签外不出现技术数字（ΔH、φ 等实时计算公式除外）。

## 6. 禁止事项
- 不修改 `public/` 下任何已有文件；不删除文件。
- 不添加外部 CDN、字体、统计、广告；不写入任何个人信息。
- 不执行 git push、不部署（部署由验收方完成）。
