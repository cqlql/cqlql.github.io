
# file 文件

## 获取文件信息

```go
info, err := os.Stat("example.txt")
if err != nil {
    log.Fatal(err)
}
fmt.Println("文件名:", info.Name())
fmt.Println("文件大小:", info.Size())
fmt.Println("是否目录:", info.IsDir())
fmt.Println("修改时间:", info.ModTime())
```

## 判断文件是否存在

os.Stat 用于获取文件信息，常用来判断文件是否存在

```go
if _, err := os.Stat("example.txt"); err != nil {
    if os.IsNotExist(err) {
        fmt.Println("文件不存在")
    } else {
        fmt.Println("获取文件信息失败:", err)
    }
} else {
    fmt.Println("文件存在")
}
```

