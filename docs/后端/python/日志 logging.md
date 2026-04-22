```python
configure_logging()

# 测试日志
logger = logging.getLogger(__name__)
logger.info("这是一条普通信息")
logger.error("这是一条错误信息", extra={"user": "testuser"})

# 检查日志文件
print("请检查 logs/ 目录下的日志文件内容")
```

