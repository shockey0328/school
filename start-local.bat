@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title guangda-http-server

echo.
echo ========================================
echo   Local dashboard server
echo   Dir: %CD%
echo ========================================
echo.
echo Open http://127.0.0.1:8080/index.html after start
echo.

if exist "%USERPROFILE%\miniforge3\python.exe" (
  echo Using miniforge3 python
  "%USERPROFILE%\miniforge3\python.exe" serve-local.py
  goto :done
)
if exist "%USERPROFILE%\mambaforge\python.exe" (
  echo Using mambaforge python
  "%USERPROFILE%\mambaforge\python.exe" serve-local.py
  goto :done
)
if exist "%USERPROFILE%\anaconda3\python.exe" (
  echo Using anaconda3 python
  "%USERPROFILE%\anaconda3\python.exe" serve-local.py
  goto :done
)
if exist "%USERPROFILE%\miniconda3\python.exe" (
  echo Using miniconda3 python
  "%USERPROFILE%\miniconda3\python.exe" serve-local.py
  goto :done
)

set "PYEXE="
for /f "delims=" %%P in ('where python 2^>nul') do (
  echo %%P| findstr /i "\\WindowsApps\\" >nul
  if errorlevel 1 if not defined PYEXE set "PYEXE=%%P"
)
if defined PYEXE (
  echo Using python: %PYEXE%
  "%PYEXE%" serve-local.py
  goto :done
)

where py >nul 2>&1
if not errorlevel 1 (
  echo Using py launcher
  py -3 serve-local.py
  goto :done
)

echo [ERROR] Python not found.
echo Install Miniforge/Anaconda, or add Python to PATH.
echo Or run: start-local-node.bat if Node.js is installed.
echo.
pause
exit /b 1

:done
echo.
pause
endlocal
