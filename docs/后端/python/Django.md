## 数据库操作
```python
# 1.1 查询，默认 and
exists = (
    User.objects.filter(age=20, name='Alice')
    .first()
)

# 1.2 查询，or+and
users = User.objects.filter(Q(age__gt=20) & (Q(name='Alice') | Q(name='Bob')))

# 保存到数据库，using将指定数据库
WorkflowNotification.objects.using(self.db_name).create(
    receiver_user_id=self.receiver_id,
    app_uuid=msg.get("app_uuid"),
    form_uuid=msg.get("form_uuid"),
    form_instance_id=msg.get("form_instance_id"),
    workflow_instance_id=msg.get("workflow_instance_id"),
    execute_user_id=msg.get("execute_user_id"),
    sent_at=timezone.now(),  # 发送时间（保存时的当前时间）
    response_code=response.response_code,  # 初始为空，发送完成后可更新
    is_deleted=0,  # 默认未删除
)
```

## 迁移
### <font style="color:rgb(17, 17, 51);">1. </font>**<font style="color:rgb(17, 17, 51);">创建迁移文件</font>**
<font style="color:rgb(17, 17, 51);">当你修改了 </font>`<font style="color:rgb(17, 17, 51);background-color:rgba(175, 184, 193, 0.2);">models.py</font>`<font style="color:rgb(17, 17, 51);"> 文件后，需要生成迁移文件：</font>

```yaml
python manage.py makemigrations
```

### <font style="color:rgb(17, 17, 51);">2. </font>**<font style="color:rgb(17, 17, 51);">应用迁移（同步到数据库）</font>**
<font style="color:rgb(17, 17, 51);">将生成的迁移文件应用到数据库中：</font>

```yaml
python manage.py migrate
```

