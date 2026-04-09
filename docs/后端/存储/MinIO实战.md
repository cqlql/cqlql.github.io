相比本地磁盘和数据库，对象存储具备天然的分布式能力，可以支持海量文件存储和高并发访问，同时具备高可用和自动扩容能力。

此外它支持前端直传，能够显著降低后端服务器的带宽压力。在安全上可以通过签名URL控制访问权限。

综合来看，对象存储在扩展性、可靠性和成本上都更优，是文件存储的标准方案。

## 上传模式

### 前端直传（推荐）

流程：

```
前端 → 后端（拿上传凭证） → MinIO
```

- 后端生成上传 URL
- 前端直接传到 MinIO
- 后端只负责记录元数据

👉 优点：

- 高并发
- 节省服务器带宽
- 更适合简历这种附件场景

###  简单方案：通过后端转存

- 前端 → 后端 → MinIO

👉 适合：

- 小系统
- 内网系统

## 生成访问 URL

### 方式一：公开 Bucket（简单）

```java
String url = "http://localhost:9000/resume-bucket/" + objectName;
```

用户头像 / 展示图片，建议公开 URL

### 方式二：预签名 URL（推荐）

过期后只能后端重新签发

```java
String url = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .bucket("passup")
        .object("resume/xxx.pdf")
        .method(Method.GET)
        .expiry(1, TimeUnit.DAYS)
        .build()
);
```

如果是简历附件（PDF / DOC），必须用预签名 URL

- 访问流程：

  ```
  前端 -> 请求后端 -> 后端生成预签名 URL -> 返回 -> 前端下载
  ```



## 待整理





### 清理方案

```
@Scheduled(cron = "0 0 3 * * ?")
public void cleanFiles() {
    List<ResumeFile> files = repository.findDeletedFiles();

    for (ResumeFile file : files) {
        minioClient.removeObject(
            RemoveObjectArgs.builder()
                .bucket(file.getBucketName())
                .object(file.getObjectName())
                .build()
        );

        repository.delete(file);
    }
}
```



### ✔ 清理“临时文件”

```
条件：
- status = UPLOADING
- 无 attachment
- 超过24小时
```

------

### ✔ 清理“已删除文件”

```
条件：
- status = DELETED
- 超过7天
```

------

### ✔ 执行方式

```
定时任务 + 分批 + 二次校验
```

###  文件类型校验

```
if (!file.getContentType().equals("application/pdf")) {
    throw new RuntimeException("只允许PDF简历");
}
```

------

###  限制大小

```
if (file.getSize() > 5 * 1024 * 1024) {
    throw new RuntimeException("文件过大");
}
```

### 幂等设计（避免重复上传）

- 文件 hash（MD5）
- 相同文件直接复用

### bucket 目录结构推荐（标准企业方案）

✔ bucket

```
passup
```

✔ object key 设计

```
resume/{userId}/{yyyy}/{MM}/{ulid}.pdf
avatar/{userId}/{ulid}.jpg
chat/{conversationId}/{ulid}.png
report/{yyyy}/{MM}/{file}.xlsx
```

✔ 示例

```
passup/resume/10001/2026/04/01HZY3K8GZP.pdf
passup/avatar/10001/01HZY3K8GZP.jpg
```



# ####待整理#################

# 清理策略实现

# ✅ 一、你当前模型下的清理对象

基于你现在的表设计：

## 🟡 1. 临时文件（核心）

```
file.status = 'UPLOADING'
AND 不存在 attachment
AND created_at < NOW() - 24h
```

------

## 🔴 2. 逻辑删除文件

```
file.status = 'DELETED'
AND updated_at < NOW() - 7天
```

------

# 🚀 二、推荐清理方案（生产可用）

------

# 🟢 方案：定时任务 + 批处理（推荐 👍）

------

## ✏️ 1. 定时任务（Spring）

```
@Scheduled(cron = "0 0 * * * ?") // 每小时执行
public void cleanUnusedFiles() {
    fileCleanupService.cleanUploadingFiles();
    fileCleanupService.cleanDeletedFiles();
}
```

------

## ✏️ 2. 查询待删除文件（分页很重要）

```
SELECT id, storage_key
FROM file
WHERE status = 'UPLOADING'
  AND created_at < NOW() - INTERVAL 1 DAY
  AND NOT EXISTS (
    SELECT 1 FROM attachment WHERE file_id = file.id
  )
LIMIT 100
```

👉 ❗一定要 LIMIT（防止一次删爆）

------

## ✏️ 3. 删除流程（关键）

```
for (File file : files) {
    try {
        // ① 再次校验（防止并发误删）
        if (attachmentRepository.existsByFileId(file.getId())) {
            continue;
        }

        // ② 删除 MinIO 文件
        minioStorageService.deleteQuietly(file.getStorageKey());

        // ③ 删除数据库（或标记 DELETED）
        fileRepository.deleteById(file.getId());

    } catch (Exception e) {
        log.error("清理文件失败 fileId={}", file.getId(), e);
    }
}
```

------

# ⚠️ 三、必须加的“安全机制”（很重要）

------

## ❗1. 二次校验（防并发）

```
if (attachmentRepository.existsByFileId(fileId))
```

👉 防止：

```
刚查出来没人用 → 刚好被绑定 → 被你删了 ❌
```

------

## ❗2. 分批删除（防雪崩）

```
一次最多 100 条
循环执行
```

------

## ❗3. 异常隔离

```
一个删失败 → 不影响其他
```

------

## ❗4. 不要直接物理删除（推荐）

可以先：

```
status = DELETED
```

再延迟物理删除

------

# 🧠 四、进阶优化（你可以后面加）

------

## 🟢 1. MinIO 生命周期（强烈推荐）

如果你用了 `/temp`：

👉 可以直接：

```
temp/ 目录 → 1天自动删除
```

👉 不用你写代码

------

## 🟢 2. 软删除 + 延迟删除

```
ACTIVE → DELETED → 7天后物理删除
```

👉 防误删恢复

------

## 🟢 3. 清理任务拆分

```
cleanUploadingFiles()
cleanDeletedFiles()
```

👉 可控性更强

------

## 🟢 4. 日志 + 监控（很加分）

```
本次清理：
- 扫描 100 条
- 删除 87 条
- 失败 2 条
```

------

# 🚨 五、常见错误（你一定要避免）

------

## ❌ 1. 只看 status 删除

```
status = UPLOADING 就删 ❌
```

👉 必须加：

```
NOT EXISTS attachment
```

------

## ❌ 2. 一次删全部

```
DELETE FROM file WHERE ...
```

👉 ❌ 极其危险（锁表 + IO爆炸）

------

## ❌ 3. 不校验 MinIO

👉 DB删了，但文件还在 → 存储泄漏

------

# ✨ 六、推荐你最终方案（总结）

------

## ✔ 清理“临时文件”

```
条件：
- status = UPLOADING
- 无 attachment
- 超过24小时
```

------

## ✔ 清理“已删除文件”

```
条件：
- status = DELETED
- 超过7天
```

------

## ✔ 执行方式

```
定时任务 + 分批 + 二次校验
```

# ####待整理#################

# 一、整体架构（推荐）

```
前端 → 后端（签名/校验） → MinIO
                     ↓
                  数据库（file表）
```

有两种上传模式：

## ✅ 推荐：直传 MinIO（预签名 URL）

- 后端生成上传 URL
- 前端直接传到 MinIO
- 后端只负责记录元数据

👉 优点：

- 高并发
- 节省服务器带宽
- 更适合简历这种附件场景

------

## 🟡 简单方案：通过后端转存

- 前端 → 后端 → MinIO

👉 适合：

- 小系统
- 内网系统

------

# 二、MinIO 准备

## 1. 创建 Bucket

```
mc mb minio/resume
```

建议：

- bucket: `resume`
- 不要公开（private）

------

## 2. 引入依赖

```
<dependency>
  <groupId>io.minio</groupId>
  <artifactId>minio</artifactId>
  <version>8.5.7</version>
</dependency>
```

------

## 3. 配置客户端

```
@Bean
public MinioClient minioClient() {
    return MinioClient.builder()
            .endpoint("http://localhost:9000")
            .credentials("minioadmin", "minioadmin")
            .build();
}
```

------

# 三、上传方案一（推荐）：预签名 URL

## 1. 后端生成上传 URL

```
public String generateUploadUrl(String objectName) throws Exception {
    return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                    .method(Method.PUT)
                    .bucket("resume")
                    .object(objectName)
                    .expiry(60 * 10) // 10分钟
                    .build()
    );
}
```

------

## 2. objectName 设计（很关键）

建议结构：

```
resume/{userId}/{yyyy}/{MM}/{uuid}.pdf
```

示例：

```
resume/10001/2026/04/01HZX8...ULID.pdf
```

👉 好处：

- 避免重名
- 支持按用户/时间清理
- 可扩展

------

## 3. 前端上传

```
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
});
```

------

## 4. 上传完成后通知后端

```
POST /file/confirm

{
  "fileName": "简历.pdf",
  "objectName": "resume/10001/2026/04/xxx.pdf",
  "fileSize": 123456
}
```

------

# 四、数据库设计（重点）

```
CREATE TABLE file (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,

    file_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50),

    bucket VARCHAR(100) NOT NULL,
    object_name VARCHAR(500) NOT NULL,

    biz_type VARCHAR(50) COMMENT '业务类型（resume/avatar等）',
    biz_id BIGINT COMMENT '业务ID（比如简历ID）',

    status TINYINT NOT NULL DEFAULT 0 COMMENT '0临时 1已使用 2已删除'
);
```

------

## 状态设计（非常重要）

| 状态 | 含义       |
| ---- | ---------- |
| 0    | 临时上传   |
| 1    | 已绑定简历 |
| 2    | 已删除     |

------

# 五、删除 & 垃圾清理

MinIO 本身不会自动删除 → 必须你自己控制

------

## 方案一：业务删除

```
minioClient.removeObject(
    RemoveObjectArgs.builder()
        .bucket(bucket)
        .object(objectName)
        .build()
);
```

------

## 方案二：定时清理（推荐）

清理「未使用的文件」：

```
DELETE FROM file 
WHERE status = 0 
AND created_at < NOW() - INTERVAL 1 DAY;
```

同时删除 MinIO 文件。

👉 建议：

- 延迟 1~24 小时清理
- 防止用户上传后没提交

------

# 六、下载方案

## 1. 生成预签名下载 URL

```
public String generateDownloadUrl(String objectName) throws Exception {
    return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket("resume")
                    .object(objectName)
                    .expiry(60 * 5)
                    .build()
    );
}
```

------

## 2. 控制权限（重点）

不要直接暴露 objectName：

👉 必须：

- 校验用户是否有权限访问该简历
- 再生成 URL

------

# 七、一个完整流程（推荐实现）

### 上传流程：

1. 前端请求：获取上传URL
2. 后端生成：
   - objectName
   - presignedUrl
3. 前端直传 MinIO
4. 前端通知后端 confirm
5. 后端写 file 表（status=0）

------

### 绑定简历：

```
用户提交简历 → file.status = 1
```

------

### 删除简历：

```
删除记录 → file.status = 2 → 删除 MinIO
```

------

# 八、进阶优化（你这个项目很适合）

结合你现在的系统，我建议你加这几个能力：

------

## ✅ 1. 文件去重（可选）

```
hash(md5) 唯一索引
```

避免重复上传同一个简历

------

## ✅ 2. 限制文件类型

```
application/pdf
application/msword
```

------

## ✅ 3. 限制大小

```
比如：5MB
```

------

## ✅ 4. 防止恶意上传

- 预签名 URL 过期时间短
- objectName 不可预测（ULID）

------

## ✅ 5. CDN（以后）

MinIO 前面挂 CDN，加速下载

------

# 九、一句话总结

👉 **推荐最佳实践：**

```
MinIO（存文件） + MySQL（存元数据） + 预签名URL（直传）
```

------

如果你愿意，我可以帮你把这一套直接落成：

✅ Spring Boot 完整代码（Controller + Service）
 ✅ Vue 上传组件
 ✅ file 表 + repository + 事务设计

甚至可以帮你把它 **接进你现在的 Conversation / Resume 系统里**。