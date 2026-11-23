# 只读检查 Unity 安装链路状态。不改任何配置，不触发安装。
# 用法： .\verify-unity-install.ps1 [-Proxy http://127.0.0.1:7897]

param(
    [string]$Proxy = ""
)

$rows = @()
$fail = 0

function Add-Row {
    param([string]$Item, [bool]$Ok, [string]$Detail)
    $script:rows += [pscustomobject]@{
        检查项 = $Item
        状态   = $(if ($Ok) { "OK" } else { "缺失" })
        说明   = $Detail
    }
    if (-not $Ok) { $script:fail++ }
}

$cliPath = Join-Path $env:LOCALAPPDATA "Unity\bin\unity.exe"

# 1. CLI 二进制
$hasCli = Test-Path -LiteralPath $cliPath
$cliVer = ""
if ($hasCli) {
    $cliVer = (& $cliPath --version 2>&1 | Out-String).Trim()
    if (-not $cliVer) { $hasCli = $false; $cliVer = "执行无输出" }
}
Add-Row "Unity CLI" $hasCli $(if ($hasCli) { "$cliPath  $cliVer" } else { "未安装：$cliPath" })

# 2. 已装编辑器
$editors = ""
if ($hasCli) {
    $editors = (& $cliPath editors --installed 2>&1 | Out-String).Trim()
}
$hdPath = "D:\Program Files\Unity\Hub\Editor"
$hdHit = @()
if (Test-Path -LiteralPath $hdPath) {
    $hdHit = Get-ChildItem -LiteralPath $hdPath -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "Editor\Unity.exe") } |
        Select-Object -ExpandProperty Name
}
Add-Row "编辑器" (@($hdHit).Count -gt 0) $(if (@($hdHit).Count -gt 0) { (@($hdHit) -join ", ") } else { "未在 $hdPath 找到带 Editor\Unity.exe 的版本" })

# 3. 许可证
$lic = ""
if ($hasCli) { $lic = (& $cliPath license status 2>&1 | Out-String).Trim() }
$licOk = $lic -match "active\D*true" -or $lic -match "Assigned"
Add-Row "许可证" $licOk $(if ($licOk) { "已激活" } else { if ($lic) { "未激活：" + ($lic -replace "`r?`n", " ").Substring(0, [Math]::Min(160, $lic.Length)) } else { "无法读取（CLI 未装或未登录）" } })

# 4. Hub
$hubExe = "C:\Program Files\Unity Hub\Unity Hub.exe"
$hubOk = Test-Path -LiteralPath $hubExe
$hubVer = ""
if ($hubOk) { $hubVer = (Get-Item -LiteralPath $hubExe).VersionInfo.ProductVersion }
Add-Row "Unity Hub（全球版路径）" $hubOk $(if ($hubOk) { "$hubVer  $hubExe" } else { "未在 $hubExe 找到；旧版可能装在 D:\Program Files\Unity Hub" })

# 5. PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$binDir = Join-Path $env:LOCALAPPDATA "Unity\bin"
$pathOk = $userPath -and ($userPath -split ";" | Where-Object { $_.TrimEnd("\") -eq $binDir.TrimEnd("\") })
Add-Row "PATH 条目" ([bool]$pathOk) $(if ($pathOk) { "已写入（仅新终端生效）" } else { "用户 PATH 缺 $binDir" })

# 6. 代理（可选）
if ($Proxy) {
    $probeUrl = "https://public-cdn.cloud.unity3d.com/hub/prod/UnityHubSetup-x64.exe"
    $curl = (Get-Command curl.exe -ErrorAction SilentlyContinue).Source
    if (-not $curl) {
        $fallback = Join-Path $env:SystemRoot "System32\curl.exe"
        if (Test-Path -LiteralPath $fallback) { $curl = $fallback }
    }
    $code = ""
    if ($curl) {
        $code = (& $curl -x $Proxy -s -o NUL -w "%{http_code}" --range 0-1023 -m 20 $probeUrl 2>&1 | Out-String).Trim()
    } else {
        try {
            $r = Invoke-WebRequest -Uri $probeUrl -Method Head -Proxy $Proxy -TimeoutSec 20 -SkipHttpErrorCheck
            $code = [string]$r.StatusCode
        } catch { $code = "000" }
    }
    $pxOk = @("200", "206") -contains $code
    Add-Row "代理连通 ($Proxy)" ([bool]$pxOk) $(if ($pxOk) { "HTTP $code" } else { "HTTP $code —— 代理未运行/端口错/需认证" })
}

$rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Output

if ($fail -eq 0) {
    Write-Output "结论：安装链路完整。"
} else {
    Write-Output "结论：$fail 项缺失，按 SKILL.md 对应小节补齐。"
}
