## 安装

pip3 install flask

## 返回 json

名称必须是字符串

```py
@app.route("/test")
def test():
    return {
        'status': 1
    }
```

## get post 请求

默认就是 get 请求

```py
@app.route("/api/sendcode", methods=["POST"])
async def sendCode():
    return {
        'data': request.json['phoneNumber']
        'status': 1
    }
```

## 获取 post 请求参数

```py
@app.route("/api/sendcode", methods=["POST"])
async def sendCode():
    return {
        'data': request.json['phoneNumber']
        'status': 1
    }
```
