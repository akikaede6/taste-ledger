# 本地个人评分工具实施计划

## Goal Description

在本仓库从零实现一款本地优先的个人评分工具，用于个人记录、评分和整理自己看过或听过的影视作品、Drama CD、音乐等内容。用户可以创建分类，在分类下维护作品名称、图片、短评、长评、评分维度、维度权重和最终评分；可以基于同一分类中的作品生成“从夯到拉”的排行；可以从作品页导出分享图，支持适合小红书封面使用的紧凑图，以及包含全部信息的长图。数据以本地 JSON 数据目录为唯一持久化来源，用户更换设备时可以直接拷贝数据文件夹完成迁移。

<comment>
这里的导出加一个，可以生成从夯到拉排行的分享图，适合小红书，排行的作品用图片显示
</comment>
首版优先覆盖 Android、Windows、macOS、Linux 客户端。iOS 客户端作为可选目标，不阻塞首版完成。

## Acceptance Criteria

每条验收标准都包含正向测试和反向测试，便于用 TDD 方式做确定性验证。

- AC-1: 本地 JSON 数据目录可以完整保存和恢复用户数据
  - Positive Tests (expected to PASS):
    - 新建分类、作品、评分、评论和排行后，关闭并重新打开应用，所有内容保持一致。
    - 将数据目录复制到一个干净的应用实例后，应用可以读取并展示同一份数据。
    - JSON 文件包含 schema version，应用可以识别当前支持的数据结构版本。
  - Negative Tests (expected to FAIL):
    - JSON 文件缺少必需字段时，应用不得静默生成错误数据，必须给出可恢复的错误状态。
    - JSON 文件格式损坏时，应用不得覆盖原文件，必须保留损坏文件并提示用户处理。

- AC-2: 用户可以管理作品分类
  - Positive Tests (expected to PASS):
    - 用户可以创建、重命名、删除分类，例如“影视作品”“Drama CD”“音乐”。
    - 分类列表展示分类名称、作品数量和最近更新时间。
    - 删除分类前必须确认，并同步处理该分类下的作品和排行引用。
  - Negative Tests (expected to FAIL):
    - 空名称或仅包含空白字符的分类不得保存。
    - 删除不存在的分类不得导致数据文件损坏。

- AC-3: 用户可以在分类下管理作品资料
  - Positive Tests (expected to PASS):
    - 用户可以在指定分类下创建作品，并维护作品名称、封面图片、短评、长评和创建/更新时间。
    - 用户可以编辑作品资料，保存后列表页和详情页展示一致。
    - 用户可以删除作品，相关排行条目同步移除或标记为失效并可修复。
  - Negative Tests (expected to FAIL):
    - 作品名称为空时不得保存。
    - 作品引用了不存在的分类时不得进入正常列表，必须被识别为数据一致性问题。

- AC-4: 用户可以自定义评分维度、权重并生成最终评分
  - Positive Tests (expected to PASS):
    - 用户可以为分类或作品配置多个评分维度，例如剧情、演出、音乐、个人偏好。
    - 每个维度可以设置分数和权重，最终评分按 `sum(score * weight) / sum(weight)` 计算。
    - 修改任一维度分数或权重后，最终评分立即重新计算并持久化。
    - 权重总和不是 100 时仍可按权重比例正确计算。
  - Negative Tests (expected to FAIL):
    - 负权重、非数字权重、非数字分数不得保存。
    - 没有任何有效评分维度时，不得生成伪造的最终评分。

- AC-5: 用户可以同时维护短评和长评
  - Positive Tests (expected to PASS):
    - 作品详情页同时支持短评和长评编辑，二者互不覆盖。
    - 分享封面图默认包含短评，不包含长评。
    - 长图导出可以包含长评，并保留换行段落。
  - Negative Tests (expected to FAIL):
    - 保存长评时不得截断已有文本。
    - 短评为空时，分享图不得出现空白占位文案。

- AC-6: 用户可以在同一分类内创建和查看排行
  - Positive Tests (expected to PASS):
    - 用户可以为某一分类创建排行，并选择按最终评分、某一评分维度或手动排序生成“从夯到拉”的列表。
    - 排行只包含同一分类下的作品，且每个排行条目引用真实存在的作品。
    - 修改作品评分后，自动排行可以刷新并反映新顺序。
  - Negative Tests (expected to FAIL):
    - 排行不得包含其他分类下的作品。
    - 排行引用已删除作品时，不得崩溃，必须提示修复或自动移除无效条目。

- AC-7: 作品页可以导出分享图片
  - Positive Tests (expected to PASS):
    - 用户可以从作品详情页选择导出“封面图”或“长图”。
    - 封面图包含作品名、封面图片、分类、最终评分、维度评分和短评，不包含长评。
    - 长图包含作品名、封面图片、分类、最终评分、维度评分、短评和长评。
    - 导出的图片在桌面和 Android 环境中都能保存到用户可访问的位置。
  - Negative Tests (expected to FAIL):
    - 没有保存权限或目标路径不可写时，应用不得显示导出成功。
    - 作品缺少封面图片时，导出流程仍可完成，但不得出现破损图片占位。

- AC-8: 应用在 Android 和桌面端共享同一套核心数据逻辑
  - Positive Tests (expected to PASS):
    - Android、Windows、macOS、Linux 构建使用同一份数据模型、评分计算和 JSON 读写逻辑。
    - 至少一个 Android 构建和一个桌面构建可以通过基础冒烟测试。
    - 在任一平台生成的数据目录可以被另一个平台读取。
  - Negative Tests (expected to FAIL):
    - 平台专属路径不得成为唯一数据来源，用户必须能定位并复制数据目录。
    - 不得为了跨端同步引入云账号或远程服务作为首版必需依赖。

- AC-9: 应用提供适合个人管理的基础前端体验
  - Positive Tests (expected to PASS):
    - 首屏展示分类入口和最近编辑作品。
    - 分类页支持浏览作品、按最终评分排序、进入排行页。
    - 作品详情页将资料、评分、评论、分享操作组织在清晰的编辑流程中。
  - Negative Tests (expected to FAIL):
    - 作品较多时，列表不得因为单个长评或长标题导致布局重叠。
    - 保存失败时，界面不得表现为已保存状态。

- AC-10: 核心行为有自动化测试覆盖
  - Positive Tests (expected to PASS):
    - 数据模型、JSON 读写、评分计算、排行生成、导出数据组装都有单元测试。
    - 至少覆盖分类创建、作品创建、评分更新、排行刷新、数据重载的端到端或集成测试。
    - CI 或本地测试命令可以一次性运行核心测试套件。
  - Negative Tests (expected to FAIL):
    - 缺少关键字段、非法权重、跨分类排行引用、损坏 JSON 等异常输入必须有失败用例。
    - 测试不得依赖开发者机器上的固定绝对路径。

## Path Boundaries

路径边界用于限定可接受的实现质量、范围和技术选择。

### Upper Bound (Maximum Acceptable Scope)

实现一个可实际日常使用的跨平台本地应用：包含 Android、Windows、macOS、Linux 构建；完整的分类、作品、图片、短评、长评、评分维度、权重、最终评分、排行和分享图导出；具备 JSON schema version、数据目录迁移说明、损坏数据保护、自动化测试和基础打包脚本。iOS 可以完成技术预留或实验性构建，但不上架流程不属于首版范围。

### Lower Bound (Minimum Acceptable Scope)

实现一个本地可运行的首版应用：使用同一套核心逻辑支持 Android 和至少一个桌面平台；能够创建分类和作品，维护图片、短评、长评、评分维度和权重，计算最终评分，生成分类内排行；能够以 JSON 数据目录保存和恢复；能够导出封面图和长图；核心计算与数据读写有自动化测试。

### Allowed Choices

- Can use: Flutter/Dart 作为推荐跨平台方案；本地 JSON 文件；应用可访问的数据目录；本地图片复制或引用策略；单元测试、组件测试、集成测试；必要的图片渲染/保存库；平台权限插件。
- Can use: 其他能同时覆盖 Android 和 Windows/macOS/Linux 的单代码库方案，但必须维持本地 JSON 数据目录和跨平台数据兼容。
- Cannot use: 云后端、账号体系、远程数据库或订阅同步作为首版必需能力。
- Cannot use: 只支持 Web 或只支持桌面端的方案来替代 Android 和桌面客户端目标。
- Cannot use: 将用户数据只存放在不可直接迁移的私有位置，且不提供导出或复制数据目录的能力。
- Cannot use: 把 iOS 上架、社交平台自动发布、多人共享、推荐算法或 AI 生成评论纳入首版必需范围。

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
  features/
    categories: 分类列表与编辑
    works: 作品列表、详情、编辑
    rankings: 分类内排行
    sharing: 封面图与长图导出
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
    <generated-share-image>.png
```

`library.json` 可以包含：

```json
{
  "schemaVersion": 1,
  "categories": [],
  "works": [],
  "rankings": []
}
```

评分计算建议作为纯函数实现，避免和 UI 状态耦合：

```text
validDimensions = dimensions with numeric score and positive weight
if validDimensions is empty: finalScore = null
else finalScore = sum(score * weight) / sum(weight)
```

JSON 写入建议使用临时文件加原子替换，降低写入中断导致主数据文件损坏的风险。图片建议复制到数据目录中的 `images/`，作品只保存相对路径或图片 ID，便于整个数据目录跨设备移动。

### Relevant References

- `draft.md` - 原始产品需求草稿。
- `docs/plan.md` - 本实施计划。
- `lib/` - 建议的 Flutter 应用源码目录，当前尚未创建。
- `test/` - 建议的单元测试和组件测试目录，当前尚未创建。
- `integration_test/` - 建议的跨流程测试目录，当前尚未创建。

## Dependencies and Sequence

### Milestones

1. 项目骨架与技术验证：确定跨平台框架并建立可运行应用
   - 初始化应用项目、测试框架和基础目录结构。
   - 验证 Android 和一个桌面平台可以启动同一应用。
   - 实现数据目录定位策略，确保用户可以找到并复制数据目录。

2. 领域模型与本地存储：先稳定数据合同
   - 定义分类、作品、评分维度、排行和导出所需的数据模型。
   - 实现 JSON 序列化、schema version、校验、损坏文件处理和原子写入。
   - 添加数据读写和异常输入测试。

3. 分类与作品管理：实现个人资料库核心流程
   - 实现分类列表、分类编辑、作品列表和作品详情。
   - 支持作品图片、短评、长评和基础编辑状态。
   - 确保保存失败、删除确认和无效引用有明确 UI 状态。

4. 评分与排行：实现核心评价能力
   - 实现评分维度、权重编辑和最终评分计算。
   - 实现分类内排行，支持按最终评分、单一维度和手动顺序。
   - 添加评分计算、排行刷新、跨分类引用拒绝测试。

5. 分享图导出：实现作品页输出能力
   - 定义封面图和长图的数据组装规则。
   - 实现图片渲染、预览、保存和权限错误处理。
   - 添加无封面、无短评、长评换行等导出测试。

6. 跨平台验证与收尾：确保首版可迁移、可测试、可打包
   - 运行核心测试套件。
   - 验证 Android 和桌面构建。
   - 编写本地数据目录位置和手动迁移说明。
   - 整理首版不包含 iOS 上架和云同步的边界说明。

## Task Breakdown

每个任务必须且只能包含一个路由标签：

- `coding`: 由 Claude 实现
- `analyze`: 通过 Codex 执行分析（`/humanize:ask-codex`）
  <comment>
  只有codex，不使用claude
  </comment>
  | Task ID | Description | Target AC | Tag (`coding`/`analyze`) | Depends On |
  |---------|-------------|-----------|----------------------------|------------|
  | task1 | 初始化跨平台项目骨架、测试命令和基础目录结构 | AC-8, AC-10 | coding | - |
  | task2 | 评估 Flutter 桌面和 Android 文件目录、权限、图片保存能力 | AC-1, AC-7, AC-8 | analyze | task1 |
  | task3 | 定义领域模型、JSON schema version、校验规则和错误状态 | AC-1, AC-2, AC-3, AC-6 | coding | task1 |
  | task4 | 实现 JSON repository、原子写入、损坏文件保护和数据重载测试 | AC-1, AC-10 | coding | task3 |
  | task5 | 实现分类列表、分类创建、编辑、删除确认和作品数量展示 | AC-2, AC-9 | coding | task4 |
  | task6 | 实现作品列表、作品详情、图片、短评、长评和删除引用处理 | AC-3, AC-5, AC-9 | coding | task5 |
  | task7 | 实现评分维度、权重、最终评分计算和非法输入测试 | AC-4, AC-10 | coding | task6 |
  | task8 | 审查评分公式、空维度状态和权重边界是否覆盖产品意图 | AC-4 | analyze | task7 |
  | task9 | 实现分类内排行，支持最终评分、单维度和手动排序 | AC-6, AC-9 | coding | task7 |
  | task10 | 实现分享图数据组装、预览、导出和权限错误处理 | AC-5, AC-7 | coding | task6 |
  | task11 | 验证跨平台数据目录复制迁移流程和构建冒烟路径 | AC-1, AC-8 | analyze | task4, task10 |
  | task12 | 补齐端到端或集成测试，并整理本地数据目录迁移说明 | AC-10 | coding | task9, task10, task11 |

## Claude-Codex Deliberation

### Agreements

- 首版应坚持本地优先，JSON 数据目录是核心约束，不应引入云后端或账号同步。
- 评分计算、排行生成和 JSON 读写应作为可测试的核心逻辑，不应依赖 UI 才能验证。
- Android 与 Windows/macOS/Linux 是首版主要平台，iOS 可以技术预留但不应拖慢首版。
- 图片资源应进入可迁移数据目录，避免跨设备复制后作品封面丢失。

### Resolved Disagreements

- 跨平台技术路线：一种观点是使用 Web/Tauri 以便快速构建桌面体验，另一种观点是使用 Flutter 覆盖 Android 和桌面端。选择 Flutter 作为推荐路径，因为草稿明确要求 Android 客户端，同时桌面端也是首版目标。
- 排行能力范围：一种观点是只按最终评分排序，另一种观点是支持最终评分、单维度和手动排序。选择三者都支持，因为草稿提到“针对某个标准”排行，且个人榜单常需要手动调整。
- 分享图范围：一种观点是先只导出单张封面图，另一种观点是同时支持封面图和长图。选择同时支持两种导出，因为草稿明确要求二者可选。

### Convergence Status

- Final Status: `converged`

## Pending User Decisions

- DEC-1: iOS 是否进入首版构建目标
  - Claude Position: iOS 不进入首版必需范围，只保留技术可行性。
  - Codex Position: 同意，iOS 上架和签名流程会显著扩大范围。
  - Tradeoff Summary: 排除 iOS 可以更快完成 Android 与桌面端；包含 iOS 会增加证书、设备测试和上架约束。
  - Decision Status: `PENDING`

- DEC-2: 分享图视觉规格是否需要固定模板
  - Claude Position: 首版提供一套默认封面图模板和一套默认长图模板。
  - Codex Position: 同意，并建议先保证信息完整和导出稳定，再做模板编辑器。
  - Tradeoff Summary: 固定模板交付更快；模板编辑器更灵活但会明显增加 UI、渲染和测试成本。
  - Decision Status: `PENDING`

- DEC-3: 评分维度是按分类复用还是每个作品独立配置
  - Claude Position: 首版支持分类默认维度，作品可以覆盖分数和必要时调整维度。
  - Codex Position: 同意，这能减少重复输入，并保留个人化空间。
  - Tradeoff Summary: 分类默认维度更适合批量排行；作品独立维度更自由但会降低同类作品可比性。
  - Decision Status: `PENDING`

## Implementation Notes

### Code Style Requirements

- 实现代码和注释不得包含计划文档专用术语，例如 "AC-"、"Milestone"、"Step"、"Phase" 或类似流程标记。
- 这些术语只用于计划文档，不应进入实际代码库。
- 代码中应使用清晰、贴合业务领域的命名。
- 业务代码命名应围绕真实领域概念，例如 category、work、ratingDimension、ranking、shareExport、dataRepository。
- 测试名称应描述用户行为或领域规则，不应引用本计划中的编号。

<comment>
需要建立git仓库，每个task需要进行commit，tag的标记
</comment>
