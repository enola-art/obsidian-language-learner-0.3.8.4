@echo off
chcp 65001 >nul
echo ========================================
echo   Language Learner 插件部署脚本
echo   版本: 1.0.0
echo ========================================
echo.

cd /d "%~dp0"

REM 检查Node.js是否安装
echo [1/5] 检查环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先下载安装: https://nodejs.org/
    pause
    exit /b 1
)

node --version
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 npm，请重新安装 Node.js
    pause
    exit /b 1
)

echo.
echo [2/5] 安装依赖...
if not exist "node_modules" (
    npm install
    if %errorlevel% neq 0 (
        echo [错误] npm install 失败！
        pause
        exit /b 1
    )
) else (
    echo 依赖已安装，跳过
)

echo.
echo [3/5] 编译项目...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 编译失败！
    pause
    exit /b 1
)

echo.
echo [4/5] 准备部署文件...

set SOURCE_DIR=.
set TARGET_DIR=..\..\..\.obsidian\plugins\obsidian-language-learner-0.3.3

if not exist "%TARGET_DIR%" (
    echo [错误] 插件目录不存在: %TARGET_DIR%
    pause
    exit /b 1
)

echo 源目录: %SOURCE_DIR%
echo 目标目录: %TARGET_DIR%
echo.

REM 复制文件
echo 复制 main.js...
copy /Y "%SOURCE_DIR%\main.js" "%TARGET_DIR%\main.js"

echo 复制 stat-bundle.mjs...
copy /Y "%SOURCE_DIR%\stat-bundle.mjs" "%TARGET_DIR%\stat-bundle.mjs"
if %errorlevel% neq 0 (
    echo [警告] 复制 main.js 失败
)

echo 复制 manifest.json...
copy /Y "%SOURCE_DIR%\manifest.json" "%TARGET_DIR%\manifest.json"
if %errorlevel% neq 0 (
    echo [警告] 复制 manifest.json 失败
)

echo 复制 styles.css...
copy /Y "%SOURCE_DIR%\styles.css" "%TARGET_DIR%\styles.css"
if %errorlevel% neq 0 (
    echo [警告] 复制 styles.css 失败
)

echo 复制 variants-reverse.json...
copy /Y "%SOURCE_DIR%\variants-reverse.json" "%TARGET_DIR%\variants-reverse.json"
if %errorlevel% neq 0 (
    echo [警告] 复制 variants-reverse.json 失败
)

echo 复制 variants.json...
copy /Y "%SOURCE_DIR%\variants.json" "%TARGET_DIR%\variants.json"
if %errorlevel% neq 0 (
    echo [警告] 复制 variants.json 失败
)

echo 复制 exam-vocab.json...
copy /Y "%SOURCE_DIR%\exam-vocab.json" "%TARGET_DIR%\exam-vocab.json"
if %errorlevel% neq 0 (
    echo [警告] 复制 exam-vocab.json 失败
)

echo.
echo ========================================
echo   部署完成！
echo ========================================
echo.
echo 下一步:
echo 1. 在 Obsidian 中禁用 Language Learner 插件
echo 2. 重新启用插件
echo 3. 或直接重启 Obsidian
echo.
echo 新功能包括:
echo - 支持多个含义输入
echo - 英文含义不再必填
echo - 删除例句自动添加空白句
echo - 修复输入框导航和选择问题
echo.
pause
