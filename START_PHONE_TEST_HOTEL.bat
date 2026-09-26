@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title 3 Minutes to Midnight - Hotel Wi-Fi Phone Test
color 0A

echo.
echo ============================================================
echo   3 MINUTES TO MIDNIGHT - JERBOA P1 HOTEL TEST
echo ============================================================
echo.
echo Hotel Wi-Fi often blocks one guest device from reaching another.
echo This helper uses your PC's Mobile Hotspot instead.
echo.

where node >nul 2>&1
if errorlevel 1 goto INSTALL_NODE
goto NODE_OK

:INSTALL_NODE
echo Node.js is not installed yet. Installing the standard LTS version...
where winget >nul 2>&1
if errorlevel 1 goto NO_WINGET
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>&1
if errorlevel 1 goto NODE_RESTART
goto NODE_OK

:NO_WINGET
start "" "https://nodejs.org/en/download"
echo Install the LTS version, then double-click this file again.
pause
exit /b 1

:NODE_RESTART
echo Node.js was installed, but Windows needs a refresh.
echo Close this window and double-click START_PHONE_TEST_HOTEL.bat again.
pause
exit /b 0

:NODE_OK
if not exist "src\main.ts" if exist "dist\index.html" goto READY_TO_SERVE
if not exist "node_modules\" (
  echo Installing prototype files. This only happens the first time...
  call npm ci
  if errorlevel 1 goto NPM_FAIL
)

call npm run build
if errorlevel 1 goto NPM_FAIL
:READY_TO_SERVE
echo Checking for a Windows Mobile Hotspot...
call :FIND_HOTSPOT_IP
if defined PHONE_IP goto HOTSPOT_READY

echo.
echo I don't see a Mobile Hotspot running yet.
echo I am opening the correct Windows setting for you now.
echo.
start "" "ms-settings:network-mobilehotspot"
echo ------------------------------------------------------------
echo  1. Turn MOBILE HOTSPOT on in the Settings window.
echo  2. On your PHONE, join the hotspot name shown there.
echo  3. Come back to this green window and press any key.
echo ------------------------------------------------------------
echo.
pause >nul

call :FIND_HOTSPOT_IP
if not defined PHONE_IP goto HOTSPOT_NOT_FOUND

:HOTSPOT_READY
echo.
echo Your phone must be connected to the PC hotspot.
echo The phone address will appear below after the server starts.
echo.
echo Opening the prototype on this PC too...
rem Browser opens once the server is ready.
echo.
echo Starting server now. KEEP THIS WINDOW OPEN while testing.
echo To stop later, close this window or press Ctrl+C.
echo.
node scripts\serve.mjs --auto-port --open
if errorlevel 1 goto RUN_FAIL
exit /b 0

:FIND_HOTSPOT_IP
set "PHONE_IP="
for /f "delims=" %%I in ('node scripts\network.mjs --hotspot') do set "PHONE_IP=%%I"
exit /b 0

:HOTSPOT_NOT_FOUND
echo.
echo I still cannot see the PC's Mobile Hotspot address.
echo Leave Mobile Hotspot ON and make sure your phone has joined it.
echo Then double-click this file again.
echo.
echo If it still fails, send ChatGPT a screenshot of this window and
echo the Windows Mobile Hotspot settings screen.
pause
exit /b 1

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
