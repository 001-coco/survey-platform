@echo off
chcp 65001 >nul
title 问卷平台 · 一键启动
cd /d "%~dp0"

echo ========================================
echo   问卷平台 一键启动
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有检测到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] 首次运行，正在安装依赖，请稍等...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络
    pause
    exit /b 1
  )
) else (
  echo [1/3] 依赖已就绪
)

echo [2/3] 启动后端 http://localhost:3000
start "问卷平台 - 后端(3000)" cmd /k "node server/index.js"

ping -n 3 127.0.0.1 >nul

echo [3/3] 启动前端 http://localhost:5173
start "问卷平台 - 前端(5173)" cmd /k "node node_modules\vite\bin\vite.js --open"

echo.
echo 已启动完成，浏览器会自动打开。
echo 默认账号：admin  密码：admin123
echo.
echo 关闭时：把弹出的两个黑窗口都关掉即可。
echo.
pause
