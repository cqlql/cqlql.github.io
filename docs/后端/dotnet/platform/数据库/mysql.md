## 安装 mysql 依赖

使用 dotnet cli 安装

```sh
dotnet add package MySql.Data
```

安装成功后会在 \*.csproj 文件生成一条引用。以后项目迁移只要运行就会自动安装。

```xml {7}
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="MySql.Data" Version="8.0.30" />
  </ItemGroup>
</Project>
```

## 连接数据库

using 用来关闭数据库连接，释放非托管资源。

```cs
using MySql.Data.MySqlClient;

string connStr = "server=192.168.1.223;user=joly;database=;port=3306;password=123123";
using (MySqlConnection conn = new MySqlConnection(connStr))
{
  // 打开数据库连接
  conn.Open();
  // 执行 sql 语句...
}
```

## 查询

```cs
var list = new List<User>();
string connStr = "server=192.168.1.222;user=joly;database=;port=3306;password=123123";
using (MySqlConnection conn = new MySqlConnection(connStr))
{
  using (MySqlCommand cmd = new MySqlCommand("SELECT * FROM db_user.user;", conn))
  {
    conn.Open();

    MySqlDataReader reader = cmd.ExecuteReader();

    while (reader.Read())
    {
      list.Add(
        new User
        {
          id = (int)reader[0],
          username = (string)reader[1]
        }
      );
    }
  }
}

Console.WriteLine(list);
```

## 插入/更新实体

使用 @参数名 避免 sql 注入， 以及字符串单双引号冲突等等问题

```cs {5,15-17}
var name = "张三\"牛\"";
var pwd = "123123";
var nickname = "123123";

var sqlStr = "INSERT INTO db_user.user (username,password,nickname) VALUES (@name,@pwd,@nickname);";

string connStr = "server=192.168.1.222;user=joly;database=;port=3306;password=123123";
using (MySqlConnection conn = new MySqlConnection(connStr))
{
  using (MySqlCommand cmd = new MySqlCommand(sqlStr, conn))
  {
    conn.Open();

    // 参数赋值
    cmd.Parameters.AddWithValue("name", name);
    cmd.Parameters.AddWithValue("pwd", pwd);
    cmd.Parameters.AddWithValue("nickname", nickname);

    // 执行 sql 语句
    cmd.ExecuteNonQuery();
  }
}
```

## ExecuteNonQuery 与 ExecuteScalar 方法

ExecuteNonQuery 只执行sql 语句，没有返回值

ExecuteScalar 可实现返回新插入行的 id

```cs
string str = "server='(local)';database='mytable';uid='sa';pwd='sa'";       //创建连接字串
SqlConnection con = new SqlConnection(str);  //创建连接对象
con.Open(); //打开连接
string strsql = "insert into mynews values ('刚刚插入的id是多少?') SELECT  @@IDENTITY  as  'bh'"; //插入语句
SqlCommand cmd = new SqlCommand(strsql, con);//执行语句
Label1.Text = "刚刚插入的行的id是" + cmd.ExecuteScalar();//返回赋值
```

## 参考文档

[连接数据库](https://dev.mysql.com/doc/connector-net/en/connector-net-connections-string.html)

[相关包以及安装](https://dev.mysql.com/doc/connector-net/en/connector-net-installation-binary-nuget.html)

[SQL之ExecuteScalar() - ProZkb - 博客园 (cnblogs.com)](https://www.cnblogs.com/ZkbFighting/p/7873989.html)
