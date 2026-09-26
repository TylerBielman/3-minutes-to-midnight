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
echo Finding an unused game port...
set "GAME_PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$used=@(3000,5173); foreach($p in 5180..5299){ if($used -notcontains $p -and -not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)){ $p; break } }"`) do set "GAME_PORT=%%P"
if not defined GAME_PORT set "GAME_PORT=5180"
echo Using port !GAME_PORT! for 3 Minutes to Midnight.

echo.
echo Finding this PC's Wi-Fi address...
set "PHONE_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$r=Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue ^| Where-Object {$_.NextHop -ne '0.0.0.0'} ^| Sort-Object RouteMetric ^| Select-Object -First 1; if($r){Get-NetIPAddress -InterfaceIndex $r.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object {$_.IPAddress -notlike '169.254*'} ^| Select-Object -First 1 -ExpandProperty IPAddress}"`) do set "PHONE_IP=%%I"

if not defined PHONE_IP (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*'} ^| Select-Object -First 1 -ExpandProperty IPAddress"`) do set "PHONE_IP=%%I"
)

echo.
echo ============================================================
if defined PHONE_IP (
  echo   ON YOUR PHONE, OPEN:
  echo.
  echo       http://!PHONE_IP!:!GAME_PORT!
  echo.
) else (
  echo   I could not automatically find your Wi-Fi IP address.
  echo   The PC version will still open below.
)
echo ============================================================
echo.
echo Make sure the phone is on the same Wi-Fi as this PC.
echo If Windows Firewall asks, choose Allow for PRIVATE networks.
echo.
echo Opening the prototype on this PC too...
rem Browser opens once the server is ready.
echo.
echo Starting server now. KEEP THIS WINDOW OPEN while testing.
echo To stop it later, close this window or press Ctrl+C.
echo.
node scripts\serve.mjs --port !GAME_PORT! --open
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
