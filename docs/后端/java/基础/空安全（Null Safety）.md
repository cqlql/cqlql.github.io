---
title: 空安全（Null Safety）
icon: mdi:shield-check
---

# Java 空安全（Null Safety）与 IDE 静态分析

> 目标：在**编译期 / IDE 阶段**尽早发现潜在的空指针风险，而不是等到运行时 NPE。

---

## 1. 背景：为什么需要空安全

- `NullPointerException (NPE)` 是 Java 最常见的运行时异常之一
- 传统做法依赖：
  - 代码约定（口头/文档）
  - 大量 `if (x != null)`
- 问题：
  - 容易遗漏
  - 协作成本高
  - 问题发现太晚（运行时）

**解决思路**：
> 把“是否允许为 null”变成**代码级契约**，并交给 IDE / 编译器提前检查。

---

## 2. Nullability 注解（空值语义声明）

### 常见注解

- `@NonNull`
  - 明确声明：**不允许为 null**
  - 常用于：
    - 方法参数
    - 构造函数参数
    - 关键字段

- `@Nullable`
  - 明确声明：**可能为 null**
  - 常用于：
    - getter 返回值
    - 查询类方法返回值

### 示例

```java
public class Person {
    private String name;

    public void setName(@NonNull String name) {
        this.name = name;
    }

    @Nullable
    public String getName() {
        return this.name;
    }
}
```

> 注解的作用不是“防御式编程”，而是**表达语义 + 静态分析依据**。

---

## 3. IDEA / 编译期 Null Analysis 配置

### 启用自动空分析

```json
{
  "java.compile.nullAnalysis.mode": "automatic"
}
```

启用后效果：

- 传 `null` 给 `@NonNull` 参数 → **IDE 报错 / 警告**
- 未判空直接使用 `@Nullable` 返回值 → **IDE 提示风险**
- 在编码阶段即可发现潜在 NPE

---

## 4. 注解 ≠ 运行时校验（重要）

- `@NonNull`：
  - **不等于** 自动生成 `Objects.requireNonNull`
  - 是否抛异常取决于：
    - Lombok
    - 手写校验

- 核心价值在于：
  - 静态分析
  - 契约清晰
  - 降低协作成本

---

## 5. 推荐使用场景

- Service / Domain 方法参数
- DTO / VO 对外接口
- 公共工具类 API
- 团队协作、多人维护项目

---

## 6. 与 Lombok 的关系

- `@NonNull` 常见于 Lombok，但：
  - Nullability 不是 Lombok 专属
  - JetBrains / JSR-305 注解同样适用

> Lombok 是**实现手段**，空安全是**工程目标**。

---

## 7. 总结

- Nullability 注解：**代码级契约**
- IDEA Null Analysis：**工程级安全网**
- 目标：
  - 把 NPE 从“运行时问题”提前到“编码期问题”

> 能在写代码时解决的问题，就不要留到线上。

