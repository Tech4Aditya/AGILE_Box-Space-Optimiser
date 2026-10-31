@echo off
setlocal
cd /d "%~dp0"
echo ===============================================
echo       BOXSPACE OPTIMISER - LOCAL SERVER
echo ===============================================
where py >nul 2>nul
if %errorlevel%==0 (set PY=py) else (set PY=python)
%PY% --version
if errorlevel 1 (
  echo Python 3.10 or newer is required. Install Python and enable Add to PATH.
  pause
  exit /b 1
)
if not exist .venv\Scripts\python.exe (
  echo Creating isolated Python environment...
  %PY% -m venv .venv
  if errorlevel 1 goto failed
)
echo Installing / checking backend dependencies...
.venv\Scripts\python.exe -m pip install --disable-pip-version-check -r backend\requirements.txt
if errorlevel 1 goto failed
echo.
echo Backend starting at http://127.0.0.1:8000
echo API docs: http://127.0.0.1:8000/docs
echo Keep this window open while using BoxSpace.
echo.
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
 goto end
:failed
echo.
echo Startup failed. Check the error above. Python 3.10+ and internet are needed on first install.
pause
exit /b 1
:end
pause
