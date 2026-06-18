@echo off
chcp 65001 >nul
cd /d "%~dp0"
title guangda-node-server

where npx >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 npx。请先安装 Node.js ^(https://nodejs.org/^) 并勾选加入 PATH。
  pause
  exit /b 1
)

echo.
echo 使用 npx http-server 在端口 8080 启动（若被占用请关闭占用程序后重试）
echo 浏览器将自动打开 http://127.0.0.1:8080/index.html
echo 按 Ctrl+C 停止服务
echo.

set "URL=http://127.0.0.1:8080/index.html"
echo %URL%> last-open-url.txt

start "" "%URL%"
npx --yes http-server . -p 8080 -a 127.0.0.1

pause
