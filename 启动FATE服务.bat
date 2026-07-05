@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   FATE 命理报告服务 —— 黑客松接单用
echo   地址 http://localhost:3000
echo   保持此窗口开着；关掉窗口 = 停止服务
echo ================================================
call npm start
pause
