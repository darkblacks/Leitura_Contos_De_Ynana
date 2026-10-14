@echo off
cd /d "%~dp0"
where py >nul 2>nul && (py -3 ui\servidor.py) || (python ui\servidor.py)
pause
