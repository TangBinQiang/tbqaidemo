## 【实践】开发一个基于Spring AI + Ollama + DeepSeek的聊天应用

在本案例中，我们将开发一个基于Spring AI、Ollama和DeepSeek的聊天应用。通过整合这些技术，我们可以构建一个高效的文本生成系统，实现与用户的实时交互。具体来说，我们将：

- 使用Spring Boot作为后端框架，提供RESTful API接口。
- 利用Ollama作为大模型部署工具，连接Spring Boot与DeepSeek模型。
- 通过MySQL数据库存储用户与机器人的对话记录。
- 前端采用Vue.js实现一个简洁的用户界面，支持实时流式交互。

最终，用户可以通过前端界面输入问题，后端通过调用DeepSeek模型生成回答，并将对话记录存储在数据库中。此外，系统还支持历史消息的查询和显示，为用户提供更流畅的交互体验。

案例效果如下图所示：

<img src="../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250402095229042.png" alt="image-20250402095229042" style="zoom: 67%;" />

### 1. 环境准备

#### 安装Docker

Ubuntu系统在安装过程中会要求用户设置一个普通用户账户的密码，而root用户的密码默认是被禁用的，也就是说，用户无法直接使用root用户登录系统。

如果需要使用root用户权限，可以通过`sudo`命令来获取，输入的是当前普通用户的密码，而不是root用户的密码。如果确实需要设置root用户的密码，可以通过以下命令来设置：

~~~sh
sudo passwd
~~~

切换到root

~~~sh
su -
~~~

执行以下命令下载Docker

~~~sh
export DOWNLOAD_URL="https://mirrors.tuna.tsinghua.edu.cn/docker-ce"
# 如您使用 curl
curl -fsSL https://raw.githubusercontent.com/docker/docker-install/master/install.sh | sh
# 如您使用 wget
wget -O- https://raw.githubusercontent.com/docker/docker-install/master/install.sh | sh
~~~

如果你过去安装过 docker，先删掉：

~~~sh
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do apt-get remove $pkg; done
~~~

首先安装依赖：

~~~sh
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
~~~

信任 Docker 的 GPG 公钥并添加仓库：

~~~sh
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
~~~

最后安装：

~~~sh
apt-get update
apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
~~~

修改Docker镜像，改为国内镜像，加快下载速度，修改 daemon.json 文件：

~~~sh
sudo tee /etc/docker/daemon.json <<-'EOF'
{
    "registry-mirrors": [
    	"https://docker.m.daocloud.io",
    	"https://docker.hlmirror.com",
    	"https://docker.imgdb.de",
    	"https://docker-0.unsee.tech",
    	"https://docker.1ms.run",
    	"https://func.ink",
    	"https://lispy.org",
    	"https://docker.xiaogenban1993.com"
    ]
}
EOF
~~~

查看 `daemon.json` 文件：

~~~sh
cat /etc/docker/daemon.json
~~~

在 Ubuntu 上安装完 Docker 后，可以使用以下命令启动 Docker 并检查其运行状态：

启动 Docker：

```sh
systemctl start docker
```

查看 Docker 运行状态：

```sh
systemctl status docker
```

如果 Docker 正常运行，你会看到类似于 `active (running)` 的输出。

如果希望 Docker 在系统启动时自动启动，可以运行：

```sh
systemctl enable docker
```

测试 Docker 是否正常运行，可以运行一个测试容器：

```
docker run hello-world
```

如果 Docker 运行正常，你会看到一条欢迎消息。

~~~
root@liu-VM:~# sudo docker run hello-world

Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (amd64)
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client, which sent it
    to your terminal.

To try something more ambitious, you can run an Ubuntu container with:
 $ docker run -it ubuntu bash

Share images, automate workflows, and more with a free Docker ID:
 https://hub.docker.com/

For more examples and ideas, visit:
 https://docs.docker.com/get-started/
~~~

如果遇到问题，可以检查日志：

```
sudo journalctl -u docker --no-pager | tail -n 50
```

如果你打算不用 `sudo` 运行 Docker，可以把当前用户添加到 `docker` 组：

```
sudo usermod -aG docker $USER
newgrp docker
```

#### 安装MySQL

##### linux版本

首先，拉取 MySQL 官方镜像：

```sh
docker pull mysql:8
```

如果网络访问受限，建议使用国内镜像：

```sh
docker pull registry.cn-hangzhou.aliyuncs.com/libray/mysql:8
```

运行 MySQL 容器，使用 `docker run` 命令启动 MySQL，并配置编码和时区：

~~~sh
docker run -d \
  --name mysql8 \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e TZ=Asia/Shanghai \
  -e MYSQL_DATABASE=mydb \
  -e MYSQL_USER=myuser \
  -e MYSQL_PASSWORD=root \
  --restart unless-stopped \
  -v mysql_data:/var/lib/mysql \
  mysql:8
~~~

**参数解释**：

- `-d`：后台运行容器
- `--name mysql8`：容器名称
- `-p 3306:3306`：映射宿主机端口到容器
- `-e MYSQL_ROOT_PASSWORD=yourpassword`：设置 root 用户密码（请替换 `yourpassword`）
- `-e TZ=Asia/Shanghai`：设置时区为上海
- `-e MYSQL_DATABASE=mydb`：创建一个数据库 `mydb`
- `-e MYSQL_USER=myuser`：创建一个用户 `myuser`
- `-e MYSQL_PASSWORD=mypassword`：设置 `myuser` 的密码
- `--restart unless-stopped`：容器运行中意外崩溃、Docker 服务或宿主机重启时自动启动 MySQL（常驻后台运行的服务（如 Web 服务器、数据库等））
- `-v mysql_data:/var/lib/mysql`：数据持久化，避免容器销毁后数据丢失

虽然 MySQL 8.0 默认使用 `utf8mb4`，但为了确保一致性，我们可以创建一个 MySQL 配置文件。

创建 MySQL 配置目录

```
mkdir -p /etc/mysql/conf.d
```

创建 MySQL 配置文件

~~~sh
sudo tee /etc/mysql/conf.d/my.cnf <<EOF
[mysqld]
character-set-server=utf8mb4
collation-server=utf8mb4_general_ci
init_connect='SET NAMES utf8mb4'
default-time-zone='+08:00'

[client]
default-character-set=utf8mb4

[mysql]
default-character-set=utf8mb4
EOF
~~~

挂载配置文件并重启 MySQL重新运行容器，使配置生效：

~~~sh
docker stop mysql8 # 关闭容器
docker rm mysql8 #删除容器
# 重新创建并运行容器
docker run -d \
  --name mysql8 \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root \
  -e TZ=Asia/Shanghai \
  -v /etc/mysql/conf.d:/etc/mysql/conf.d \
  -v mysql_data:/var/lib/mysql \
  --restart unless-stopped \
  mysql:8
~~~

进入 MySQL 容器并检查配置

进入 MySQL 容器：

```sh
docker exec -it mysql8 mysql -uroot -p
```

输入 `yourpassword` 登录 MySQL 后，执行：

```sh
SHOW VARIABLES LIKE 'character%';
SHOW VARIABLES LIKE 'collation%';
SELECT @@global.time_zone, @@session.time_zone;
```

如果输出：

- `character_set_server = utf8mb4`
- `collation_server = utf8mb4_general_ci`
- `@@global.time_zone = SYSTEM`
- `@@session.time_zone = SYSTEM`

说明配置成功。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250328102511007.png]]

默认情况下，MySQL 只允许本地访问，如果需要远程连接：

进入 MySQL 终端：

~~~sh
docker exec -it mysql8 mysql -uroot -p
~~~

修改 root 用户权限：

~~~sql
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
~~~

修改 MySQL 配置文件（如果未修改）：

~~~sh
sudo vim /etc/mysql/conf.d/my.cnf
[mysqld]
bind-address=0.0.0.0
~~~

重启容器：

~~~
docker restart mysql8
~~~

在宿主机或远程客户端使用：

~~~
mysql -h <your-server-ip> -u root -p
~~~

##### **window版本**

在Windows平台上，MySQL提供了两种安装方式：MySQL二进制分发版（.msi安装文件）和免安装版（.zip压缩文件）。通常情况下，推荐使用二进制分发版，因为它相较于其他版本更为简便，无需借助其他工具即可直接启动并运行MySQL。

接下来，我们将介绍如何下载MySQL安装文件。具体操作步骤如下：

打开IE浏览器，在地址栏中输入网址“https://dev.mysql.com/downloads/installer/”，进入MySQL官方下载页面。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250520154117933.png]]

在MySQL官方下载页面中，我们可以清晰地看到当前最新版本为8.0.42。同时，页面上提供了两个32位安装程序：mysql-installer-web-community和mysql-installer-communityl。

- mysql-installer-web-community版本适合在线安装

- mysql-installer-communityl则是离线安装版本。

为了方便后续安装，我们推荐选择离线安装版本，并点击“Download”按钮进入下载页面。在下载页面中，点击底部的“No thanks, just start my download.”进行下载。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250520154256674.png]]

双击已下载的mysql-installer-community-8.0.42.0.msi文件，即可启动安装程序。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250520155104741.png]]

在安装程序启动后，会看到四种不同的安装类型供选择，它们分别是：

- Server only（仅作为服务器使用）

- Client only（仅作为客户端使用）

- Full（完整安装）

- Custom（自定义安装）

根据个人需求，这里我们选择Custom（自定义安装类型）单选按钮，并点击Next（下一步）按钮进入下一步操作。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250520155226646.png]]

在界面左侧，我们会看到一系列可选组件，包括MySQL Server 8.0.36-X64、MySQL Documentation 8.0.36-X86以及Samples and Examples 8.0.36-X86。利用右箭头，将这些组件一一选中并导入到右侧的安装列表中，建议选择的组件：

- MySQL Server 8.0.42 - X64  ：必选，数据库服务核心组件。
- MySQL Shell 8.0.42 - X64：建议安装，MySQL 新版命令行工具，支持 SQL、JavaScript、Python 三种模式，做一些自动化、脚本或新特性管理（如 InnoDB Cluster）时很好用。
- MySQL Workbench 8.0.42 - X64：建议安装，图形化的数据库管理工具，可以执行 SQL、设计数据表、查看执行计划等。

| 组件名称        | 是否建议安装 | 说明                   |
| --------------- | ------------ | ---------------------- |
| MySQL Server    | ✔️            | 必选                   |
| MySQL Workbench | ✔️            | 图形管理工具，建议安装 |
| MySQL Shell     | ✔️            | 新命令行工具，建议安装 |
| MySQL Router    | ❌            | 仅在集群时需要         |
| Documentation   | ❌            | 一般不需要，查官网即可 |

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250520155852870.png]]

点击【Execute】（执行）按钮，启动安装进程。一旦安装完成，界面上将呈现3个绿色的勾选标记。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250520160558139.png]]

完成MySQL的安装后，紧接着需要对服务器进行配置。以下是具体的配置步骤：

在上一节的最后一步中，点击【Next】（下一步）按钮，将引导您进入产品信息窗口。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/f8438d0e933d7e8bc20894650f163a51.png]]

点击【Next】（下一步）按钮后，您将进入服务器配置窗口。在此，选择采用默认配置。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/f8438d0e933d7e8bc20894650f163a51-17477284644022.png]]

在服务器配置窗口中，【Config Type】选项允许您设定服务器的类型。通过点击该选项右侧的下三角按钮，将呈现三个可选项供您选择。

<img src="../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/171e53696bf7d90220c231201cffebd5.png" alt="171e53696bf7d90220c231201cffebd5" style="zoom:80%;" />

- Development Computer（开发计算机）：此选项适用于典型的个人桌面工作站，其中运行着多个桌面应用程序。MySQL服务器将优化配置，以最小化系统资源的使用。
- Server Computer（服务器）：此选项代表服务器，MySQL服务器可与其他应用程序（如FTP、Email和Web服务器）一同运行。MySQL服务器的配置将确保合理利用系统资源。
- Dedicated Computer（专用服务器）：此选项专为仅运行MySQL服务的服务器而设。由于不运行其他服务程序，MySQL服务器将充分利用所有可用系统资源。

对于初学者而言，推荐选择【Development Computer】（开发机器）选项，因为它对系统资源的占用较少。接下来，单击【Next】（下一步）按钮，将打开设置授权方式的窗口，请在此选择第二个单选项。

<img src="../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/f02fc7c827047ee226393a0dd4a83198.png" alt="f02fc7c827047ee226393a0dd4a83198" style="zoom:80%;" />

在设置授权方式的窗口中，第一个单选项代表MySQL 8.0引入的新授权方式，它基于SHA256密码加密技术；而第二个单选项则是指传统的授权方法，与5.x版本保持兼容。

接下来，单击【Next】按钮，将进入设置服务器密码的界面，在此需要输入并确认两次相同的登录密码。

<img src="../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/b9f4cf8b9ef25fe46f5492182d879c80.png" alt="b9f4cf8b9ef25fe46f5492182d879c80" style="zoom:80%;" />

系统默认的用户名称为root，若需增添新用户，请点击【Add User】（添加用户）按钮进行操作。

紧接着，单击【Next】（下一步）按钮，将呈现设置服务器名称的界面。在此案例中，我们将服务器名称设定为“MySQL”。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/7447a43c767c8f3992ddc98bb4c895de.png]]

点击【Next】（下一步）按钮后，将进入服务器文件权限设置界面。在此，我们建议保持默认设置，仅赋予运行Windows服务的用户和管理员组以完全访问权限。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/06aaec24e39ee626b6b8f8d65a60230b.png]]

点击【Next】（下一步）后，将呈现一个确认服务器设置的窗口，此时，只需单击【Execute】（执行）按钮即可。
![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/520321f1b27bf7a96ff91d1c63aa842f.png]]

系统将自动进行MySQL服务器的配置工作。一旦配置完毕，只需点击【Finish】（完成）按钮，即可顺利结束服务器的配置过程。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/d5b117b6df86f22083a4af42a93be4d5.png]]

至此，您已在Windows 11操作系统上成功安装了MySQL。

#### 安装Ollama

Ollama是一个用于本地运行大型语言模型的工具，支持多种模型。以下是安装与配置的详细步骤：

**步骤1：下载Ollama**

- 访问Ollama官方网站：https://ollama.com/，点击Download下载，如下图所示。：

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429105703514.png]]

- 下载的文件：

  ![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429105830827.png]]

**步骤2：安装Ollama**

- 下载完成后，得到“OllamaSetup.exe”文件，运行该文件，点击“Install”开始安装，按照提示完成安装过程。

![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429105923764.png]]

**步骤3：验证安装**

- 安装完成之后，打开一个新的命令提示符窗口，输入“ollama”命令，如果显示ollama相关的信息就证明安装已经成功了！

  ![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429110003702.png]]

**步骤4：配置模型存储路径**

默认情况下，ollama模型的存储目录位于C:\Users\<username>\.ollama\models，在Windows系统中，若要更改Ollama模型的存放位置，需要在环境变量窗口中，点击“新建”创建一个新的系统变量或用户变量：

- 变量名：`OLLAMA_MODELS`
- 变量值：输入你希望设置的新模型存放路径，例如：`D:\Ollama\Models`

如下图所示：

<img src="../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250221165627535.png" alt="image-20250221165627535" style="zoom:80%;" />

最后，重启已经打开的Ollama相关应用程序，以便新的路径生效。

**步骤5：安装模型**

- 访问Ollama官方网站：https://ollama.com/，点击模型，输入“deepseek”，点击搜索放大镜，在结果中点击deepseek--r1模型。

  ![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429110543149.png]]

- 在模型详情页面，用户可以找到运行DeepSeek-R1模型的具体命令。页面列出了DeepSeek团队开发的原始基础模型，该模型拥有6710亿（B代表十亿)参数。此外，还展示了多个经过蒸馏处理的模型，它们的参数量从1.5B到32B不等。

  ![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429110708433.png]]

- 这些蒸馏模型通过将大型模型的高级推理能力迁移到更小的模型中，不仅提升了性能，而且在基准测试中展现出卓越的表现。这种技术的应用使得小型模型在保持高效的同时，也能够拥有接近大型模型的推理能力。

  用户可以根据自己的硬件配置和需求选择适合的DeepSeek-R1模型进行下载和部署。以下是不同参数量模型的本地部署硬件要求和适用场景分析：

  | 模型版本 | 显存需求（量化后） | 推荐硬件         | 典型场景                                         |
  | :------- | :----------------- | :--------------- | :----------------------------------------------- |
  | **1.5B** | 4-6GB              | RTX 3060/T4      | 移动端实时交互、嵌入式设备                       |
  | **7B**   | 6-8GB              | RTX 3090（单卡） | 中小型企业对话系统                               |
  | **14B**  | 12GB               | A10/A100（单卡） | 本地知识库、政务服务智能客服12                   |
  | **32B**  | 19-24GB            | RTX 4090/A100    | 金融分析、代码生成                               |
  | **671B** | 640GB+             | 8张A100-80GB集群  | 超大规模科研计算、多模态推理等，需企业级硬件支持 |

- 选择好合适的模型后，打开新的命令行窗口，输入相应命令并运行，此处选择1.5B模型，命令如下：

  ~~~
  ollama run deepseek-r1:1.5b
  ~~~

- 运行deepseek后可以与其对话

  ![[../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250429111035538.png]]

### 2.后端实现

#### 项目基本配置

后端技术栈采用SpringBoot3+MyBatisPlus+SpringAI的方式。

**MySQL 数据表设计**

我们需要一张表来存储用户和机器人的对话记录。以下是 `messages` 表的设计：

| 字段名     | 类型        | 描述                          |
| ---------- | ----------- | ----------------------------- |
| id         | BIGINT      | 主键，自增                    |
| sender     | VARCHAR(50) | 消息发送者（`user` 或 `bot`） |
| content    | TEXT        | 消息内容                      |
| created_at | DATETIME    | 消息创建时间                  |

创建数据库命令：

~~~sql
CREATE DATABASE chat_db;
use chat_db
~~~

创建MySQL数据表命令：

~~~sql
CREATE TABLE messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
~~~

**后端配置文件及依赖**

application.properties配置文件内容如下：

~~~properties
spring.application.name=ollama-demo
server.port=8080

#Ollama
spring.ai.ollama.base-url=http://localhost:11434
spring.ai.ollama.chat.model=deepseek-r1:1.5b
spring.ai.ollama.embedding.options.model=shaw/dmeta-embedding-zh:latest

#MySQL
spring.datasource.url=jdbc:mysql://localhost:3306/chat_db?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=Asia/Shanghai
spring.datasource.username=root
spring.datasource.password=root
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# MyBatis-Plus
mybatis-plus.mapper-locations=classpath:/mapper/*.xml
mybatis-plus.configuration.log-impl=org.apache.ibatis.logging.stdout.StdOutImpl
logging.level.com.example.chat=DEBUG
~~~

pom.xml依赖信息如下：

~~~xml
<properties>
    <java.version>17</java.version>
    <spring-ai.version>1.0.0-M6</spring-ai.version>
</properties>
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-ollama-spring-boot-starter</artifactId>
    </dependency>
    <dependency>
        <groupId>com.alibaba.fastjson2</groupId>
        <artifactId>fastjson2</artifactId>
        <version>2.0.42</version>
    </dependency>
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>8.0.33</version>
    </dependency>
    <dependency>
        <groupId>com.baomidou</groupId>
        <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
        <version>3.5.11</version>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.ai</groupId>
            <artifactId>spring-ai-bom</artifactId>
            <version>${spring-ai.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
~~~

#### 后端代码实现

##### 实体类

基于数据表messages设计实体类`Message.java`：

~~~java
package com.example.ollama_demo.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDateTime;

@TableName("messages")
public class Message {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sender;

    private String content;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "Message{" +
                "id=" + id +
                ", sender='" + sender + '\'' +
                ", content='" + content + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
~~~

##### Mapeper与Service

Mapper接口MessageMapper继承MybatisPlus提供的BaseMapper：

~~~java
@Mapper
public interface MessageMapper extends BaseMapper<Message> {}
~~~

Service接口MessageService继承MybatisPlus提供的IService：

~~~java
public interface MessageService extends IService<Message> {}
~~~

MessageServiceImpl继承MybatisPlus提供的ServiceImpl，并实现MessageService接口：

~~~java
@Service
public class MessageServiceImpl extends ServiceImpl<MessageMapper, Message> implements MessageService {}
~~~

##### 控制器层

控制器层整体后端 API 设计如下：

- 获取历史消息

  - URL: `/messages`

  - Method: `GET`

  - Response: `[{"id": 1, "sender": "user", "content": "你好", "created_at": "2025-04-01T13:00:00"}, ...]`

- 流式问答
  - URL: `/stream`
  - Method: `GET`
  - Params: `prompt` (用户提问)
  - Response: SSE 流式响应

- **SSE（Server-Sent Events）** 是一种基于 HTTP 的**单向通信协议**，允许服务器通过持续连接向浏览器“推送”实时数据。

  它使用的是标准的 HTTP 协议（不是 WebSocket），适合做**流式输出**或**实时更新的场景**，如：

  - 实时聊天 AI 回复（比如 ChatGPT 打字机效果）
  - 实时日志更新
  - 股票行情推送
  - 新闻消息流

SSE 是一种比 WebSocket 更简单、专为“服务端单向实时推送”设计的协议，非常适合 AI 回复、实时日志等轻量场景。

| 特性       | 描述                                   |
| ---------- | -------------------------------------- |
| 协议       | 基于 HTTP（不是 WebSocket）            |
| 通信方向   | 服务器 ➜ 客户端（单向）                |
| 传输格式   | 文本（UTF-8 编码），格式固定           |
| 浏览器支持 | 大部分现代浏览器原生支持 `EventSource` |
| 保持连接   | 客户端会自动重连（断线重连）           |
| 开发简单   | 不需要额外协议或握手，基于纯文本流     |

服务端返回的内容是“流式文本”，格式如下：

~~~
event: message
data: {"text": "你好"}

event: message
data: {"text": "请问有什么可以帮你？"}
~~~

规则说明：

- 每条事件之间通过 **空行分隔**
- 每条数据前必须加 `data:` 前缀
- 可以指定事件类型：`event: xxx`
- 客户端监听时可以用 `.onmessage` 或 `.addEventListener('message', ...)`   

**Spring Boot 中的 SSE 后端实现（WebFlux）**

你可以用 Spring WebFlux 中的 `Flux<ServerSentEvent<?>>` 来实现 SSE，例如：

~~~java
@GetMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<String>> stream() {
    return Flux.interval(Duration.ofSeconds(1))
        .map(i -> ServerSentEvent.builder("第" + i + "条消息")
                                 .event("message")
                                 .build());
}
~~~

**浏览器端：用 `EventSource` 监听 SSE**

~~~js
const eventSource = new EventSource("/chat/stream"); // 后端 SSE 地址

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log("收到消息:", data);
};

eventSource.onerror = function(err) {
  console.error("连接出错，自动重连中:", err);
};
~~~

MessageController代码如下：

~~~java
@RestController
@CrossOrigin
class MessageController {
    @Autowired
    private MessageService messageService;
    @Autowired
    private OllamaChatModel ollamaChatModel;

    // 获取历史消息
    @GetMapping("/messages")
    public List<Message> getMessages() {
        return messageService.list();
    }

    // 发送消息并流式获取 AI 回复
    @GetMapping("/stream")
    public Flux<ServerSentEvent<String>> sendMessage(String prompt){
        //保存用户消息
        Message umsg = new Message();
        umsg.setCreatedAt(LocalDateTime.now());
        umsg.setSender("user");
        umsg.setContent(prompt);
        messageService.save(umsg);

        StringBuilder aiResponseBuilder = new StringBuilder();
        /*
        调用 Ollama 进行流式聊天:
        .stream(): 对应 LLM 返回内容时是一个 token 一个 token 地返回（符合 SSE，即 Server-Sent Events 的流式响应机制）
         非 .stream() 模式下会等待 LLM 输出完整的响应后一次性返回。
         
        .map: 对每个流式返回的 token 执行映射操作,
          把每个从模型流式输出的 token（一个对象）转换成前端能接收的 Server-Sent Event（SSE）格式消息(从模型原始输出到 SSE 消息的“格式转换”。), SSE封装了事件名和数据体。
          
        .event("message")，设置事件名为 "message"，前端可以通过监听 message 事件来处理新 token 的输出。
         */
        return ollamaChatModel.stream(prompt).map(token -> {
            // 逐步累积 AI 回复
            aiResponseBuilder.append(token); 
            return ServerSentEvent.builder(token).event("message").build();
        })
            // 响应流结束时的回调操作,即 AI 模型所有 token 全部输出完毕时被调用
            .doOnComplete(()->{
                // 保存AI回复消息，AI 生成完成后保存到数据库
                Message aiMessage = new Message();
                aiMessage.setSender("bot");
                aiMessage.setContent(aiResponseBuilder.toString());
                aiMessage.setCreatedAt(LocalDateTime.now());
                System.out.println(aiMessage);
                messageService.save(aiMessage);
            });
    }
}
~~~

这段代码用于**将 Ollama 模型的生成内容实时推送给前端（浏览器）**，前端可以即时渲染用户看到的回答过程，常见于类似 ChatGPT 的打字机效果。

如果你用 JavaScript 编写前端，可以这样接收：

~~~js
const eventSource = new EventSource("/chat/stream");
eventSource.onmessage = function(event) {
    console.log("收到一个 token:", event.data);
};
~~~

### 3. 前端实现

#### 环境配置

- 已安装 18.3 或更高版本的 [Node.js](https://nodejs.org/)

- 在命令行中运行以下命令创建新的Vue项目：

  ~~~sh
   npm create vue@latest
  ~~~

- 在项目被创建后，通过以下步骤安装依赖并启动开发服务器：

  ~~~sh
  cd <your-project-name>
  npm install
  npm run dev
  ~~~

- 参考Vue.js官网：https://cn.vuejs.org/guide/quick-start.html

#### 前端基本配置

后端技术栈采用Vue3+ElementPlus+Axios的方式，实现效果如下图所示：

<img src="../【实践】开发一个基于Spring AI + Ollama + DeepSeek的文本生成API.assets/image-20250402095229042.png" alt="image-20250402095229042" style="zoom: 67%;" />

package.json配置文件内容如下：

~~~json
{
    "name": "chat-app",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
    },
    "dependencies": {
        "element-plus": "^2.9.7",
        "marked": "^15.0.7",
        "vue": "^3.5.13"
    },
    "devDependencies": {
        "@vitejs/plugin-vue": "^5.2.1",
        "axios": "^1.8.4",
        "vite": "^6.2.1",
        "vite-plugin-vue-devtools": "^7.7.2"
    }
}
~~~

#### 前端代码实现

首先在main.js中引入element-plus：

~~~js
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus)
app.mount('#app')
~~~

在components目录中创建自定义组件chat.vue，界面结构设计如下：

~~~html
<template>
    <div class="chat-container">
        <!-- 聊天窗口 -->
        <div class="chat-box" ref="chatBox">
            <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.sender]">
                <!-- 消息内容 -->
                <div class="message-content-wrapper">
                    <!-- 头像 -->
                    <img
                         :src="msg.sender === 'user' ? userAvatar : botAvatar"
                         alt="avatar"
                         :class="['avatar', msg.sender]"
                         />
                    <!-- 消息内容 -->
                    <div class="message-content">
                        <!-- 如果是系统消息，解析 <think> 标签并渲染 Markdown -->
                        <span v-if="msg.sender === 'bot'">
                            <span
                                  v-for="(part, idx) in parseMessageContent(msg.content)"
                                  :key="idx"
                                  :class="part.isThink && part.text.trim() ? 'think-content' : ''"
                                  >
                                <span v-if="part.isThink && part.text.trim()">
                                    <!-- 渲染思考内容的 Markdown -->
                                    <span v-html="renderMarkdown(part.text)"></span>
                                </span>
                                <span v-else>
                                    <!-- 渲染普通内容的 Markdown -->
                                    <span v-html="renderMarkdown(part.text)"></span>
                                </span>
                                <br v-if="part.isThink && part.text.trim()"> <!-- 在思考内容后添加换行 -->
                            </span>
                        </span>
                        <!-- 如果不是系统消息，直接显示用户输入的内容 -->
                        <span v-else>{{ msg.content }}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area">
            <!-- 文件上传 -->
            <el-upload
                       class="upload-btn"
                       action="#"
                       :before-upload="handleFileUpload"
                       :show-file-list="false"
                       >
                <el-button type="primary" size="small">上传文件</el-button>
            </el-upload>

            <!-- 消息输入框 -->
            <el-input
                      v-model="inputMessage"
                      placeholder="请输入消息"
                      class="message-input"
                      @keyup.enter="sendMessage"
                      ></el-input>

            <!-- 发送按钮 -->
            <el-button type="primary" size="small" @click="sendMessage">发送</el-button>
        </div>
    </div>
</template>
~~~

页面脚本代码实现如下：

~~~js
import { ref, onMounted } from "vue";
import axios from "axios";
import { marked } from "marked"; // 引入 marked 库

export default {
    name: "Chat",
    setup() {
        const inputMessage = ref("");
        const messages = ref([]);
        const userAvatar = ref("/images/user-avatar.png");
        const botAvatar = ref("/images/bot-avatar.png");

        // 渲染 Markdown 内容
        const renderMarkdown = (content) => {
            return marked(content); // 将 Markdown 转换为 HTML
        };

        // 解析消息内容，分离 <think> 标签
        const parseMessageContent = (content) => {
            const parts = [];
            let remaining = content;

            while (remaining.includes("<think>") && remaining.includes("</think>")) {
                const thinkStart = remaining.indexOf("<think>");
                const thinkEnd = remaining.indexOf("</think>") + "</think>".length;

                // 添加普通内容（<think>之前的部分）
                if (thinkStart > 0) {
                    parts.push({ text: remaining.slice(0, thinkStart), isThink: false });
                }

                // 提取 <think> 内容
                const thinkContent = remaining.slice(thinkStart + "<think>".length, thinkEnd - "</think>".length);
                parts.push({ text: thinkContent, isThink: true });

                // 剩余部分
                remaining = remaining.slice(thinkEnd);
            }

            // 添加剩余的普通内容
            if (remaining) {
                parts.push({ text: remaining, isThink: false });
            }

            return parts;
        };

        // 发送消息并流式接收 AI 回复
        const sendMessage = () => {
            if (!inputMessage.value.trim()) return;

            // 1.先存储用户消息
            const userMsg = { sender: "user", content: inputMessage.value };
            messages.value.push(userMsg);

            const userText = inputMessage.value;
            inputMessage.value = ""; // 清空输入框

            // 2.添加一个空的 AI 消息
            const botMsg = { sender: "bot", content: "" };
            messages.value.push(botMsg);

            // 3.使用 EventSource 流式接收数据
            const eventSource = new EventSource(`http://localhost:8080/stream?prompt=${encodeURIComponent(userText)}`);

            // 4.监听流式返回数据，拼接 AI 回复
            eventSource.onmessage = (event) => {
               botMsg.content += event.data; // 拼接内容

                // 触发视图更新
                messages.value = [...messages.value];
            };

            // 5.监听错误，关闭连接
            eventSource.onerror = () => {
                eventSource.close();
            };
        };

        // 组件加载时获取历史聊天记录
        const loadHistory = async () => {
            try {
                const response = await axios.get("http://localhost:8080/messages");
                messages.value = response.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            } catch (error) {
                console.error("获取历史消息失败:", error);
            }
        };

        onMounted(loadHistory);

        return {
            inputMessage,
            messages,
            userAvatar,
            botAvatar,
            sendMessage,
            parseMessageContent,
            renderMarkdown, // 返回渲染 Markdown 的方法
        };
    },
};

~~~

页面样式实现代码如下：

~~~css
/* 全局样式 */
html,
body {
    margin: 0;
    padding: 0;
    height: 100%;
}

.chat-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 16px); /* 减去一点边距 */
    width: 100%;
    max-width: 600px;
    margin: auto;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
    background-color: #fff;
}

.chat-box {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
    background-color: #f5f5f5;
}

.message {
    margin-bottom: 10px;
    display: flex;
    justify-content: flex-start; /* 默认左对齐 */
    align-items: flex-start;
}

.message.user {
    justify-content: flex-end; /* 用户消息右对齐 */
}

.message.bot .message-content {
    justify-content: flex-start; /* 系统消息左对齐 */
}

.message-content-wrapper {
    display: flex;
    align-items: flex-start;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin: 0 10px; /* 设置头像与消息之间的间距 */
}

.avatar.user {
    order: 2; /* 用户头像放在消息之后 */
}

.avatar.bot {
    order: 0; /* 机器人头像放在消息之前 */
}

.message-content {
    max-width: 70%;
    padding: 8px 12px;
    border-radius: 16px;
    word-wrap: break-word;
    margin-right: 10px; /* 给用户消息留出空间 */
}

.message.user .message-content {
    background-color: #409eff;
    color: white;
    margin-right: 0; /* 取消用户消息右边距 */
    margin-left: 10px; /* 给用户消息左边距 */
}

.message.bot .message-content {
    background-color: #e4e7ed;
    color: black;
    margin-left: 10px; /* 给机器人消息左边距 */
    text-align: left;
}

.think-content {
    /* font-style: italic; */
    font-size: 14px;
    color: gray;
    /* background-color: #e0e0e0;   */
    padding: 2px 4px; 
    border-radius: 4px; 
    margin-right: 5px;
    display: block; /* 强制换行 */
    text-align: left;
}

.input-area {
    display: flex;
    align-items: center;
    padding: 10px;
    border-top: 1px solid #ccc;
    background-color: #fff;
}

.upload-btn {
    margin-right: 10px;
}

.message-input {
    flex: 1;
    margin-right: 10px;
}
/* 思考内容的样式 */
.think-content {
    color: gray;
    /* background-color: #f0f0f0; */
    padding: 2px 4px;
    border-radius: 4px;
    margin-right: 5px;
    display: block; /* 强制换行 */
    position: relative; /* 用于定位伪元素 */
    padding-left: 16px; /* 给竖线留出空间 */
}

/* 添加灰色竖线 */
.think-content::before {
    content: ""; /* 必须设置 content 属性 */
    position: absolute;
    left: 4px; /* 竖线距离左边的位置 */
    top: 50%; /* 竖线垂直居中 */
    transform: translateY(-50%);
    width: 4px; /* 竖线宽度 */
    height: 80%; /* 竖线高度 */
    background-color: #ccc; /* 灰色竖线颜色 */
    border-radius: 2px; /* 竖线圆角 */
}

/* 消息内容中的其他部分 */
.message-content span {
    display: inline-block; /* 确保换行正常 */
}
~~~

App.Vue代码如下：

~~~vue
<template>
  <div id="app">
    <Chat />
  </div>
</template>

<script>
import Chat from "./components/Chat.vue";

export default {
  name: "App",
  components: {
    Chat,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 20px;
}
</style>
~~~

