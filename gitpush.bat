@echo off
REM Push changes to GitHub with timestamped commit message

REM Get date and time
for /f "tokens=1-4 delims=/ " %%a in ("%date%") do (
    set day=%%a
    set month=%%b
    set year=%%c
)

for /f "tokens=1-2 delims=: " %%a in ("%time%") do (
    set hour=%%a
    set minute=%%b
)

REM Remove leading spaces/zeros from hour
if %hour% LSS 10 set hour=0%hour%

REM Build commit message
set msg=commit at %hour%:%minute% - %day%/%month%/%year%

REM Stage all changes
git add .

REM Commit with generated message
git commit -m "%msg%"

REM Push to main branch
git push -u origin main --force
