@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo   Local server (acceptance)
echo   Dir: %CD%
echo ========================================
echo.

call "%~dp0start-local.bat"
endlocal
