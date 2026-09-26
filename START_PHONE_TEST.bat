@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title 3 Minutes to Midnight - Phone Prototype
color 0A

echo.
echo ============================================================
echo   3 MINUTES TO MIDNIGHT - JERBOA P1
echo ============================================================
echo.
echo This window will set up and run the prototype for you.
echo Keep it open while you test on your phone.
echo.

where node >nul 2>&1
if errorlevel 1 goto INSTALL_NODE
goto NODE_OK

:INSTALL_NODE
echo Node.js is not installed yet. I will install the standard LTS version.
echo.
where winget >nul 2>&1
if errorlevel 1 goto NO_WINGET
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>&1
if errorlevel 1 goto NODE_RESTART
goto NODE_OK

:NO_WINGET
echo I could not find Windows Package Manager on this PC.
echo Opening the official Node.js download page.
start "" "https://nodejs.org/en/download"
echo Install the LTS version, then double-click this file again.
pause
exit /b 1

:NODE_RESTART
echo Node.js was installed, but Windows has not refreshed the command path yet.
echo Close this window and double-click START_PHONE_TEST.bat again.
pause
exit /b 0

:NODE_OK
echo Node.js found.
if not exist "src\main.ts" if exist "dist\index.html" goto READY_TO_SERVE
if not exist "node_modules\" (
  echo Installing prototype files. This only happens the first time...
  call npm ci
  if errorlevel 1 goto NPM_FAIL
)

echo.
call npm run build
if errorlevel 1 goto NPM_FAIL
:READY_TO_SERVE
echo.
echo The phone address will appear below after the server starts.
echo Connect your phone to the same Wi-Fi or PC hotspot.
echo.
echo Opening the prototype on this PC too...
rem Browser opens once the server is ready.
echo.
echo Starting server now. KEEP THIS WINDOW OPEN while testing.
echo To stop it later, close this window or press Ctrl+C.
echo.
node scripts\serve.mjs --auto-port --open
if errorlevel 1 goto RUN_FAIL
exit /b 0

:NPM_FAIL
echo.
echo Setup failed while installing dependencies.
echo Take a screenshot of this window and send it to ChatGPT.
pause
exit /b 1

:RUN_FAIL
echo.
echo The prototype server stopped unexpectedly.
echo Take a screenshot of this window and send it to ChatGPT.
pause
exit /b 1
