# Hermes Agent 本地开发备忘

## 推荐开发方式

代码建议在 WSL2 本地改，Docker 容器只用来运行、验证和调试。

核心方式是使用 Docker bind mount：

```text
WSL2 本地源码目录  <==实时同步==>  Docker 容器 /opt/hermes
```

这样在 VS Code / WSL2 里改代码后，容器里的 `/opt/hermes` 会立刻看到同一份源码，不需要 `docker cp`，也不需要每次因为源码改动就 rebuild。

## 从 WSL2 启动开发容器

如果源码还在 Windows D 盘：

```bash
cd /mnt/d/Development/Agent/hermes-agent
mkdir -p ~/.hermes
```

推荐的 Docker 开发方式分成两种：

- 一次性进入的交互式容器
- 长期保活的后台开发容器

### 方式 A：交互式启动（一次性 shell）

直接启动一个交互式开发容器：

```bash
docker run --rm -it --name hermes-agent-dev \
  --user root \
  -p 127.0.0.1:9119:9119 \
  -v "$PWD:/opt/hermes" \
  -v "$HOME/.hermes:/opt/data" \
  -w /opt/hermes \
  --entrypoint /bin/bash \
  hermes-agent:local --noprofile --norc
```

进入容器后，按用途执行：

```bash
# 日常 CLI / 测试 / 调试
cd /opt/hermes
uv sync --extra dev
uv run hermes
```

```bash
# dashboard / Web UI（项目自带功能，不是临时现写的）
cd /opt/hermes
uv sync --extra dev --extra web
.venv/bin/hermes dashboard --host 0.0.0.0 --port 9119 --no-open --insecure
```

```bash
# 常见 messaging gateway
cd /opt/hermes
uv sync --extra dev --extra messaging
.venv/bin/hermes gateway run
```

如果你使用的是某些平台专用能力，还可能要继续补对应 extra，例如：

```bash
uv sync --extra dev --extra messaging --extra feishu
uv sync --extra dev --extra messaging --extra dingtalk
```

这种方式的特点：

- 当前这个 shell 就是容器的主进程（PID 1）
- 退出 shell，容器就会立刻停止；`--rm` 还会顺手删掉容器
- 适合快速排查、临时验证、跑完即走
- 这里显式使用 `--user root`，是为了避免把宿主机 `~/.hermes` 挂载到 `/opt/data` 后出现 `/opt/data/.bashrc: Permission denied`
- 如果你用这种方式跑 dashboard 或 gateway，关闭当前 shell 后，它们也会一起结束，所以更适合临时验证，不适合长期挂着

如果镜像还没构建，先在 WSL2 里执行：

```bash
docker build -t hermes-agent:local .
```

上面的命令默认包含 `-p 127.0.0.1:9119:9119`，这样宿主机浏览器可以访问容器里的 dashboard。  
如果你完全不用 dashboard，可以把这一行删掉。  
普通 bot / WebSocket 模式的 gateway 通常不需要开放宿主机端口；只有 webhook 模式才通常需要额外做 `-p` 端口映射。

## 后台开发容器

日常开发更推荐先起一个后台容器，用 `sleep infinity` 保活，而不是让 `/bin/bash` 直接充当 PID 1：

```bash
docker run -d --name hermes-agent-dev \
  --user root \
  -p 127.0.0.1:9119:9119 \
  -v "$PWD:/opt/hermes" \
  -v "$HOME/.hermes:/opt/data" \
  -w /opt/hermes \
  --entrypoint sleep \
  hermes-agent:local infinity
```

上面的命令默认包含 `-p 127.0.0.1:9119:9119`，这样宿主机浏览器可以访问容器里的 dashboard。  
如果你完全不用 dashboard，可以把这一行删掉。  
普通 bot / WebSocket 模式的 gateway 通常不需要开放宿主机端口；只有 webhook 模式才通常需要额外做 `-p` 端口映射。

启动后，用下面这条命令进入：

```bash
docker exec -u root -it hermes-agent-dev /bin/bash --noprofile --norc
```

进入后台容器后，第一次使用时同样按用途执行：

```bash
# 日常 CLI / 测试 / 调试
cd /opt/hermes
uv sync --extra dev
uv run hermes
```

```bash
# dashboard / Web UI
cd /opt/hermes
uv sync --extra dev --extra web
.venv/bin/hermes dashboard --host 0.0.0.0 --port 9119 --no-open --insecure
```

```bash
# 常见 messaging gateway
cd /opt/hermes
uv sync --extra dev --extra messaging
.venv/bin/hermes gateway run
```

如果你使用的是某些平台专用能力，还可能要继续补对应 extra，例如：

```bash
uv sync --extra dev --extra messaging --extra feishu
uv sync --extra dev --extra messaging --extra dingtalk
```

这里和“交互式启动”没有本质区别。区别只在于：

- 交互式启动：`docker run` 时就直接把你带进一个新容器
- 后台启动：先让容器在后台活着，再用 `docker exec` 进去执行同样的项目命令

`uv sync --extra dev` 的作用是：

- 按照项目锁文件把 Python 依赖同步到当前环境
- 额外安装 `dev` 这一组开发依赖
- 确保容器里的依赖版本和项目声明保持一致

如果只是第一次进入容器或依赖刚有变动，建议先按你的用途跑一次对应的 `uv sync ...`；之后再执行 `uv run hermes`、`.venv/bin/hermes dashboard`、`.venv/bin/hermes gateway run`、测试命令或其他开发命令。

停止并删除：

```bash
docker stop hermes-agent-dev
docker rm hermes-agent-dev
```

## 交互式启动、后台启动、`docker exec` 的区别

### 1. 交互式启动

对应的是这类命令：

```bash
docker run --rm -it ... --entrypoint /bin/bash ...
```

- `docker run` 会新建一个容器，并立刻把你的终端接进去
- 你看到的这个 shell，就是容器当前的主进程
- 一旦退出 shell，这个容器通常就结束了
- 适合“进来做一件事，做完就走”

### 2. 后台启动

对应的是这类命令：

```bash
docker run -d ... --entrypoint sleep ... infinity
```

- `docker run -d` 会新建一个后台常驻容器
- 容器会持续运行，你可以反复进入、退出
- 关闭某一次 shell，不会把整个容器停掉
- 最适合日常开发、反复调试、持续保留环境

### `docker exec`

`docker exec` 不会创建容器。它只是“在一个已经运行中的容器里，再启动一个新进程”。

- 它只有在目标容器已经运行时才可用
- 它不会改掉容器最初的挂载、用户、entrypoint、工作目录
- 如果容器一开始就是用错误参数创建的，`docker exec` 修不好，只能删掉重建

可以把三者理解成：

- `docker run -it`：新开一个一次性容器，并立刻进去
- `docker run -d`：新开一个后台容器，让它先在后面活着
- `docker exec`：进入一个已经活着的旧容器

最稳的日常工作流通常是：

1. 先用后台模式启动一个开发容器
2. 需要进容器时，用 `docker exec -u root -it hermes-agent-dev /bin/bash --noprofile --norc`
3. 退出 shell 时，只是离开这次终端，不会销毁容器
4. 不需要这个开发环境时，再手动 `docker stop` / `docker rm`

## 确认源码是否已经挂载

查看容器挂载：

```bash
docker inspect hermes-agent-dev \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

如果看到类似：

```text
/mnt/d/Development/Agent/hermes-agent -> /opt/hermes
/home/alvinxds/.hermes -> /opt/data
```

说明本地源码已经同步到容器。

也可以做一个临时文件测试：

```bash
touch sync-test.txt
```

然后在容器里检查：

```bash
ls /opt/hermes/sync-test.txt
```

测试完删除：

```bash
rm sync-test.txt
```

## 注意事项

源码挂载不能在容器创建之后再补上。如果容器一开始不是这样启动的：

```bash
-v "$PWD:/opt/hermes"
```

那就需要删掉旧容器，重新执行一次 `docker run`。

`docker exec` 也改不了一个已存在容器的挂载、用户、entrypoint。比如旧容器如果是这样起的：

```bash
--entrypoint /bin/bash
```

而且容器内部是以 `hermes` 用户在跑，那么你后面再执行 `docker exec -it hermes-agent-dev /bin/bash`，很可能会持续遇到 `/opt/data/.bashrc: Permission denied`。

这种情况不要继续和旧容器较劲，直接删掉，按上面推荐的方式重新创建会更省时间。

`docker cp` 只是一次性的文件拷贝，比如：

```bash
docker cp /mnt/d/Development/Agent/hermes-agent/. hermes-agent-dev:/opt/hermes/
```

这不是实时同步，所以不适合日常开发。

最常用的一组日常命令：

```bash
cd /mnt/d/Development/Agent/hermes-agent

docker run -d --name hermes-agent-dev \
  --user root \
  -p 127.0.0.1:9119:9119 \
  -v "$PWD:/opt/hermes" \
  -v "$HOME/.hermes:/opt/data" \
  -w /opt/hermes \
  --entrypoint sleep \
  hermes-agent:local infinity

docker exec -u root -it hermes-agent-dev /bin/bash --noprofile --norc
```

## Git 日常流程

目标：

```text
本地 main 的改动推到自己的 fork
官方 NousResearch/hermes-agent 的更新可以拉到本地 main
不要把自己的改动误推到官方仓库
```

推荐 remote 结构：

```text
origin   -> https://github.com/chaoyanren/hermes-agent.git
upstream -> https://github.com/NousResearch/hermes-agent.git
```

先确认 remote：

```bash
git remote -v
```

禁止误推官方仓库：

```bash
git remote set-url --push upstream DISABLED
```

设置默认 push 到自己的 fork：

```bash
git config remote.pushDefault origin
git config push.default current
```

让本地 `main` 跟踪自己的 `origin/main`：

```bash
git checkout main
git branch --set-upstream-to=origin/main main
```

如果提示 `origin/main` 不存在，先执行：

```bash
git fetch origin
git push -u origin main
```

日常推自己的改动：

```bash
git push
```

从官方仓库拉更新到本地 `main`：

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

合并后推回自己的 fork：

```bash
git push
```

理想的 remote 输出类似：

```text
origin    https://github.com/chaoyanren/hermes-agent.git (fetch)
origin    https://github.com/chaoyanren/hermes-agent.git (push)
upstream  https://github.com/NousResearch/hermes-agent.git (fetch)
upstream  DISABLED (push)
```

如果看到大量文件变成 `M`，先不要急着 push 或 merge。回到真实源码目录：

```bash
cd /mnt/d/Development/Agent/hermes-agent
```

不要在 Docker Desktop 的内部 bind mount 路径里做 Git 操作，例如：

```text
/mnt/wsl/docker-desktop-bind-mounts/...
```

如果大量改动只是文件权限变化，可以关闭当前仓库的 file mode 检测：

```bash
git config core.fileMode false
git status --short
```
