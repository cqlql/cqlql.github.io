## 首先需要 EFCore mysql 环境

[EFCore mysql 环境安装](/DotNet/EF%20Core/mysql%20%E7%8E%AF%E5%A2%83.html)

## 新建模型

[如何新建模型？](/DotNet/EF%20Core/Model%20%E7%89%B9%E6%80%A7%E6%B3%A8%E8%A7%A3)

模型按约定将映射到具体的表。

对无法映射的表字段还可以使用特性注解。

## 继承 DbContext 类

相当于映射某个数据库了。如何继承？见 [DbContext 配置](/DotNet/EF%20Core/DbContext%20配置)


这里涉及到[连接字符串如何存放](/DotNet/EF%20Core/%E8%BF%9E%E6%8E%A5%E5%AD%97%E7%AC%A6%E4%B8%B2.html)更好。

可进行[数据播种](https://www.cnblogs.com/dotnet261010/p/12359695.html)。
数据播种不能单纯为“可以实现如果没有数据，将填充一个初始数据”，涉及到数据迁移。目前还有很多细节不清楚，等有时间了再来学习。

还可以在这里使用 fluent api 对模型中的注解特性进行代替或者补充。

## 路由控制器

## 数据库操作 CRUD

对数据库的增删改查，详见[CRUD 数据库增删改查](/DotNet/EF%20Core/CRUD%20增删改查.html)
