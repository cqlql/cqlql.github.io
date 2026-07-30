# 附件存储策略（AI 问答 / AI Chat）

针对 PassUp 这类 **AI 问答 / AI Chat**，附件存储建议不要简单选「永久保存」或者「只存本地」，而是**分层处理**。

---

## 当前约束

- AI **没有图片理解能力**
- 附件主要用于文本提取（PDF、Word、TXT 等）
- 需要控制成本
- 未来可能接入 RAG / 知识库

---

## 推荐方案：原文件短期保存 + 文本永久保存

流程：

```
用户上传附件
        |
        v
对象存储 MinIO
(chat-attachment bucket)
        |
        |
        +--> 文本提取
              |
              v
        chat_message_attachment_text
              |
              v
        AI上下文 / RAG
```

存储：

| 内容              | 是否保存 | 周期        |
| --------------- | ---- | --------- |
| 原始文件(pdf/docx) | 可选保存 | 30天~180天  |
| 提取后的纯文本        | 保存   | 永久        |
| 文件元数据          | 保存   | 永久        |
| 向量 embedding    | 可选   | 永久        |

---

## 为什么不建议只保存本地？

比如：

```
浏览器上传
    ↓
JS解析文本
    ↓
发送给AI
```

看起来简单，但是问题很多：

### 1. 无法复盘

用户：

> 我之前上传的简历，为什么这次回答不一样？

你没有原始上下文。

### 2. 无法支持历史聊天

类似 ChatGPT：

```
昨天：
上传 xxx.pdf

今天：
继续问里面的问题
```

如果没有保存附件内容，就无法实现。

### 3. 无法做知识沉淀

未来可能：

```
用户上传：
- 简历
- 技术文档
- 公司资料

↓

个人知识库
↓

AI长期助手
```

没有存储就废了。

---

## 为什么不建议永久保存原文件？

因为成本 + 合规。

例如：

用户上传：

```
身份证.pdf
劳动合同.pdf
公司机密.docx
```

永久保存风险很高。

而且 AI Chat 附件通常只是一次性上下文。

---

## 建议设计

### 1. attachment 表

```sql
chat_attachment

id
uid

file_name
file_size
mime_type

storage_key

extract_status
extract_text_id

created_at
expire_at
deleted_at
```

例如：

```
storage_key:

chat/2026/07/30/abc123.pdf
```

### 2. 文本表

```sql
chat_attachment_text

id

attachment_id

content

token_count

created_at
```

例如：

```
attachment:
resume.pdf

text:

张三
Java工程师
5年经验
...
```

### 3. 消息关联

```sql
chat_message_attachment

message_id
attachment_id
```

这样：

```
用户:
请分析这个简历

message
 |
 attachment
 |
 resume.pdf
 |
 extracted text
```

---

## 生命周期建议

### 免费用户

```
原文件:
保存7天

文本:
保存聊天周期
```

例如：

用户关闭聊天：

30天后删除。

### VIP用户

```
原文件:
保存180天

文本:
永久
```

### 企业版

```
永久保存
支持知识库
```

---

## 对 AI 上下文怎么处理？

不要每次：

```
上传文件

↓

全部文本塞 prompt
```

应该：

第一次：

```
附件
 ↓
提取文本
 ↓
摘要
 ↓
结构化
```

保存：

```json
{
 "summary":
 "这是一个Java工程师简历",

 "key_points":[
   "Spring Boot",
   "微服务",
   "5年经验"
 ]
}
```

聊天时：

优先：

```
summary
+
相关片段
```

而不是整个文件。

---

## 如果现在 PassUp 做 MVP

我建议简单一点：

### 第一版：

```
MinIO保存原文件
        |
        |
AI提取文本
        |
        |
PostgreSQL保存文本
```

保存：

- 原文件：永久（先简单）
- 文本：永久

原因：

现在用户量小。

删除策略以后加：

```
attachment_cleanup_job
```

即可。

---

## 对 PassUp 特别建议

你的项目已经有：

- 简历解析
- 面试辅助
- AI上下文裁剪
- RAG讨论

所以建议不要把附件设计成普通聊天附件。

更像：

```
User Knowledge Asset
```

统一模型：

```
user_asset

   |
   +-- resume
   |
   +-- chat_document
   |
   +-- interview_material
   |
   +-- company_info
```

未来：

```
AI助手
 |
 查询用户资产
 |
 RAG
 |
 回答
```

会更自然。

---

## 最终建议

**当前版本：**

> 原文件存 MinIO，文本永久存数据库，聊天引用文本，不直接依赖原文件。

**未来版本：**

> 原文件作为用户资产，文本 + embedding 作为 AI 知识层。

这个路线和你现在 PassUp 的简历/面试 AI 架构是比较匹配的。
