# OpenAPI 使用

## 访问

原生集成，可直接访问

**Swagger UI**: `http://127.0.0.1:8000/docs`

**ReDoc**: `http://127.0.0.1:8000/redoc`

**原始 OpenAPI JSON**: `http://127.0.0.1:8000/openapi.json`

## 设置标题、描述和版本

```
from fastapi import FastAPI

app = FastAPI(
    title="我的酷炫项目 API",
    description="这是一个使用 FastAPI 自动生成的文档示例",
    version="1.0.0",
    terms_of_service="http://example.com/terms/",
    contact={
        "name": "技术支持",
        "email": "support@example.com",
    },
    license_info={
        "name": "Apache 2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0.html",
    },
)
```

## 为接口添加详细说明

```
@app.get("/items/", tags=["物品管理"], summary="查询所有物品")
async def read_items():
    """
    这里是详细的描述信息：
    - **items**: 返回一个列表
    - **status**: 返回成功状态
    """
    return [{"item_id": "Foo"}]
```

## 路径参数与请求体的文档化

```
from pydantic import BaseModel, Field

class Item(BaseModel):
    name: str = Field(..., example="高级相机")
    price: float = Field(..., gt=0, description="价格必须大于 0")
    tax: float | None = None

@app.post("/items/", tags=["物品管理"])
async def create_item(item: Item):
    return item
```

## 自定义 OpenAPI URL 和禁用文档

```
app = FastAPI(
    docs_url="/my-custom-docs", # 更改 Swagger UI 路径
    redoc_url=None,             # 禁用 ReDoc
    openapi_url="/api/v1/openapi.json" # 更改 OpenAPI JSON 路径
)
```

