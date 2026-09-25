@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title 3 Minutes to Midnight - Hotel Wi-Fi Phone Test
color 0A

echo.
echo ============================================================
echo   3 MINUTES TO MIDNIGHT - HOTEL WIFI PHONE TEST
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
if not exist "node_modules\" (
  echo Installing prototype files. This only happens the first time...
  call npm install
  if errorlevel 1 goto NPM_FAIL
)

echo Finding a free game port...
set "GAME_PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$reserved=@(3000,5173); foreach($p in 5180..5299){ if($reserved -notcontains $p -and -not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)){ $p; break } }"`) do set "GAME_PORT=%%P"
if not defined GAME_PORT set "GAME_PORT=5180"
echo Using port !GAME_PORT!.

echo.
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
echo ============================================================
echo   ON YOUR PHONE, OPEN:
echo.
echo       http://!PHONE_IP!:!GAME_PORT!
echo.
echo ============================================================
echo.
echo Your phone must be connected to the PC's Mobile Hotspot,
echo NOT directly to the hotel's Wi-Fi.
echo.
echo If Windows Firewall asks, choose Allow for PRIVATE networks.
echo.
echo Opening the prototype on this PC too...
start "" "http://localhost:!GAME_PORT!"
echo.
echo Starting server now. KEEP THIS WINDOW OPEN while testing.
echo To stop later, close this window or press Ctrl+C.
echo.
call npm run dev -- --host 0.0.0.0 --port !GAME_PORT! --strictPort
if errorlevel 1 goto RUN_FAIL
exit /b 0

:FIND_HOTSPOT_IP
set "PHONE_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ips=Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object {$_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1'}; $h=$ips ^| Where-Object {$_.IPAddress -like '192.168.137.*' -or $_.InterfaceAlias -match 'Local Area Connection|Wi-Fi Direct|Mobile Hotspot'} ^| Sort-Object @{Expression={if($_.IPAddress -like '192.168.137.*'){0}else{1}}} ^| Select-Object -First 1 -ExpandProperty IPAddress; if($h){$h}"`) do set "PHONE_IP=%%I"
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
