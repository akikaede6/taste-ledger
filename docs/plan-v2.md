# 本地个人评分工具实施计划 v2

## Goal Description

在本仓库从零实现一款本地优先的个人评分工具，用于个人记录、评分和整理自己看过或听过的影视作品、Drama CD、音乐等内容。用户可以创建分类，在分类下维护作品名称、封面图片、短评、长评、评分维度、维度权重和最终评分；可以基于同一分类中的作品生成“从夯到拉”的排行；可以从作品页导出适合小红书封面的分享图或包含完整信息的长图；也可以把已经排好的排行榜导出为分享图片。

数据以本地 JSON 数据目录为唯一持久化来源，用户更换设备时可以直接拷贝数据文件夹完成迁移。首版优先覆盖 Android、Windows、macOS、Linux 客户端。iOS 客户端作为可选目标，不阻塞首版完成。实现过程需要建立真实 Git 历史，每个任务完成后提交一次 commit，并搭建 CI 流水线，最终能够通过流水线生成可交付产物。由于没有 Claude Code 额度，coding 类任务统一由 Codex 执行。

## Acceptance Criteria

每条验收标准都包含正向测试和反向测试，便于用 TDD 方式做确定性验证。

- AC-1: 本地 JSON 数据目录可以完整保存和恢复用户数据
  - Positive Tests (expected to PASS):
    - 新建分类、作品、评分、评论、排行和分享配置后，关闭并重新打开应用，所有内容保持一致。
    - 将数据目录复制到一个干净的应用实例后，应用可以读取并展示同一份数据。
    - JSON 文件包含 schema version，应用可以识别当前支持的数据结构版本。
    - 图片资源保存在同一数据目录下，跨设备复制后作品封面仍能正常显示。
  - Negative Tests (expected to FAIL):
    - JSON 文件缺少必需字段时，应用不得静默生成错误数据，必须给出可恢复的错误状态。
    - JSON 文件格式损坏时，应用不得覆盖原文件，必须保留损坏文件并提示用户处理。
    - 作品引用数据目录之外的临时图片路径时，不得作为可迁移数据保存。

- AC-2: 用户可以管理作品分类
  - Positive Tests (expected to PASS):
    - 用户可以创建、重命名、删除分类，例如“影视作品”“Drama CD”“音乐”。
    - 分类列表展示分类名称、作品数量和最近更新时间。
    - 删除分类前必须确认，并同步处理该分类下的作品、排行和分享导出引用。
  - Negative Tests (expected to FAIL):
    - 空名称或仅包含空白字符的分类不得保存。
    - 删除不存在的分类不得导致数据文件损坏。
    - 分类删除后不得留下正常 UI 可访问的孤立作品列表。

- AC-3: 用户可以在分类下管理作品资料
  - Positive Tests (expected to PASS):
    - 用户可以在指定分类下创建作品，并维护作品名称、封面图片、短评、长评和创建/更新时间。
    - 用户可以编辑作品资料，保存后列表页、详情页、排行页和分享图数据展示一致。
    - 用户可以删除作品，相关排行条目同步移除或标记为失效并可修复。
  - Negative Tests (expected to FAIL):
    - 作品名称为空时不得保存。
    - 作品引用了不存在的分类时不得进入正常列表，必须被识别为数据一致性问题。
    - 删除作品后，排行榜分享图不得继续导出该作品为有效条目。

- AC-4: 用户可以自定义评分维度、权重并生成最终评分
  - Positive Tests (expected to PASS):
    - 用户可以为分类或作品配置多个评分维度，例如剧情、演出、音乐、个人偏好。
    - 每个维度可以设置分数和权重，最终评分按 `sum(score * weight) / sum(weight)` 计算。
    - 修改任一维度分数或权重后，最终评分立即重新计算并持久化。
    - 权重总和不是 100 时仍可按权重比例正确计算。
  - Negative Tests (expected to FAIL):
    - 负权重、非数字权重、非数字分数不得保存。
    - 没有任何有效评分维度时，不得生成伪造的最终评分。
    - 无效评分不得进入排行排序和分享图数据。

- AC-5: 用户可以同时维护短评和长评
  - Positive Tests (expected to PASS):
    - 作品详情页同时支持短评和长评编辑，二者互不覆盖。
    - 作品封面分享图默认包含短评，不包含长评。
    - 作品长图导出可以包含长评，并保留换行段落。
  - Negative Tests (expected to FAIL):
    - 保存长评时不得截断已有文本。
    - 短评为空时，分享图不得出现空白占位文案。
    - 长评内容不得进入“长评以外内容”的封面图导出结果。

- AC-6: 用户可以在同一分类内创建和查看排行
  - Positive Tests (expected to PASS):
    - 用户可以为某一分类创建排行，并选择按最终评分、某一评分维度或手动排序生成“从夯到拉”的列表。
    - 排行只包含同一分类下的作品，且每个排行条目引用真实存在的作品。
    - 修改作品评分后，自动排行可以刷新并反映新顺序。
    - 手动排行保存后，重新打开应用仍保持手动顺序。
  - Negative Tests (expected to FAIL):
    - 排行不得包含其他分类下的作品。
    - 排行引用已删除作品时，不得崩溃，必须提示修复或自动移除无效条目。
    - 自动排行不得因为某个作品缺少最终评分而产生不可预测排序。

- AC-7: 作品页可以导出分享图片
  - Positive Tests (expected to PASS):
    - 用户可以从作品详情页选择导出“封面图”或“长图”。
    - 封面图包含作品名、封面图片、分类、最终评分、维度评分和短评，不包含长评。
    - 长图包含作品名、封面图片、分类、最终评分、维度评分、短评和长评。
    - 导出的图片在桌面和 Android 环境中都能保存到用户可访问的位置。
  - Negative Tests (expected to FAIL):
    - 没有保存权限或目标路径不可写时，应用不得显示导出成功。
    - 作品缺少封面图片时，导出流程仍可完成，但不得出现破损图片占位。
    - 导出失败不得污染 JSON 数据或生成半截的导出记录。

- AC-8: 排行榜可以导出为分享图片
  - Positive Tests (expected to PASS):
    - 用户可以从排行页导出当前排行榜图片。
    - 排行榜分享图包含分类名、排行名、排序标准、名次、作品名、最终评分或对应维度评分。
    - 当排行榜内容较长时，可以生成长图或分页图片，并保持名次连续。
    - 手动排行和自动排行的导出顺序与应用内显示顺序一致。
  - Negative Tests (expected to FAIL):
    - 排行为空时不得导出误导性的空榜图片，必须提示用户先添加作品。
    - 排行包含无效作品引用时，不得把失效条目作为正常作品导出。
    - 导出图片中的名次不得与当前排行顺序不一致。

- AC-9: 应用在 Android 和桌面端共享同一套核心数据逻辑
  - Positive Tests (expected to PASS):
    - Android、Windows、macOS、Linux 构建使用同一份数据模型、评分计算、排行生成、分享数据组装和 JSON 读写逻辑。
    - 至少一个 Android 构建和一个桌面构建可以通过基础冒烟测试。
    - 在任一平台生成的数据目录可以被另一个平台读取。
  - Negative Tests (expected to FAIL):
    - 平台专属路径不得成为唯一数据来源，用户必须能定位并复制数据目录。
    - 不得为了跨端同步引入云账号或远程服务作为首版必需依赖。
    - 任一平台不得使用与其他平台不兼容的数据格式。

- AC-10: 应用提供适合个人管理的基础前端体验
  - Positive Tests (expected to PASS):
    - 首屏展示分类入口和最近编辑作品。
    - 分类页支持浏览作品、按最终评分排序、进入排行页。
    - 作品详情页将资料、评分、评论、分享操作组织在清晰的编辑流程中。
    - 排行页提供排序方式、手动调整、导出图片等入口。
  - Negative Tests (expected to FAIL):
    - 作品较多时，列表不得因为单个长评或长标题导致布局重叠。
    - 保存失败时，界面不得表现为已保存状态。
    - 分享导出进行中不得允许重复触发导致多个冲突写入。

- AC-11: 核心行为有自动化测试覆盖
  - Positive Tests (expected to PASS):
    - 数据模型、JSON 读写、评分计算、排行生成、作品分享数据组装、排行榜分享数据组装都有单元测试。
    - 至少覆盖分类创建、作品创建、评分更新、排行刷新、数据重载、分享导出的端到端或集成测试。
    - 本地测试命令可以一次性运行核心测试套件。
  - Negative Tests (expected to FAIL):
    - 缺少关键字段、非法权重、跨分类排行引用、损坏 JSON、空排行榜导出等异常输入必须有失败用例。
    - 测试不得依赖开发者机器上的固定绝对路径。
    - 测试不得只验证 UI 快照而缺少核心数据规则断言。

- AC-12: 项目有可审计的 Git 历史
  - Positive Tests (expected to PASS):
    - 仓库被初始化为 Git 仓库，并包含清晰的 `.gitignore`。
    - 每个任务完成后都有独立 commit，commit message 能对应任务目标。
    - 每次 commit 前，本任务相关测试或可运行检查已经通过，并在 commit 说明或任务记录中体现。
  - Negative Tests (expected to FAIL):
    - 多个不相关任务不得合并为一个大 commit。
    - commit 不得包含与当前任务无关的临时产物、构建缓存或本地密钥。
    - 不得在实现完成后伪造无法反映真实开发顺序的无意义历史。

- AC-13: CI 流水线可以验证并生成最终产物
  - Positive Tests (expected to PASS):
    - CI 至少包含格式检查、静态分析、自动化测试和构建任务。
    - CI 可以在目标平台矩阵中生成 Android 和桌面端产物，产物以 artifact 形式保存。
    - 失败的测试、分析错误或构建错误会让流水线失败。
    - CI 支持手动触发最终产物构建。
  - Negative Tests (expected to FAIL):
    - CI 不得依赖开发者本机绝对路径或未记录的本地环境。
    - 测试失败时不得继续发布成功产物。
    - 构建产物不得把用户本地数据目录、密钥或缓存文件打包进去。

## Path Boundaries

路径边界用于限定可接受的实现质量、范围和技术选择。

### Upper Bound (Maximum Acceptable Scope)

实现一个可实际日常使用的跨平台本地应用：包含 Android、Windows、macOS、Linux 构建；完整的分类、作品、图片、短评、长评、评分维度、权重、最终评分、排行、作品分享图导出和排行榜分享图导出；具备 JSON schema version、数据目录迁移说明、损坏数据保护、自动化测试、清晰 Git 历史和 CI 构建产物。iOS 可以完成技术预留或实验性构建，但不上架流程不属于首版范围。

### Lower Bound (Minimum Acceptable Scope)

实现一个本地可运行的首版应用：使用同一套核心逻辑支持 Android 和至少一个桌面平台；能够创建分类和作品，维护图片、短评、长评、评分维度和权重，计算最终评分，生成分类内排行；能够以 JSON 数据目录保存和恢复；能够导出作品封面图、作品长图和排行榜图片；核心计算与数据读写有自动化测试；仓库有逐任务 commit；CI 能运行检查并生成至少 Android 和一个桌面平台的构建产物。

### Allowed Choices

- Can use: Flutter/Dart 作为推荐跨平台方案；本地 JSON 文件；应用可访问的数据目录；本地图片复制策略；单元测试、组件测试、集成测试；必要的图片渲染/保存库；平台权限插件；GitHub Actions、Gitea Actions、GitLab CI 或其他可运行的 CI 系统。
- Can use: 其他能同时覆盖 Android 和 Windows/macOS/Linux 的单代码库方案，但必须维持本地 JSON 数据目录和跨平台数据兼容。
- Can use: CI 矩阵分别在 Linux、Windows、macOS runner 上构建对应桌面产物。
- Cannot use: 云后端、账号体系、远程数据库或订阅同步作为首版必需能力。
- Cannot use: 只支持 Web 或只支持桌面端的方案来替代 Android 和桌面客户端目标。
- Cannot use: 将用户数据只存放在不可直接迁移的私有位置，且不提供导出或复制数据目录的能力。
- Cannot use: 把 iOS 上架、社交平台自动发布、多人共享、推荐算法或 AI 生成评论纳入首版必需范围。
- Cannot use: 跳过 Git 历史要求，以单次提交交付全部实现。
- Cannot use: 依赖未记录的本机环境手动生成最终产物来替代 CI。

## Feasibility Hints and Suggestions

> **说明**：本节只作为理解和落地参考，是概念性建议，不是强制实现要求。

### Conceptual Approach

推荐使用 Flutter 建立跨平台应用，并将领域逻辑与界面、平台文件能力分离：

```text
app/
  core/
    models: Category, Work, RatingDimension, Ranking
    services: scoring, ranking, validation
    storage: JSON repository, atomic file writer, schema migration
    export_data: work share payload, ranking share payload
  features/
    categories: 分类列表与编辑
    works: 作品列表、详情、编辑
    rankings: 分类内排行与手动排序
    sharing: 作品封面图、作品长图、排行榜图片导出
  platform/
    data directory resolver
    image picker / file picker
    image save permissions
```

建议数据目录保持简单、可复制：

```text
ranking-data/
  library.json
  images/
    <image-id>.<ext>
  exports/
    works/
      <generated-work-share-image>.png
    rankings/
      <generated-ranking-share-image>.png
```

`library.json` 可以包含：

```json
{
  "schemaVersion": 1,
  "categories": [],
  "works": [],
  "rankings": [],
  "exportSettings": {}
}
```

评分计算建议作为纯函数实现，避免和 UI 状态耦合：

```text
validDimensions = dimensions with numeric score and positive weight
if validDimensions is empty: finalScore = null
else finalScore = sum(score * weight) / sum(weight)
```

排行榜导出建议复用排行服务的排序结果，而不是在导出模块重新排序。作品分享图和排行榜分享图可以共用一个渲染边界组件，但数据组装应分别测试，避免长评误入封面图或排行榜顺序与页面展示不一致。

JSON 写入建议使用临时文件加原子替换，降低写入中断导致主数据文件损坏的风险。图片建议复制到数据目录中的 `images/`，作品只保存相对路径或图片 ID，便于整个数据目录跨设备移动。

Git 历史建议使用“一个任务一个 commit”的节奏：每个任务开始前确认工作区状态，任务完成后运行相关检查，提交后再进入下一个任务。CI 建议先建立轻量检查，再逐步扩展到平台构建矩阵，避免最后一次性补流水线时暴露过多环境问题。

### Relevant References

- `draft.md` - 原始产品需求草稿。
- `docs/plan.md` - 已存在的上一版计划。
- `docs/plan-v2.md` - 本实施计划。
- `.github/workflows/` - 如果选择 GitHub Actions，建议的 CI 配置目录，当前尚未创建。
- `lib/` - 建议的 Flutter 应用源码目录，当前尚未创建。
- `test/` - 建议的单元测试和组件测试目录，当前尚未创建。
- `integration_test/` - 建议的跨流程测试目录，当前尚未创建。

## Dependencies and Sequence

### Milestones

1. 仓库与项目骨架：建立可追踪、可运行的基础
   - 初始化 Git 仓库和 `.gitignore`。
   - 初始化跨平台应用项目、测试框架和基础目录结构。
   - 建立第一版 CI 配置，至少运行格式检查、静态分析和测试占位。
   - 完成后提交骨架 commit。

2. 技术验证：确认跨平台、数据目录和导出能力可行
   - 验证 Android 和一个桌面平台可以启动同一应用。
   - 验证数据目录定位策略，确保用户可以找到并复制数据目录。
   - 验证图片选择、图片保存、分享图渲染的基础能力。
   - 完成后提交技术验证 commit。

3. 领域模型与本地存储：先稳定数据合同
   - 定义分类、作品、评分维度、排行、导出设置和分享导出所需的数据模型。
   - 实现 JSON 序列化、schema version、校验、损坏文件处理和原子写入。
   - 添加数据读写和异常输入测试。
   - 完成后提交存储 commit。

4. 分类与作品管理：实现个人资料库核心流程
   - 实现分类列表、分类编辑、作品列表和作品详情。
   - 支持作品图片、短评、长评和基础编辑状态。
   - 确保保存失败、删除确认和无效引用有明确 UI 状态。
   - 完成后提交资料库 commit。

5. 评分与排行：实现核心评价能力
   - 实现评分维度、权重编辑和最终评分计算。
   - 实现分类内排行，支持按最终评分、单一维度和手动顺序。
   - 添加评分计算、排行刷新、跨分类引用拒绝测试。
   - 完成后提交评分排行 commit。

6. 分享图导出：实现作品和排行榜输出能力
   - 定义作品封面图、作品长图和排行榜图片的数据组装规则。
   - 实现图片渲染、预览、保存和权限错误处理。
   - 添加无封面、无短评、长评换行、空排行榜、长排行榜等导出测试。
   - 完成后提交分享导出 commit。

7. CI 产物与收尾：确保首版可迁移、可测试、可打包
   - 扩展 CI 矩阵以构建 Android 和桌面端产物。
   - 运行核心测试套件和构建冒烟测试。
   - 编写本地数据目录位置、手动迁移说明和构建产物说明。
   - 整理首版不包含 iOS 上架和云同步的边界说明。
   - 完成后提交 CI 与文档 commit。

## Task Breakdown

每个任务必须且只能包含一个路由标签：

- `coding`: 由 Codex 执行实现
- `analyze`: 由 Codex 执行分析

| Task ID | Description                                                                              | Target AC                    | Tag (`coding`/`analyze`) | Depends On     |
| ------- | ---------------------------------------------------------------------------------------- | ---------------------------- | ------------------------ | -------------- |
| task1   | 初始化 Git 仓库、`.gitignore`、跨平台项目骨架、测试命令和基础目录结构，并提交首个 commit | AC-9, AC-11, AC-12           | coding                   | -              |
| task2   | 评估 Flutter 桌面和 Android 文件目录、权限、图片保存、分享图渲染能力                     | AC-1, AC-7, AC-8, AC-9       | analyze                  | task1          |
| task3   | 建立基础 CI：格式检查、静态分析、测试命令和手动触发入口                                  | AC-11, AC-13                 | coding                   | task1          |
| task4   | 定义领域模型、JSON schema version、校验规则、导出设置和错误状态                          | AC-1, AC-2, AC-3, AC-6, AC-8 | coding                   | task2, task3   |
| task5   | 实现 JSON repository、原子写入、损坏文件保护、图片入库和数据重载测试                     | AC-1, AC-11                  | coding                   | task4          |
| task6   | 实现分类列表、分类创建、编辑、删除确认和作品数量展示                                     | AC-2, AC-10                  | coding                   | task5          |
| task7   | 实现作品列表、作品详情、图片、短评、长评和删除引用处理                                   | AC-3, AC-5, AC-10            | coding                   | task6          |
| task8   | 实现评分维度、权重、最终评分计算和非法输入测试                                           | AC-4, AC-11                  | coding                   | task7          |
| task9   | 审查评分公式、空维度状态、权重边界和分类默认维度策略是否覆盖产品意图                     | AC-4                         | analyze                  | task8          |
| task10  | 实现分类内排行，支持最终评分、单维度和手动排序                                           | AC-6, AC-10                  | coding                   | task8          |
| task11  | 实现作品分享图数据组装、预览、导出和权限错误处理                                         | AC-5, AC-7                   | coding                   | task7          |
| task12  | 实现排行榜分享图数据组装、长榜导出、空榜处理和顺序一致性测试                             | AC-6, AC-8                   | coding                   | task10, task11 |
| task13  | 验证跨平台数据目录复制迁移流程、Android 构建和桌面构建冒烟路径                           | AC-1, AC-9, AC-13            | analyze                  | task5, task12  |
| task14  | 扩展 CI 矩阵，生成 Android 和桌面端 artifacts，并确保失败检查阻断产物发布                | AC-13                        | coding                   | task3, task13  |
| task15  | 补齐端到端或集成测试，并整理本地数据目录迁移说明、构建产物说明和首版边界                 | AC-10, AC-11, AC-13          | coding                   | task12, task14 |

所有 `coding` 任务完成后都必须提交独立 commit。提交前应运行与该任务相关的最小检查；提交后工作区应保持干净，再进入下一个任务。

## Claude-Codex Deliberation

### Agreements

- 首版应坚持本地优先，JSON 数据目录是核心约束，不应引入云后端或账号同步。
- 评分计算、排行生成、分享图数据组装和 JSON 读写应作为可测试的核心逻辑，不应依赖 UI 才能验证。
- Android 与 Windows/macOS/Linux 是首版主要平台，iOS 可以技术预留但不应拖慢首版。
- 图片资源应进入可迁移数据目录，避免跨设备复制后作品封面丢失。
- 因为没有 Claude Code 额度，计划中的实现和分析工作都由 Codex 承担；`coding` 标签只表示实现类任务，不表示由 Claude 执行。
- Git 历史和 CI 不是收尾装饰，而是交付要求，应从项目骨架阶段开始建立。

### Resolved Disagreements

- 跨平台技术路线：一种观点是使用 Web/Tauri 以便快速构建桌面体验，另一种观点是使用 Flutter 覆盖 Android 和桌面端。选择 Flutter 作为推荐路径，因为草稿明确要求 Android 客户端，同时桌面端也是首版目标。
- 排行能力范围：一种观点是只按最终评分排序，另一种观点是支持最终评分、单维度和手动排序。选择三者都支持，因为草稿提到“针对某个标准”排行，且个人榜单常需要手动调整。
- 分享图范围：一种观点是只导出作品分享图，另一种观点是同时支持作品分享图和排行榜分享图。选择同时支持，因为更新后的草稿明确要求排行榜也能生成图片分享。
- CI 建立时机：一种观点是功能完成后再补 CI，另一种观点是项目骨架阶段就建立基础 CI。选择尽早建立基础 CI，因为每个任务完成后都要 commit，持续检查能让历史更可靠。

### Convergence Status

- Final Status: `converged`

## Pending User Decisions

- DEC-1: iOS 是否进入首版构建目标
  - Claude Position: 不参与执行；按用户约束不作为 coding 执行方。
  - Codex Position: iOS 不进入首版必需范围，只保留技术可行性。
  - Tradeoff Summary: 排除 iOS 可以更快完成 Android 与桌面端；包含 iOS 会增加证书、设备测试和上架约束。
  - Decision Status: `PENDING`

- DEC-2: 分享图视觉规格是否需要固定模板
  - Claude Position: 不参与执行；按用户约束不作为 coding 执行方。
  - Codex Position: 首版提供一套默认作品封面图模板、一套默认作品长图模板、一套默认排行榜图片模板。
  - Tradeoff Summary: 固定模板交付更快；模板编辑器更灵活但会明显增加 UI、渲染和测试成本。
  - Decision Status: `PENDING`

- DEC-3: 评分维度是按分类复用还是每个作品独立配置
  - Claude Position: 不参与执行；按用户约束不作为 coding 执行方。
  - Codex Position: 首版支持分类默认维度，作品可以覆盖分数和必要时调整维度。
  - Tradeoff Summary: 分类默认维度更适合批量排行；作品独立维度更自由但会降低同类作品可比性。
  - Decision Status: `PENDING`

- DEC-4: CI 平台和产物格式
  - Claude Position: 不参与执行；按用户约束不作为 coding 执行方。
  - Codex Position: 如果没有指定代码托管平台，先按 GitHub Actions 组织 workflow；Android 产物优先 APK，桌面产物按 runner 能力输出压缩包或安装包。
  - Tradeoff Summary: GitHub Actions 文档和 runner 支持成熟；如果实际使用 Gitea/GitLab，需要调整配置语法和 artifact 上传方式。
  - Decision Status: `PENDING`

## Implementation Notes

### Code Style Requirements

- 实现代码和注释不得包含计划文档专用术语，例如 "AC-"、"Milestone"、"Step"、"Phase" 或类似流程标记。
- 这些术语只用于计划文档，不应进入实际代码库。
- 代码中应使用清晰、贴合业务领域的命名。
- 业务代码命名应围绕真实领域概念，例如 category、work、ratingDimension、ranking、shareExport、dataRepository、artifactBuilder。
- 测试名称应描述用户行为或领域规则，不应引用本计划中的编号。

### Git and CI Requirements

- 每个 `coding` 任务完成后必须生成一个独立 commit。
- commit message 应简洁描述完成的领域能力或基础设施能力。
- 提交前必须运行当前任务相关检查；不能运行的检查需要记录原因。
- CI 配置应随任务逐步演进，不能等到最后才一次性补齐。
- 构建产物应通过 CI artifact 获取，不能依赖本地手工复制作为唯一交付方式。
