## 查看安装状态

```sh
systemctl status mysql
```

## 重启

```sh
systemctl restart mysql
```

## 进入 Mysql

以进行用户管理或者 sql 操作

```sh
mysql -u root -p
```

## 查看端口

在 SQL 中执行

```sql
show global variables like 'port';
```

## 查找 mysql 安装目录

当前环境是 window 子系统，所以排除 /mnt 目录

```sh
sudo find / -path /mnt -prune, -name mysql
```
