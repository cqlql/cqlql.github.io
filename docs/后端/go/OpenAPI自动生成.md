# OpenAPI 自动生成（Code-as-Spec）

核心思路叫 **Code-as-Spec（代码即文档）**：放弃传统的“扫代码注释”方案，改为利用 Go 语言本身的**类型系统**、**Struct Tag（结构体标签）** 和 **代码注册机制** 来直接自动构建 OpenAPI Schema。

## 1. 现代化框架派：Huma v2（最丝滑）

Huma 是专为 OpenAPI 3.1 和 Go 1.20+ 设计的现代化 REST API 框架。在 Huma 里，**你写的处理函数（Handler）本身就自带 OpenAPI 描述**，完全不需要额外的步骤。

### 它怎么工作的？

定义强类型的请求和响应结构体，Huma 会在程序启动时自动分析类型，并直接挂载 `/openapi.json` 和 Swagger/RapiDoc UI 页面。

```go
// 1. 定义请求和响应（直接用 Go 结构体描述）
type GreetingInput struct {
    Name string `path:"name" doc:"要打招呼的人名" maxLength:"30"`
}

type GreetingOutput struct {
    Body struct {
        Message string `json:"message" example:"Hello, Alice!" doc:"返回的问候语"`
    }
}

// 2. 注册路由并绑定处理函数
huma.Register(api, huma.Operation{
    OperationID: "get-greeting",
    Method:      http.MethodGet,
    Path:        "/greeting/{name}",
    Summary:     "获取问候语",
    Description: "根据输入的名字返回一句问候",
}, func(ctx context.Context, input *GreetingInput) (*GreetingOutput, error) {
    resp := &GreetingOutput{}
    resp.Body.Message = "Hello, " + input.Name + "!"
    return resp, nil
})
```

### 为什么好用？

- **类型安全：** 如果字段名改了，或者类型传错了，**Go 编译器直接报错**，根本不需要等到生成文档时才发现。
- **零命令行工具：** 不需要像 `swag` 那样每次改完代码都跑一遍 `swag init`。程序一启动，打开 `http://localhost:8888/docs` 就是最新的文档。

## 2. 框架无关派：kin-openapi（灵活强大）

`kin-openapi` 是 Go 生态里处理 OpenAPI 3 最权威的底座库（很多大厂和工具都在用它）。它不是 Web 框架，而是一个 **OpenAPI 模型和构建器**。

### 它怎么生成的？

用纯 Go 代码像拼积木一样构建 OpenAPI 对象，或者通过它自动反射结构体：

```go
import "github.com/getkin/kin-openapi/openapi3"

// 1. 用纯 Go 代码定义 OpenAPI 实例
swagger := &openapi3.T{
    OpenAPI: "3.0.0",
    Info: &openapi3.Info{
        Title:   "My Go API",
        Version: "1.0.0",
    },
    Paths: openapi3.NewPaths(),
}

// 2. 利用反射自动把 Go 结构体转为 OpenAPI Schema
reflector := openapi3gen.NewReflector()
schema, _ := reflector.Reflect(MyUserStruct{})

// 3. 动态导出 JSON 或 YAML 文件
jsonBytes, _ := swagger.MarshalJSON()
```

### 适合什么场景？

如果使用的是 Gin、Echo 或 Go 标准库，又不想更换框架，可以用 `kin-openapi` 写一个简单的封装工具，在服务启动时自动扫描路由并对外暴露 `/swagger.json`。

## 3. 轻量组合派：go-chi/render + kin-openapi

`go-chi/render` 本身只是帮助 `chi` 框架格式化 JSON/XML 输入输出的响应工具，它**不能直接生成 OpenAPI**。

但是，`chi` 社区的普遍做法是：**将 `go-chi` 的路由元数据与 `kin-openapi`（或 `go-openapi`）绑定**。

比如利用社区开源的扩展库（如 `swaggest/rest` 等基于 chi 的衍生库），可以这样写：

```go
// 声明路由的同时，传给它结构体
r.Method(http.MethodPost, "/users", rest.Handler(func(ctx context.Context, input CreateUserInput) (CreateUserOutput, error) {
    // 业务逻辑
}))
```

底层会自动提取 `CreateUserInput` 和 `CreateUserOutput` 的结构，组合成 OpenAPI 的文档节点。

## 总结与对比：我该怎么选？

| 方案 | 是否需要跑命令行 (`swag init`) | 是否有编译器语法检查 | 迁移成本 | 推荐度 |
| --- | --- | --- | --- | --- |
| **传统 swag 注释** | **需要**（极其痛苦） | **无**（手抖写错不报错） | 现有项目默认 | ⭐️⭐️ |
| **Huma v2** | **不需要**（服务启动即生成） | **有**（100% 强类型） | 新项目/重构推荐 | ⭐️⭐️⭐️⭐️⭐️ |
| **kin-openapi** | **不需要** | **有** | 适合自研 SDK/中间件 | ⭐️⭐️⭐️⭐️ |

> **建议：**
> - 如果是**新项目**或者准备写微服务，强烈建议试试 **Huma**，体验会让你感觉“原来 Go 写 API 和文档可以这么优雅”。
> - 如果是**老项目**不想改框架，可以考虑通过 **kin-openapi** 结合结构体反射来代替那些繁琐的 `@Param` 注释。
