# slacubedemo — hello cube demo (SLA + sla_ecs + three.js)

> **这是一个演示测试，还不是一个 engine。** 它的目的只有一个：证明最小的 SLA
> 程序能驱动 three.js 渲染一帧——SLA 管游戏逻辑，three.js 管渲染，JS 只做
> 最薄的胶水。不要把它当成引擎用；引擎是下一步的事。

在线演示（Colab 存活期间有效）：
**https://dev.cxu.lol/slaengine-hello-cube/** —— 两个 cube（绿 0.02、橙 0.05
单位/帧），HUD 显示帧数、ECS tick、ECS x，Reset 重建世界。

## 架构：分工，而不是重写

- **SLA + sla_ecs 管游戏逻辑**：世界、实体、组件、系统，全在 SLA 里。
  `src/hello_cube.sla` 只有一个 `DynamicWorld<CubePos, CubeVel, CubeTime,
  CubeEvt>` 世界、一个 cube 实体、一个 movement 系统（每 tick `pos += vel`，
  `tick + 1`）。
- **three.js 只管渲染**：场景、相机、mesh、WebGL，SLA 碰都不碰。
  不重写 three.js——WebGL、着色器、类型化数组三关，重写不现实；正确姿势
  是 SLA 通过 SA 的 JS 目标去**调用**它。
- **桥接（JEV，置信度 1.0）：host-driven scalar accessors**——SLA 永远不
  直接调用 JS 对象、不持有 mesh。反过来，JS 每帧调 SLA 导出的函数，读回
  几个 f64 数字，再写进 `mesh.position`。不用 `#npm_bind` 那条路：它的
  MVP 封送会直接拒绝 JS 对象，shim 反而更复杂。
- **浮点（JEV，置信度 1.0）：原生 f64 组件**，不用定点 hack。`CubePos` /
  `CubeVel` 就是 f64 字段，build-js 下结构体、运算、转换都能跑。
- **世界持久化**：SLA 没有可变顶层状态（parser 拒绝顶层 `let`），所以世
  界不能存在 SLA 全局里。解法是线性内存指针 round-trip：`cube_new()` 返
  回的 world 在 JS 侧以 bigint 指针持有，每帧 `cube_tick(ptr)` 传回去、
  拿回新世界。SLA 侧世界永远是线性值 `fn(World) -> World`，JS 只负责保
  管指针。

## `hello_cube.sla` 是怎么写的（63 行）

- `@import "../../sla_ecs/lib/world_dynamic.sla"`，拿到泛型世界
  `DynamicWorld`。
- 四个 struct：`CubePos` / `CubeVel`（f64 x/y/z，位置和速度）、`CubeTime`
  （`tick: i32`，作为**资源**，即单例数据）、`CubeEvt`（`amount: i32`，
  占位——`DynamicWorld` 要四个泛型参数 `<A, B, R, E>`，事件槽这里没实际用，
  只给了默认值）。
- `cube_movement_system`（核心系统，纯函数式线性 threading）：
  `increment_tick` → `get_resource` 读当前 tick → `insert_resource` 覆写成
  tick+1 → `query_a_b` 查出所有 (位置, 速度) 对 → while 循环逐个算
  `moved = pos + vel` → `pair_write_a` 写回。循环里世界值被反复重新赋
  值，每次变换都返回一个新世界，这就是 sla_ecs 的风格。
- `cube_new(vx, vy, vz)`（装配）：建世界 → `spawn` 一个实体 →
  `insert_a` 位置 (0,0,0) → `insert_b` 速度 (vx,vy,vz) → `insert_resource
  CubeTime{tick: 0}`。**最后一行是修过一个真实 bug 的**：见下。
- `cube_tick` 就是 movement system 的薄包装；`cube_x/y/z` 用
  `get_a(world, entity_new(1, 0))` 读第一个 spawn 出来的实体的位置分量；
  `cube_ticks` 读资源里的 tick；`main` 返回 0 只是占位（浏览器里
  `process` 不存在，import 时不会自动跑它）。

### 修过的两个真实 bug（机制写清楚，不藏）

- `cube_ticks` panic（code 5001）：`dynamic_world_get_resource` 在从未
  insert 过 resource 时会 panic（传给 `dynamic_world_new` 的默认值并不
  会填充它），而且 `increment_tick` 只 bump 内部 change tick，不动 Time
  资源。修法：`cube_new` 显式 insert `CubeTime{tick: 0}`，系统每帧再覆
  写 tick+1。`resource_insert` 是覆写语义（`resource.sla` 有对应测试）。
- 世界持久化问题：见上“线性内存指针 round-trip”。

### 浏览器那头（`index.html`）怎么接

- import map 把 `three` 指到本地 `/three.js/build/three.module.js`（不走
  CDN；CDN 备选被注释在页面里）。
- import 编译出来的 `build/hello_cube.mjs`（build-js 的导出带 `sla__`
  前缀，页面里做了 `sla__cube_* || cube_*` 回退）。
- `resetWorlds` 建两个世界：绿 cube 速度 0.02、橙 cube 0.05，mesh 位置归零。
- `animate` 里 rAF 每帧：每个世界 `cube_tick` 一次 → `cube_x/y/z` 读回
  位置 → `mesh.position.set` → HUD 显示 frame、ticks、x。页面里有行注释
  写明原则：**位置只来自 ECS，绝不在 JS 里写死**。

## 目录结构与布局假设

```
slacubedemo/                 # 本仓库（演示源码）
  src/hello_cube.sla         # 唯一的游戏代码
  scripts/build.sh           # 编译：ESM build/hello_cube.mjs + CJS build/hello_cube.cjs
  scripts/verify_node.cjs    # node 验证：T1–T4
  scripts/serve.ts           # Bun 预览服务
  index.html                 # 浏览器宿主页面
  VERSIONS.md                # 版本记录
```

**布局假设（重要）：本仓库不能单独克隆下来就编译。** 它假定 Colab
`/content` 下的并排布局，`hello_cube.sla` 用相对路径 import sla_ecs：

```
/content/
  slaengine/        # 本仓库检出后所在的目录（历史名字，服务路径都指着它）
  sla_ecs/          # sla_ecs 克隆（master）
  three.js/         # three.js 克隆（dev，0.186.0），被引用、不复制
  sa_all/sci/       # sci 检出（sa 编译器来源，原样使用、不拉取、不修改）
```

`sla_ecs`、`three.js`、`sci` 都不在本仓库里；部署时按下面“前置条件”备齐。

## 前置条件（工具链，版本是钉死的，不是 latest）

| 东西 | 版本 / 来源 | 说明 |
| --- | --- | --- |
| Go | 1.27.2 | 编译 tsgosa 不需要（本演示不走 tsgosa），列出以备回归用 |
| Zig | **0.17.0**（tarball `zig-x86_64-linux-0.17.0.tar.xz`，旧名字 `zig-linux-x86_64-0.17.0` 会 404） | 真二进制放 PATH 最前面，shim 不可用 |
| LLVM | **14 / 14.0.6**（`llvm-14-dev`；include `/usr/lib/llvm-14/include`，lib `/usr/lib/llvm-14/lib`） | Linux 上 `zig build` 默认开 LLVM-C 后端；`-Dllvm=false` 会让部分测试挂，那是环境限制不是代码 bug |
| `sa` | 0.1.8，sci 检出里默认 `zig build` 编出来（LLVM-C 开着，不用 `-p` 前缀，否则 `zig-out/lib` 可能缺失） | `zig-out/bin/sa` |
| sla 插件 | 项目本地一份 `sa_plugin_sla` 克隆，dev-mode 安装（`SA_PLUGIN_DEV=1`，`SCI_ROOT` 指向共享 sci 检出，只读、不写共享检出） | 见下“编译” |
| node | v22.19.0 | 跑验证 harness |
| Bun | 1.4.4 | 跑预览服务（Colab 上 `/root/.bun/bin/bun`） |

关键版本（见 `VERSIONS.md`，2026-10-28 重建时核实）：

- sla_ecs：master `1be020b`（重建前后 HEAD 没变，无版本漂移）
- three.js：dev `68a2712f`（0.186.0，`build/three.module.js` 存在；正确地址是
  `https://github.com/mrdoob/three.js`）
- sci：main `ef3032f4`，**原样使用**——不拉取、不修改（只在构建弄脏
  `artifacts/sa_std/libsa_std.a` 时用 `git checkout --` 恢复它）

## 编译方法

```sh
# 0. 确认并排布局（见上），sa 二进制可用，插件已 dev-mode 安装。
#    之后每一步都要带 SA_PLUGIN_DEV=1，否则 sla 前端不分发，见“已知 quirks”。
export SA_PLUGIN_DEV=1
export SCI_ROOT=/content/sa_all/sci   # 共享 sci 检出，只读

# 1. 类型检查 SLA 源码（第一次就该过；不过先别往下走）
sa sla check src/hello_cube.sla

# 2. 编译：ESM + CJS 两个产物（scripts/build.sh 干的就是下面两步）
scripts/build.sh
#   → build/hello_cube.mjs（约 665KB，ESM，导出 sla__cube_*，共 10 个函数）
#   → build/hello_cube.cjs（约 667KB，CJS）
#   build.sh 内部：sa sla build-js 出 ESM，host build-js 出 CJS；
#   编译器会在 src/ 旁生成 src/hello_cube.sa（gitignored），必须过 sa check。

# 3. 检查生成的 .sa（重建时 6024 条指令，因为嵌了整个 sla_ecs 库）
sa check src/hello_cube.sa
```

## 验证方法（node，T1–T4，全过才算数）

```sh
node scripts/verify_node.cjs   # 期望：ALL CHECKS PASSED
```

- **T1**：初始 x=0；10 tick @0.5 → x=5.0，y=z=0，tick 计数=10。
- **T2**：不同速度 → 不同运动：@1.5 → 15.0，@0.0 → 0，@−0.5 → −5.0
  （f64 负数精确）。
- **T3**：每帧 x == 0.5·k（k=1..10 全过）。
- **T4**：两个交错世界互不干扰：@0.5×6 → 3.0，@1.5×6 → 9.0。
- 原则：**没有任何写死动画**——每个位置都来自 ECS 模块。node 验的是逻辑；
  浏览器里看到两个 cube 在动，验的是渲染；两边都过才算演示成立。

## 本地运行与部署方法

### 预览服务（Bun）

```sh
cd /content/slaengine
nohup /root/.bun/bin/bun scripts/serve.ts > logs/bun_serve.log 2>&1 &
```

- 监听 `127.0.0.1:43111`。**不要用 43110**：它被 Colab 基础设施占了
  （`cxu serve` + frp 中继上游，动它会断 SSH）。
- Web 根是 `/content`，但**只暴露三个子树**，其余一律不暴露：
  `/slaengine/*`、`/three.js/*`、`/build/*`；`/` 映射到 hello cube 页面。
- 本地自查（三个 200 + 一个 404 才算过）：
  `curl 127.0.0.1:43111/`、`/slaengine/index.html`、
  `/three.js/build/three.module.js` 200；`/codex-react-ui/...` 404。

### 公网绑定（dev.cxu.lol 隧道）

```sh
cd /content/slaengine
LOCAL=43111 NAME=slaengine-hello-cube nohup bash tunnel_get.sh > logs/tunnel_devcxu.log 2>&1 &
```

- `tunnel_get.sh` 是从 `https://dev.cxu.lol/get.sh` 下载的隧道启动脚本，
  存在仓库根外（Colab 上 `/content/slaengine/tunnel_get.sh`）；它**不在
  本仓库里**（内容从未读过，不排除含隧道密钥，不进公开库），被清掉就
  重新下载。
- 隧道客户端是 frp：`bun /tmp/frp/client.ts --server
  wss://dev.cxu.lol/__tunnel --name slaengine-hello-cube --upstream
  http://127.0.0.1:43111`。
- 公网地址：**https://dev.cxu.lol/slaengine-hello-cube/**。它是**按名绑
  定**的：隧道重启时用同一个 NAME 就能恢复同一个地址（Cloudflare 快捷
  隧道每次重启都会换地址，不要用它——实测从 Muse VM 一侧会被 Cloudflare
  边缘 403 "Your request was blocked"）。
- 对外验证（报地址之前必须全过）：`/`、`/slaengine/index.html`、
  `/three.js/build/three.module.js`、`/slaengine/build/hello_cube.mjs`
  均为 200，页面含 hello cube 与 ESM 引用，域外路径 404。

### 重启命令（服务挂了、Colab 重启后，按顺序）

```sh
cd /content/slaengine
nohup /root/.bun/bin/bun scripts/serve.ts > logs/bun_serve.log 2>&1 &
LOCAL=43111 NAME=slaengine-hello-cube nohup bash tunnel_get.sh > logs/tunnel_devcxu.log 2>&1 &
# 然后重跑上面“本地自查”+“对外验证”；隧道日志里看不到新地址就说明没起来。
```

### 存活期说明（先说清楚，免得误会）

- 地址只在 **Colab 本机 + Bun + 隧道两个进程都活着**时有效；Colab 随时
  可能关机。
- Colab 重启会清工具链（Go/Zig/LLVM/`sa` 二进制都没了，要重装重编），
  严重时还会清 `/content`（2026-10-28 就清过一次，slaengine 原项目就
  是那次丢的——当时它从没推过，只能按报告规约重建）。**所以源码推到
  这个仓库就是备份**：下次再清，直接按上面步骤重建，不用凭记忆。
- 隧道本身重启能恢复同名地址；但 Colab 关机或清盘之后，一切重来。

## 已知 quirks（记下来，不藏）

- `SA_PLUGIN_DEV=1` 是每一步都必需的：没有它，`sa build-js` 会把
  `.sla` 文件当 SA 汇编处理（ForbiddenSyntax），`sa sla ...` 报
  SA-CLI-013。`sa sla ...` 动词已 deprecate（“按文件扩展名分发，改跑
  host 动词”），过渡期还能用；`scripts/build.sh` 对 JS 用 host `build-js`
  动词，对 `.sa` 产出用插件 `sla build` 动词。
- `sa build-js` 选项顺序有讲究：选项必须跟在文件后面（`--format cjs`
  放文件前面会报错）。
- `sa build-js` 会在 stderr 打一段非致命 zig 堆栈 + `DebugAllocator`
  leak 行，产物是对的，和原来那次构建同一类噪音。
- ESM 导出带 `sla__` 前缀（`sla__cube_*`）；浏览器里 `process` 未定义，
  所以 import 时 `main()` 不会自动跑（node CJS 里有 `require.main ===
  module` 守卫）。
- JS emitter 会把负 i64 打成 wrap 后的 u64；这里位置是 f64，无关。
- 编译器会在源码旁生成 `.sa`（`src/*.sa`，gitignored）；生成的 `.sa`
  必须过 `sa check`。
- SLA 顶层不允许 `let`（世界不能放全局，见“世界持久化”）；
  `get_resource` 在从未 insert 过时 panic（见“修过的 bug”）。

## 下一步（按原计划排着，不属于本演示）

- 给它接真实的 Time（带 delta 时间，速度变成单位/秒而不是单位/帧），
  再接输入——这是游戏 IDE 的 MVP 方向（Blender 场景 + glTF 导出 +
  three.js 浏览器视图 + SLA 脚本运动），不在本演示范围内。
- 本演示验证通过后，真正的引擎（slaengine）再另立项目；不要把演示
  仓库当成引擎仓库用。
