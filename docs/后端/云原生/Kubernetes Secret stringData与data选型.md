---
title: Kubernetes Secret stringData 与 data 选型
icon: mdi:form-textbox-password
sort: 9.5
---

> 本文梳理 Secret 中 `stringData` 与 `data` 两种写法的区别、各自适用场景与选型建议，重点讲清楚「为什么手写维护推荐 `stringData`」「多行 PEM 证书怎么写最省事」「两者的安全边界其实完全一致」三个问题，结合 `pass-up.backend` 的 `k8s/base/secret.example.yaml` 实例讲解。

## 一、两种写法是什么

Kubernetes 的 `Secret` 对象里，敏感键值可以用两种字段之一承载：

| 写法 | 内容形式 | 说明 |
| --- | --- | --- |
| `stringData` | **明文** | 直接填原文，集群接收后自动 base64 转码，再以 `data` 形式存储 |
| `data` | **Base64 编码** | 必须预先手动 `echo -n 'xxx' | base64` 转码后写入 |

最小对照：

```yaml
data:
  PASSWORD: cGFzc3dvcmQ=      # 预先 base64 好
```

```yaml
stringData:
  PASSWORD: password          # 直接明文
```

二者对同一个键**不能同时设置**（`stringData` 会自动合并到 `data`，出现同名键会校验冲突并报错）。一个 Secret 里要么用 `data`，要么用 `stringData`，混着写时键名也不能重复。

**关键结论：无论用哪个字段，Kubernetes 最终落库（etcd）的 `data` 都是 Base64 编码形式。** `stringData` 只是「写入时的便利写法」，集群接收后自动转码，最终存储形态与 `data` 完全一致。也就是说，用 `stringData` 不会「存进明文」，用 `data` 也不会「更安全」——两者的存储结果没有区别，区别只在「你写 YAML 时是写明文还是写编码」。

## 二、核心区别对比

| 特性 | `stringData`（手写推荐） | `data` |
| --- | --- | --- |
| 填写内容 | 明文（如 `postgres`） | Base64（如 `cG9zdGdyZXM=`） |
| 可读性 | 高，一眼看出真实值 | 低，看不出配置内容 |
| 修改效率 | 直接改字面值保存即可 | 每次改都必须重跑 base64 |
| 多行证书 | `|-` 直接粘贴原生 PEM | 换行、特殊字符转码极易出错 |
| 部署行为 | 自动转码后存储为 `data` | 原样存储 |

## 三、为什么手写维护推荐 stringData

### 1. 彻底摆脱 Base64 转换

用 `data` 时，改任何一个密钥（`SECURITY_JWT_SECRET` 或一段多行 PEM）都要先 `echo -n 'xxx' | base64` 手动转码。遇到带换行、特殊字符的证书，手动转码几乎必出错。

### 2. 多行证书极简配置

PEM 私钥/公钥这类长文本，用 `stringData` 的 `|-` 直接粘贴原文即可：

```yaml
stringData:
  wechat-pay-private-key.pem: |-
    -----BEGIN PRIVATE KEY-----
    MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
    -----END PRIVATE KEY-----
  wechat-pay-public-key.pem: |-
    -----BEGIN PUBLIC KEY-----
    MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
    -----END PUBLIC KEY-----
```

用 `stringData` 写 PEM 还有一个实操层面的好处：**挂载进容器后，文件内容就是原始 PEM 文本，应用读到即用，无需自己再 Base64 解码**。反过来，如果误用了 `data` 且没转码对，容器里读到的会是乱码，排查起来很隐蔽。

### 3. 安全边界完全一致

`data` 里的 Base64 **只是编码、不是加密**，任何人 `echo '...' | base64 -d` 一秒解出。无论用哪个字段，提交到 Git 都是安全隐患，存进 etcd 的安全级别也完全相同。所以「`data` 更安全」是一个常见误区，选型时不应把安全性作为区分依据。

## 四、何时该用 data

`stringData` 并非万能，以下场景 `data` 更合适：

1. **CI/CD 流水线自动生成 YAML**：脚本里 `base64` 是顺手的事，且输出的是可被 `kubectl apply` 直接消费的标准形态。
2. **从集群导出配置**：`kubectl get secret -o yaml` 导出的就是 `data` 字段（集群已自动转码），此时用 `data` 能原样 round-trip。
3. **需要精确控制字节内容**：`stringData` 经 YAML 解析后再编码，中间隔了一层 YAML 转义/换行处理；极端场景（如二进制内容）用 `data` 更可控。

## 五、结合 pass-up.backend 的实例

`k8s/base/secret.example.yaml` 最初用 `data` 全量 base64 占位，后来改成 `stringData` 明文，就是为了方便手写维护。改造后的形态：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: passup-backend-secret
  namespace: passup
type: Opaque
stringData:
  # 数据库
  SPRING_DATASOURCE_USERNAME: postgres
  SPRING_DATASOURCE_PASSWORD: CHANGE_ME

  # Redis（留空表示无密码）
  SPRING_DATA_REDIS_PASSWORD: ""

  # 微信支付商户私钥 / 平台证书公钥（直接粘贴 PEM 明文，无需转码）
  wechat-pay-private-key.pem: |-
    -----BEGIN PRIVATE KEY-----
    CHANGE_ME
    -----END PRIVATE KEY-----
  wechat-pay-public-key.pem: |-
    -----BEGIN PUBLIC KEY-----
    CHANGE_ME
    -----END PUBLIC KEY-----
```

> 注意：`secret.example.yaml` 只是占位模板，真实值应复制为 `secret.yaml` 后填写，且**两者都不得提交 Git**（见文件头注释）。

这两个 PEM 键最终会被 `deployment.yaml` 以**文件挂载**方式投影到 `/app/secrets/` 下，而非环境变量注入。关于这一层「Secret 键 → 卷 → 文件 → 应用路径」的完整链路，详见 [[Kubernetes Secret文件挂载详解]]。

## 六、选型小结

```text
手写 YAML / 本地运维 / 日常部署   →  stringData（明文，直观好维护）
CI/CD 自动生成 / 集群导出 round-trip →  data（标准形态，免二次解析）
```

一句话：**人工维护的 Secret 配置文件选 `stringData`；只有脚本、CI/CD 自动生成 Secret Manifest 时才选 `data`**。安全性与两者无关，别把 Base64 当加密。
