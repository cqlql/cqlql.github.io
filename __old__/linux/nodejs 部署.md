
## 安装

### 简单安装(使用编译好的二进制包)

[ubuntu安装及配置nodejs](https://www.jianshu.com/p/4125b3672baf)

[Linux(ubuntu16.04)下安装nodejs及配置环境变量](https://blog.csdn.net/yuwujian1992/article/details/74075099)


[从官网拿最新的下载地址](https://nodejs.org/en/download/)

```sh
# 下载。这里使用淘宝镜像，快一些
wget -P /home/jo http://cdn.npm.taobao.org/dist/node/v12.18.0/node-v12.18.0-linux-x64.tar.xz
# 解压缩
xz -d node-v12.18.0-linux-x64.tar.xz
tar -xvf node-v12.18.0-linux-x64.tar
# 移动并重命名
mv node-v12.18.0-linux-x64 /opt/nodejs


```

#### 设置全局访问


**环境变量方式**

```sh
# 修改环境变量配置文件
vim ~/.profile
```

```sh
# 要插入的代码

#node
export NODE_HOME=/opt/nodejs
export PATH=$NODE_HOME/bin:$PATH
#npm
export NODE_PATH=$NODE_HOME/lib/node_modules
```

```sh
# 环境变量更新。命令行输入
source ~/.profile
```

解决全局安装目录权限问题：
[参考网址](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)


**软连接方式** - 不推荐，安装的全局软件又要单独设置

```sh
sudo ln -s /usr/local/nodejs/bin/node /usr/local/bin/node
sudo ln -s /usr/local/nodejs/bin/npm /usr/local/bin/npm
```




### 编译安装步骤 (编译时间太长，不推荐。。。直接使用二进制包吧)

#### 下载

[从官网拿最新的下载地址](https://nodejs.org/en/download/)

```sh
# 下载
wget https://nodejs.org/dist/v10.15.3/node-v10.15.3.tar.gz
# 解压缩
tar -xzvf node-v10.15.3.tar.gz
# 重命名
mv node-v10.15.3 nodejs
```

#### 编译安装

```sh
# 可能需要安装
# sudo apt-get install gcc g++ make python

# 配置（这条命令在解压后的nodejs目录下执行，/usr/local/nodejs/ 为安装目录）
sudo ./configure --prefix=/usr/local/nodejs
# 编译
sudo make
# 安装
sudo make install
```

## 使用 pm2 管理 node 服务

[pm2 进程管理工具](https://github.com/Unitech/pm2) - 生产环境用

适用于网站访问量比较大,需要完整的监控界面

支持异常自动重启

运行管理多个进程程序

除了nodejs，还[支持其他语言程序](https://pm2.io/doc/en/runtime/guide/process-management/?utm_source=github#manage-any-application-type) 

```sh
# 运行js
pm2 start app.js
# 支持命令
pm2 start http-server -- /usr/website
```