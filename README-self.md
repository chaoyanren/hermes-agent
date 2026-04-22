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

启动一个可交互的开发容器：

```bash
docker run --rm -it --name hermes-agent-dev \
  -v "$PWD:/opt/hermes" \
  -v "$HOME/.hermes:/opt/data" \
  -w /opt/hermes \
  --entrypoint /bin/bash \
  hermes-agent:local
```

进入容器后：

```bash
cd /opt/hermes
uv sync --extra dev
uv run hermes
```

如果容器镜像还没有构建，先在 WSL2 源码目录执行：

```bash
docker build -t hermes-agent:local .
```

## 后台启动开发容器

如果想让容器在后台保持运行：

```bash
docker run -d -it --name hermes-agent-dev \
  -v "$PWD:/opt/hermes" \
  -v "$HOME/.hermes:/opt/data" \
  -w /opt/hermes \
  --entrypoint /bin/bash \
  hermes-agent:local
```

进入后台容器：

```bash
docker exec -it hermes-agent-dev /bin/bash
```

停止并删除容器：

```bash
docker stop hermes-agent-dev
docker rm hermes-agent-dev
```

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

已经创建好的容器不能后补挂载源码目录。如果之前启动容器时没有加：

```bash
-v "$PWD:/opt/hermes"
```

就需要删除旧容器，重新 `docker run`。

`docker cp` 只能一次性复制文件，例如：

```bash
docker cp /mnt/d/Development/Agent/hermes-agent/. hermes-agent-dev:/opt/hermes/
```

这不是实时同步，开发时不推荐。

日常最常用命令：

```bash
cd /mnt/d/Development/Agent/hermes-agent

docker run --rm -it --name hermes-agent-dev \
  -v "$PWD:/opt/hermes" \
  -v "$HOME/.hermes:/opt/data" \
  -w /opt/hermes \
  --entrypoint /bin/bash \
  hermes-agent:local
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
