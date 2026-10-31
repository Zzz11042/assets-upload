@echo off
rem asset-dashboard 一键部署脚本（Windows）
rem 用法: scripts\deploy-windows.bat
rem       $env:PORT=8080; scripts\deploy-windows.bat
setlocal
set REPO=https://github.com/Zzz11042/assets-upload.git
set SCRIPT_DIR=%~dp0
set ROOT=%SCRIPT_DIR%..
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%
set DB_DIR=%ROOT%\asset-dashboard

rem 1. 检测 node
where node >nul 2>nul
if errorlevel 1 (
    echo [X] 未检测到 Node.js，请先安装（Node ^>^= 18）
    echo      winget install OpenJS.NodeJS.LTS
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo Node 版本: %NODE_VER%

rem 2. 若不在仓库目录则 clone
if not exist "%DB_DIR%" (
    echo 未检测到本地仓库，开始 clone 到 %ROOT%
    git clone %REPO% "%ROOT%\"
    if not exist "%DB_DIR%" (
        echo [X] 未找到 asset-dashboard\，请确认仓库结构
        pause
        exit /b 1
    )
)

rem 3. 启动
cd /d "%DB_DIR%"
if not defined PORT set PORT=7800
echo 启动 asset-dashboard（端口 %PORT%）
node server.mjs
echo 访问: http://127.0.0.1:%PORT%
pause
