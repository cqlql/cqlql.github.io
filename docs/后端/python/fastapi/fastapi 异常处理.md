

```bash
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 401:
        return JSONResponse(
            status_code=401,
            content={
                "message": "Token 已失效或未提供",
                "detail": exc.detail,
                "code": "token_invalid"
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 其他 HTTP 异常保持默认处理
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )
```

