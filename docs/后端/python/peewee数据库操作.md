## 相关文档

https://blog.csdn.net/xhltk316/article/details/115967840

## 连接数据库、建表

```py
import sys
from pathlib import Path
from peewee import *

db = SqliteDatabase(Path(sys.path[0], 'data/database.db'))

class BaseModel(Model):
    class Meta:
        database = db

class User(BaseModel):
    # unique 是否唯一
    phoneNumber = CharField(unique=True)

db.connect()
db.create_tables([User])

# User.create(name='张三', phoneNumber='+8613923401528')
# User.create(name='李四', phoneNumber='+8618673696661')

```
