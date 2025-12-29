## Thread 基本使用

```cs
// 使用 Thread 创建的线程，默认为前台线程
Thread tmpThread = new Thread(WriteFile);

tmpThread.Name = "TestThread";

// 设置为后台线程
// tmpThread.IsBackground = true;

tmpThread.Start();

void WriteFile()
{
    while (true)
    {
        using (FileStream fs = File.Open(@"D:\test.txt", FileMode.Append, FileAccess.Write, FileShare.ReadWrite))
        {
            byte[] buff = System.Text.UnicodeEncoding.UTF8.GetBytes(string.Format("Time:{0}\r\n", DateTime.Now.ToString()));
            fs.Write(buff, 0, buff.Length);
        }
        Thread.Sleep(10);
    }
}
```



## Thread.Sleep

挂起当前线程的操作


