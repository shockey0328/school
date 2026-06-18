# 与 start-local.bat 相同：在本窗口启动 serve-local.py
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
try { $Host.UI.RawUI.WindowTitle = 'guangda-http-server' } catch { }

if (Get-Command python -ErrorAction SilentlyContinue) {
    & python .\serve-local.py
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 .\serve-local.py
} else {
    Write-Host '未找到 python / py，请使用 Anaconda Prompt 运行: python serve-local.py' -ForegroundColor Red
    Read-Host '按回车退出'
    exit 1
}

Read-Host "`n按回车退出"
