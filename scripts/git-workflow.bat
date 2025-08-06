@echo off
REM Claudia Git Workflow - Windows Batch Wrapper

if "%1"=="" (
    powershell -ExecutionPolicy Bypass -File "%~dp0git-workflow.ps1" auto
) else (
    powershell -ExecutionPolicy Bypass -File "%~dp0git-workflow.ps1" %*
)