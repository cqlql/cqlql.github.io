
## 可视化管理工具
[SQLite可视化管理工具汇总(更新中)](https://blog.csdn.net/qq_27248989/article/details/80279585)

目前熟悉使用：[SQLiteStudio](https://sqlitestudio.pl/index.rvt?act=download)

## nodejs 使用

一般使用 [sqlite3](https://github.com/mapbox/node-sqlite3)


## sql 语法

```sql
-- 创建表。如果存在会报错
CREATE TABLE articles(
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, -- 主键，自动增长，非空
  path VARCHAR(200),
  content TEXT
);

-- 创建表。不存在才创建，解决报错问题
CREATE TABLE IF NOT EXISTS articles(
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name VARCHAR(100),
  path VARCHAR(200),
  content TEXT
);

-- 删除 表
DROP TABLE articles;

-- 列出所有表
SELECT name FROM SQLITE_MASTER WHERE type='table' ORDER BY name

-- 查询指定表数量
SELECT count(*) FROM sqlite_master WHERE type='table' AND name='articles';
```

### 函数

#### instr - 查找字符串位置

实现截断匹配字符串字符串

substr 为截取字符串

```sql
SELECT id,
       path,
       substr(content,instr(content,'数组'),20)
  FROM articles WHERE path,content LIKE '%数组%' LIMIT 20;

```

## 特殊字符转义及通配符
[关于sqlite的特殊字符转义及通配符](https://blog.csdn.net/ameyume/article/details/8007149)
