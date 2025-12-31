
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

## 获取程序自身所在目录

获取当前正在运行的可执行文件的路径

```go
exePath, err := os.Executable()
if err != nil {
    panic(err)
}

exeDir := filepath.Dir(exePath)
fmt.Println(exeDir)
```

## 当前工作目录

启动时的 shell 目录，可能被 chdir 改变

```go
os.Getwd()
```
