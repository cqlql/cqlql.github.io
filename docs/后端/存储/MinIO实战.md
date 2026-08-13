---
title: MinIO 实战
icon: simple-icons:minio
sort: 1
---

相比本地磁盘和数据库，对象存储具备天然的分布式能力，可以支持海量文件存储和高并发访问，同时具备高可用和自动扩容能力。

此外它支持前端直传，能够显著降低后端服务器的带宽压力。在安全上可以通过签名 URL 控制访问权限。

综合来看，对象存储在扩展性、可靠性和成本上都更优，是文件存储的标准方案。

## 一、整体架构（推荐）

```
前端 → 后端（签名/校验） → MinIO
                     ↓
                  数据库（file 表）
```

核心思路：**MinIO 存文件 + MySQL 存元数据 + 预签名 URL 直传**。

## 二、上传模式

### 1. 前端直传（推荐）

流程：

```
前端 → 后端（拿上传凭证） → MinIO
```

- 后端生成上传凭证（预签名 URL）
- 前端直接传到 MinIO
- 后端只负责记录元数据

👉 优点：

- 高并发
- 节省服务器带宽
- 更适合简历这种附件场景

### 2. 后端转存（简单方案）

```
前端 → 后端 → MinIO
```

👉 适合：

- 小系统
- 内网系统

## 三、MinIO 准备

### 1. 创建 Bucket

```sh
mc mb minio/resume
```

建议：bucket 名称统一（如 `resume` / `passup`），**默认不要公开（private）**，访问统一走预签名 URL。

### 2. 引入依赖

```xml
<dependency>
  <groupId>io.minio</groupId>
  <artifactId>minio</artifactId>
  <version>8.5.7</version>
</dependency>
```

### 3. 配置客户端

```java
@Bean
public MinioClient minioClient() {
    return MinioClient.builder()
            .endpoint("http://localhost:9000")
            .credentials("minioadmin", "minioadmin")
            .build();
}
```

> 生产建议区分内网 `endpoint`（后端操作）与外网 `publicEndpoint`（给前端的预签名 URL），见下文「内外网与代理部署」。

## 四、上传方案（预签名 URL）

### 1. 后端生成上传 URL

```java
public String generateUploadUrl(String objectName) throws Exception {
    return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                    .method(Method.PUT)
                    .bucket("resume")
                    .object(objectName)
                    .expiry(60 * 10) // 10 分钟
                    .build()
    );
}
```

### 2. objectName 设计（很关键）

建议结构：

```
resume/{userId}/{yyyy}/{MM}/{ulid}.pdf
avatar/{userId}/{ulid}.jpg
chat/{conversationId}/{ulid}.png
report/{yyyy}/{MM}/{file}.xlsx
```

示例：

```
passup/resume/10001/2026/04/01HZY3K8GZP.pdf
passup/avatar/10001/01HZY3K8GZP.jpg
```

👉 好处：

- 避免重名
- 支持按用户 / 时间清理
- 可扩展、objectName 不可预测（防恶意上传）

### 3. 前端上传

```js
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type
  }
});
```

### 4. 上传完成后通知后端

```
POST /file/confirm

{
  "fileName": "简历.pdf",
  "objectName": "resume/10001/2026/04/xxx.pdf",
  "fileSize": 123456
}
```

## 五、下载方案（预签名 URL）

### 1. 后端生成下载 URL

```java
public String generateDownloadUrl(String objectName) throws Exception {
    return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket("resume")
                    .object(objectName)
                    .expiry(60 * 5) // 5 分钟
                    .build()
    );
}
```

### 2. 权限控制（重点）

不要直接暴露 objectName，也不要使用公开 Bucket 存敏感文件：

- 校验当前用户是否有权限访问该文件
- 校验通过后再生成 URL 返回

公开资源（如用户头像 / 展示图片）可直接使用公开 URL：

```java
String url = "http://localhost:9000/resume-bucket/" + objectName;
```

简历附件（PDF / DOC）等敏感文件**必须使用预签名 URL**。

## 六、数据库设计（重点）

```sql
CREATE TABLE file (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,

    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,

    file_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
    file_size BIGINT NOT NULL,
    file_type VARCHAR(50),

    bucket VARCHAR(100) NOT NULL,
    object_name VARCHAR(500) NOT NULL,

    biz_type VARCHAR(50) COMMENT '业务类型（resume/avatar 等）',
    biz_id BIGINT COMMENT '业务ID（比如简历ID）',

    status TINYINT NOT NULL DEFAULT 0 COMMENT '0 临时 1 已使用 2 已删除'
);
```

### 状态设计（非常重要）

| 状态 | 含义       |
| ---- | ---------- |
| 0    | 临时上传   |
| 1    | 已绑定业务 |
| 2    | 已删除     |

## 七、完整流程（推荐实现）

### 上传流程

1. 前端请求：获取上传 URL
2. 后端生成：objectName + presignedUrl
3. 前端直传 MinIO
4. 前端通知后端 confirm
5. 后端写 file 表（status = 0）

### 绑定业务

```
用户提交简历 → file.status = 1
```

### 删除业务

```
删除记录 → file.status = 2 → 删除 MinIO 文件
```

## 八、删除与垃圾清理

MinIO 本身**不会自动删除**文件，必须自行控制。

### 1. 业务删除

```java
minioClient.removeObject(
    RemoveObjectArgs.builder()
        .bucket(bucket)
        .object(objectName)
        .build()
);
```

### 2. 定时清理（推荐）

清理未使用的临时文件：

```java
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

清理对象与条件：

| 类型         | 条件                                       |
| ------------ | ------------------------------------------ |
| 临时文件     | status = UPLOADING 且 无 attachment 且 > 24h |
| 已删除文件   | status = DELETED 且 > 7 天                  |

执行方式：**定时任务 + 分批 + 二次校验**。

### 3. 生产级清理实现（分页 + 二次校验 + 异常隔离）

```java
// 定时任务
@Scheduled(cron = "0 0 * * * ?") // 每小时
public void cleanUnusedFiles() {
    fileCleanupService.cleanUploadingFiles();
    fileCleanupService.cleanDeletedFiles();
}

// 查询待删除文件（必须 LIMIT）
// SELECT id, storage_key FROM file
// WHERE status = 'UPLOADING'
//   AND created_at < NOW() - INTERVAL 1 DAY
//   AND NOT EXISTS (SELECT 1 FROM attachment WHERE file_id = file.id)
// LIMIT 100

for (File file : files) {
    try {
        // ① 再次校验（防并发误删）
        if (attachmentRepository.existsByFileId(file.getId())) {
            continue;
        }
        // ② 删除 MinIO 文件
        minioStorageService.deleteQuietly(file.getStorageKey());
        // ③ 删除数据库记录
        fileRepository.deleteById(file.getId());
    } catch (Exception e) {
        log.error("清理文件失败 fileId={}", file.getId(), e);
    }
}
```

### 4. 必须加的安全机制

- **二次校验（防并发）**：删除前再查一次 `attachmentRepository.existsByFileId`，防止「查出时未绑定 → 刚好被绑定 → 误删」。
- **分批删除（防雪崩）**：一次最多 100 条，循环执行，禁止 `DELETE FROM file WHERE ...` 全量删除（锁表 + IO 爆炸）。
- **异常隔离**：单条失败不影响其他。
- **软删除优先**：先 `status = DELETED`，延迟 7 天后再物理删除，便于误删恢复。
- **DB 与 MinIO 一致性**：DB 删了必须同步删 MinIO，否则存储泄漏。

### 5. MinIO 生命周期（进阶）

若使用 `/temp` 目录，可配置 MinIO 生命周期实现「temp/ 1 天自动删除」，无需写代码。

## 九、安全与校验

### 1. 文件类型校验

```java
if (!"application/pdf".equals(file.getContentType())) {
    throw new RuntimeException("只允许 PDF 简历");
}
```

允许的类型示例：`application/pdf`、`application/msword`、`application/vnd.openxmlformats-officedocument.wordprocessingml.document`。

### 2. 限制大小

```java
if (file.getSize() > 5 * 1024 * 1024) {
    throw new RuntimeException("文件过大");
}
```

### 3. 幂等设计（去重）

- 计算文件 hash（MD5），建唯一索引
- 相同文件直接复用，避免重复上传

### 4. 防恶意上传

- 预签名 URL 过期时间短（如 10 分钟）
- objectName 不可预测（使用 ULID / UUID）

## 十、内外网与代理部署

### 1. 推荐分内外网

- **后端主动操作**（查询元数据、删除）→ 走内网 `endpoint`，性能好、延迟低、不经过代理。
- **生成预签名 URL 给前端**（上传 / 下载）→ 走外网 `publicEndpoint`，确保前端拿到的 URL 公网可访问。

```yaml
minio:
  endpoint: http://minio:8007
  access-key:
  secret-key:
  bucket: passup
  public-endpoint: https://oss.xiaodingtie.com
  auto-create-bucket: true
  presigned-url-expiry-seconds: 900
```

### 2. 两层代理转发实践

Nginx 第一层：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:8080; # 假设 Caddy 监听 8080

        # 核心：将客户端原本访问的域名传给 Caddy
        proxy_set_header Host $host;

        # 可选：透传客户端真实 IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Caddy 第二层：

```nginx
:8080 {
    reverse_proxy http://127.0.0.1:9000 { # 假设 MinIO 在 9000 端口
        # 把从 Nginx 传过来的 Host 继续传给后端
        header_up Host {http.request.host}
        # 注意！以下写法无效：
        # header_up Host {header.Host}
    }
}
```

## 十一、进阶优化

- **文件去重**：hash(md5) 唯一索引，避免重复上传同一文件。
- **软删除 + 延迟删除**：ACTIVE → DELETED → 7 天后物理删除，防误删恢复。
- **清理任务拆分**：`cleanUploadingFiles()` / `cleanDeletedFiles()`，可控性更强。
- **日志 + 监控**：记录「扫描 N 条 / 删除 M 条 / 失败 K 条」。
- **CDN**：MinIO 前置 CDN 加速下载。

## 十二、一句话总结

**MinIO（存文件）+ MySQL（存元数据）+ 预签名 URL（直传）** 是企业级文件存储的标准方案：高并发、省带宽、权限可控。
