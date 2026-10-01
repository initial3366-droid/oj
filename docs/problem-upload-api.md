# 题目与测试点上传接口

根据当前后端控制器、DTO 和 ZIP 解析实现整理。本文示例采用本地 `.env` 的前缀 `/api/auth_ac/v1`，用 `P` 简写；其他部署应以 `ADMIN_API_PREFIX` 为准。默认前缀是 `/api/admin/v1`。

所有接口需要 `Authorization: Bearer <accessToken>`，控制器允许超级管理员或教师。已有题目的写操作还检查题目归属；超级管理员可管理全部题目。

## 新题目上传流程

| 顺序 | 方法 | 接口 | 请求与返回 |
| --- | --- | --- | --- |
| 1 | POST | `P/problem-drafts` | 无需请求体；返回 `data.draftId` |
| 2 | PUT | `P/problem-drafts/{draftId}/basic` | JSON 题面、样例、限制和发布状态 |
| 3 | POST | `P/problem-drafts/{draftId}/test-cases/zip?overwrite=true` | multipart/form-data，文件字段 `file` |
| 4 | POST | `P/problem-drafts/{draftId}/commit` | 无需请求体；返回正式题目的 `data.id` |

可用 `GET P/problem-drafts/{draftId}` 检查草稿内容，也可用 `PUT P/problem-drafts/{draftId}/test-cases` 直接保存 JSON 测试点。

当前没有 `POST P/problems` 的直接建题入口。建题走上述草稿流程。

临时草稿存 Redis，每次保存续期 6 小时；`commit` 后题目和测试点写入数据库，临时草稿删除。`draftId` 是临时 UUID，`problemId` 是入库后的数字 ID。

题面请求示例：

```json
{
  "title": "两数之和",
  "timeLimit": 1000,
  "memoryLimit": 256,
  "statement": "<p>给出两个整数，输出它们的和。</p>",
  "inputFormat": "<p>一行两个整数 a、b。</p>",
  "outputFormat": "<p>输出 a+b。</p>",
  "samples": [{"input": "1 2\n", "output": "3\n", "explanation": "1+2=3"}],
  "tags": ["入门"],
  "difficulty": 1,
  "folderId": null,
  "isPublic": false,
  "studentPublishStatus": "DRAFT"
}
```

`title` 必填，最长 200 字符；`statement` 必填，编辑器支持 HTML 和 LaTeX。`timeLimit` 单位 ms，范围 100～60000；`memoryLimit` 单位 MB，范围 16～1024；可选难度为 1～5。特殊判题源码放 `checkerSource`，最长 200000 字符。`folderId` 应填写实际有权限的题目文件夹 ID，或留空。

**整理期间显式传 `studentPublishStatus: "DRAFT"` 和 `isPublic: false`。** `commit` 会根据题面中的状态入库，并不保证自动保持未发布；省略状态且未设置 `isPublic: false` 时，当前默认行为是发布。

## 已有题目的测试点接口

| 方法 | 接口 | 用途 |
| --- | --- | --- |
| GET | `P/problems/{problemId}/test-cases` | 查看测试点，返回 `id`、`caseNo`、`input`、`output`、`sample` 等字段 |
| POST | `P/problems/{problemId}/test-cases` | 新增一个隐藏测试点 |
| PUT | `P/problems/{problemId}/test-cases/{testCaseId}` | 更新一个隐藏测试点 |
| DELETE | `P/problems/{problemId}/test-cases/{testCaseId}` | 删除一个隐藏测试点 |
| PUT | `P/problems/{problemId}/test-cases` | JSON 全量替换隐藏测试点 |
| POST | `P/problems/{problemId}/test-cases/zip?overwrite=false` | ZIP 追加隐藏测试点 |
| POST | `P/problems/{problemId}/test-cases/zip?overwrite=true` | ZIP 替换隐藏测试点 |
| PUT | `P/problems/{problemId}` | 更新题面、样例、限制等题目元数据 |

单点新增/更新的请求体：

```json
{"caseNo": 1, "input": "1 2\n", "output": "3\n"}
```

全量保存（草稿和已有题目均采用此结构）：

```json
{
  "testCases": [
    {"caseNo": 1, "input": "1 2\n", "output": "3\n"},
    {"caseNo": 2, "input": "-1 1\n", "output": "0\n"}
  ]
}
```

`input` / `output` 填文件文本内容，不填本地路径。`testCaseId` 是数据库记录 ID，与测试点编号 `caseNo` 不同。样例放在题面请求的 `samples` 中；上述写接口维护隐藏测试点，ZIP 覆盖也不替换样例。

## ZIP 格式与混乱数据的整理

每题一个 ZIP，建议根目录连续编号：

```text
data.zip
├── 1.in
├── 1.out
├── 2.in
├── 2.out
└── ...
```

上传与解压后的有效测试文件总量分别不能超过 50 MiB。标准输入输出配对时不超过 200 个测试点，ZIP 非目录条目不超过 500 个。文件按 UTF-8 文本读取。普通题要求配套 `.out`，输出不能空白；配置特殊判题源码的题目允许缺少预期输出。

需要特别核对这些现有解析行为：

- 只识别数字文件名加小写 `.in` / `.out`，如 `12.in`；`test1.in`、`1.ans`、`1.OUT` 会被忽略。
- 后端允许子目录，但会去掉目录路径；`a/1.in` 和 `b/1.in` 视为同一个编号，后读入的内容覆盖前者。
- `01.in` 与 `1.in` 都按数字 1 处理。
- 没有对应 `.in` 的孤立 `.out` 不会成为测试点。
- 追加导入会从当前最大编号之后重新编号；覆盖导入替换已有隐藏测试点。

建议先为每题列出“原输入文件、原答案文件、整理后编号”的对应清单，查缺失、重复和编码，再生成扁平 ZIP。`.ans` 应核对后改成 `.out`，不能仅凭文件排序猜配对。题面、样例、测试点和标程应分开整理。

上传示例，`TOKEN` 为已登录取得的令牌，`DRAFT_ID` 为第 1 步返回值：

```sh
curl -X POST \
  "http://127.0.0.1:18080/api/auth_ac/v1/problem-drafts/${DRAFT_ID}/test-cases/zip?overwrite=true" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@data.zip"
```

响应统一为 `{ "code": 200, "message": "成功", "data": ... }`，实际返回结构由各接口决定。

## 仓库中已有的导入工具

`tools/qoj-publish/qoj_web.py` 可上传配套 `problem.json` 和 `data.zip`，按当前环境配置读取接口前缀。它会走完整建题流程并显式保留 DRAFT。其本地预检比后端更严格：要求 ZIP 扁平且编号连续。

`tools/qoj-publish/qoj_publish.py` 的 `preflight` 可离线检查这两份文件，但当前 `login` / `push` 仍硬编码默认 `/api/admin/v1`，并默认使用题目文件夹 7。当前 `/api/auth_ac/v1` 部署不能直接照搬其上传命令；应使用配置了正确前缀的网页工具或上面的实际接口。

对应后端实现：

- `backend/src/main/java/com/qoj/module/problem/controller/AdminProblemDraftController.java`
- `backend/src/main/java/com/qoj/module/problem/controller/AdminProblemController.java`
- `backend/src/main/java/com/qoj/module/problem/dto/ProblemDraftBasicRequest.java`
- `backend/src/main/java/com/qoj/module/problem/service/ProblemDraftService.java`
- `backend/src/main/java/com/qoj/module/problem/service/ProblemService.java`
