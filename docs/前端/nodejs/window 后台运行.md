```cmd
start pwsh -c "Start-Process -WindowStyle Hidden -FilePath node ./app.js -PassThru -RedirectStandardOutput out.log|out-file -filepath ./process.log"
```

`start pwsh -c` 为 cmd 打开 powershell
