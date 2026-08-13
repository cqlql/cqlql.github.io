---
title: MinIO Bucket 划分最佳实践
icon: mdi:group
sort: 7
---

对象存储（S3 / MinIO）的核心认知：**Bucket 应该作为权限边界，目录（子目录）只是对象 Key 的前缀，不应该用来承担权限、生命周期等职责。**

下文以 PassUp 项目为例，说明为什么以及如何按「访问级别」划分 Bucket。

## 结论

**支持**用一个 Bucket 内用子目录区分 public/private，但**不建议依赖子目录做权限控制**。

推荐设计：

```
MinIO
├── passup-public
│   ├── avatar/
│   ├── logo/
│   └── ...
│
├── passup-private
│   ├── resume/
│   ├── interview/
│   ├── report/
│   └── ...
│
├── oa
├── lowcode
└── ...
```

这比下面这种更清晰：

```
passup
├── avatar/      (public)
├── resume/      (private)
└── interview/   (private)
```

## 为什么不建议一个 Bucket 里混 public/private

### 技术上可行

S3 Policy 可以针对前缀分别授权，例如允许匿名访问 `avatar/*`：

```json
{
  "Effect": "Allow",
  "Principal": "*",
  "Action": ["s3:GetObject"],
  "Resource": [
    "arn:aws:s3:::passup/avatar/*"
  ]
}
```

同时 `passup/resume/*` 拒绝匿名访问。技术上完全没问题。

### 但维护会越来越麻烦

假设以后对象类型越来越多：

```
passup
├── avatar/
├── resume/
├── interview/
├── export/
├── company/
├── template/
├── article/
├── temp/
└── ...
```

几年以后没人记得：

- 哪个公开？
- 哪个私有？
- 哪个需要签名？
- 哪个走 CDN？

Bucket Policy 会越来越长，规则相互交织，容易出错。

## 推荐：按访问级别划分 Bucket

### `passup-public` —— 默认 Public Read

所有对象默认公开可读，例如：

```
avatar/
company-logo/
article-image/
```

都可以直接通过 URL 访问：

```
https://minio.xxx.com/passup-public/avatar/1.png
```

### `passup-private` —— 默认 No Access

所有访问走 Presigned URL，例如：

```
resume/
offer/
report/
interview/
```

都只能通过 `GET Presigned URL` 下载。

## 生命周期更容易配置

为临时文件单独建 Bucket：

```
passup-temp
```

专门放：

- 导出文件
- 上传缓存
- OCR 中间文件

生命周期规则：

```
7 天自动删除
```

而 `passup-private` 则永久保存。

如果混在一个 Bucket 里，`temp/` 和 `resume/` 共用生命周期，规则会越配越复杂。

## CDN 也方便

```
passup-public
```

直接挂 Cloudflare CDN，缓存一年。

而 `passup-private` 根本不经过 CDN。

按访问级别划分后，公开/私有走不同的链路，互不干扰。

## 如果真的想一个 Bucket，也不是不行

很多公司确实这样做：

```
passup
├── avatar/
├── resume/
├── interview/
```

通过 Bucket Policy 允许 `passup/avatar/*`，通过 IAM Policy 允许 `passup/resume/*` —— 这也是 AWS 官方支持的方案。

只是一般只在下面场景才会这么做：

- 项目非常小
- 文件类型很少

## 结合 PassUp 的完整规划

```
MinIO
│
├── passup-public
│   ├── avatar/
│   ├── company/
│   ├── article/
│   └── banner/
│
├── passup-private
│   ├── resume/
│   ├── interview/
│   ├── report/
│   ├── export/
│   └── attachment/
│
├── passup-temp
│   ├── upload/
│   ├── ocr/
│   └── ai/
│
├── oa-public
├── oa-private
├── lowcode-public
└── lowcode-private
```

### 这样设计的优势

- **权限边界清晰**：Bucket 级别即可区分公开、私有和临时文件。
- **运维简单**：每个 Bucket 可以独立设置匿名访问、版本控制、生命周期和配额。
- **代码简单**：上传时只需要根据业务选择 Bucket，不需要维护复杂的前缀权限规则。
- **后续扩展容易**：如果某个项目（如 PassUp）存储规模变大，需要迁移到独立 MinIO 集群，只需迁移对应几个 Bucket，而不用拆分一个混合用途的 Bucket。

## 一句话总结

对于长期维护的系统，应把 **Bucket 当作访问权限和生命周期的边界**，而不是依赖子目录（对象前缀）来承担这些职责。
