@echo off
setlocal

:: Set Tauri environment for portable mode
set TAURI_SKIP_DEVSERVER_CHECK=true
set APPDATA=%~dp0appdata

:: Create local appdata directory
if not exist "%~dp0appdata" mkdir "%~dp0appdata"

:: Launch Claudia
start "" "%~dp0claudia.exe"

endlocal
