- [asyncio 定时器](#asyncio-定时器)
- [直接执行异步函数](#直接执行异步函数)
- [path 路径](#path-路径)
- [字符串转换](#字符串转换)
- [import 模板](#import-模板)
- [json 转换](#json-转换)
- [字符串拼接](#字符串拼接)
- [for 循环](#for-循环)
- [数组](#数组)
- [命令行参数](#命令行参数)
- [文件目录](#文件目录)
  - [文件或目录是否存在](#文件或目录是否存在)
  - [文件读写](#文件读写)
  - [目录操作](#目录操作)
- [字符串拆分成数组](#字符串拆分成数组)
- [正则表达式 替换](#正则表达式-替换)
- [错误处理 try except else](#错误处理-try-except-else)
- [模块导入](#模块导入)
  - [动态导入模块](#动态导入模块)
  - [导入上一级模块](#导入上一级模块)

## asyncio 定时器

```py
async def timeout_callback():
    await asyncio.sleep(1) // 等待1s
    print('echo!')
```

## 直接执行异步函数

```py
import asyncio
import TelethonPlus

async def main():
    print('xxx')
    sent = await TelethonPlus.sendCode('+')
    print(sent)

loop = asyncio.get_event_loop()
result = loop.run_until_complete(main())
loop.close()
```

## path 路径

https://vimsky.com/examples/detail/python-method-pathlib.Path.resolve.html

```py
from pathlib import Path

print(Path.resolve(Path(''))) # 程序启动目录
print(Path.absolute(Path('')))

print(sys.path[0]) # 当前脚本绝对目录
print(sys.argv[0]) # 路径，包括文件
```

## 字符串转换

```py
str(Path.absolute(Path('session/'+session_name)))
```

## import 模板

http://c.biancheng.net/view/2397.html

https://zhuanlan.zhihu.com/p/75955445

## json 转换

```py
data = [ { 'a' : 1, 'b' : 2, 'c' : 3, 'd' : 4, 'e' : 5 } ]

data2 = json.dumps(data)

# 将已编码的 JSON 字符串解码为 Python 对象
json.loads('{}')
```

## 字符串拼接

https://segmentfault.com/a/1190000015475309

```py
print(f'{i} - {chat.id} - {chat.title}')
```

## for 循环

```py
for member in all_participants:
    print(member.id)

# key
for key, value in all_participants.item():
    print(key, value)
```

## 数组

```py
# 带索引循环
for i, name in enumerate(list_dir):
    print(f'{i} - {name}')
```

## 命令行参数

https://docs.python.org/zh-tw/3/library/argparse.html

```py

import argparse

def main():
    print('main')

parser = argparse.ArgumentParser(description='telegram api')
parser.add_argument('phoneNumbers', metavar='phoneNumbers', type=str, nargs='+',
                    help='多个手机号')
parser.add_argument('-p', dest='run', action='store_const',
                    const=main, default=max,
                    help='手机号，可多个')

args = parser.parse_args()
print(args)
print(args.phoneNumbers)
args.run()

```

## 文件目录

### 文件或目录是否存在

```py
print(os.path.exists(Path.resolve(Path('proxy.py'))))
```

### 文件读写

```py
file = open(filePath, "w+")
file = open(filePath, "w")
dataFile.write('hello')

file = open(filePath, "r")
dataFile.read()

file.close()
```

### 目录操作

```py
from pathlib import Path
import os

sessionsDir = Path.absolute(Path('sessions')) # 当前项目绝对路径再拼接sessions
print(sessionsDir)
print(Path.joinpath(sessionsDir, '123')) # 拼接路径
if (os.path.exists(sessionsDir) == False): # 不存在则创建
    os.mkdir(sessionsDir)
```

## 字符串拆分成数组

```py
content = '1,2,3'
content = content.split(',')
```

## 正则表达式 替换

```py
name = '111111.session'
name = re.sub(r'\.session$', '', name)
```

## 错误处理 try except else

```py
try:
    print('可能会出错')
except:
    print('错误')
else:
    print('成功')

# 输出异常消息
try:
    print(1/0)            # 触发异常
except Exception as err:
    print(1, err)
else:
    print(2)
```

## 模块导入

### 动态导入模块

```py
if False
    lib = __import__('lib.aa')
```

### 导入上一级模块

https://docs.python.org/zh-cn/3/reference/import.html#package-relative-imports

https://blog.csdn.net/m0_47670683/article/details/108989698

待验证

```py

```
