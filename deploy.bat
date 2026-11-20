@echo off
chcp 65001 >nul
title 问卷平台 · 部署到 Netlify
cd /d "%~dp0"

echo ========================================
echo   构建并部署到 Netlify
echo ========================================
echo.

where netlify >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 netlify 命令
  echo 先执行：npm install -g netlify-cli
  pause
  exit /b 1
)

call netlify deploy --build --prod

echo.
echo 部署结束。上面输出的 Website URL 就是线上地址。
echo.
pause
