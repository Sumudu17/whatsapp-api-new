@echo off
REM Flyway Migration Helper Script for Windows (Docker-based)
REM Same pattern as ThingsNode New OTA Server. DB_* is primary; MYSQL_* is legacy fallback.
REM Usage: run-flyway.bat [command]
REM Commands: info, migrate, validate, repair, baseline

if "%1"=="" (
    echo Usage: run-flyway.bat [command]
    echo Commands: info, migrate, validate, repair, baseline
    exit /b 1
)

setlocal enabledelayedexpansion

set CURRENT_DIR=%~dp0

if exist "%CURRENT_DIR%.env" (
    echo 📋 Loading environment variables from .env
    for /f "usebackq tokens=1* eol=# delims==" %%a in ("%CURRENT_DIR%.env") do (
        set "var_name=%%a"
        set "var_value=%%b"
        for /f "tokens=*" %%x in ("!var_name!") do set "var_name=%%x"
        if not "!var_name!"=="" (
            set "!var_name!=!var_value!"
        )
    )
)

REM DB_* with fallback to legacy MYSQL_* then defaults
if not defined DB_HOST (
    if defined MYSQL_HOST set DB_HOST=!MYSQL_HOST!
)
if not defined DB_HOST set DB_HOST=localhost

if not defined DB_PORT (
    if defined MYSQL_PORT set DB_PORT=!MYSQL_PORT!
)
if not defined DB_PORT set DB_PORT=3306

if not defined DB_NAME (
    if defined MYSQL_DB set DB_NAME=!MYSQL_DB!
)
if not defined DB_NAME set DB_NAME=whatsapp_web_js

if not defined DB_USER (
    if defined MYSQL_USER set DB_USER=!MYSQL_USER!
)
if not defined DB_USER set DB_USER=root

if not defined DB_PASSWORD (
    if defined MYSQL_PASS set DB_PASSWORD=!MYSQL_PASS!
)
if not defined DB_PASSWORD set DB_PASSWORD=

if not defined FLYWAY_URL (
    if "!DB_HOST!"=="localhost" (
        set FLYWAY_URL=jdbc:mysql://host.docker.internal:!DB_PORT!/!DB_NAME!
        echo ℹ️  Converted localhost to host.docker.internal for Docker on Windows
    ) else if "!DB_HOST!"=="127.0.0.1" (
        set FLYWAY_URL=jdbc:mysql://host.docker.internal:!DB_PORT!/!DB_NAME!
        echo ℹ️  Converted 127.0.0.1 to host.docker.internal for Docker on Windows
    ) else (
        set FLYWAY_URL=jdbc:mysql://!DB_HOST!:!DB_PORT!/!DB_NAME!
    )
) else (
    if "!FLYWAY_URL:localhost=!" NEQ "!FLYWAY_URL!" (
        echo ℹ️  Converting localhost to host.docker.internal for Docker on Windows...
        set FLYWAY_URL=!FLYWAY_URL:localhost=host.docker.internal!
    )
    if "!FLYWAY_URL:127.0.0.1=!" NEQ "!FLYWAY_URL!" (
        echo ℹ️  Converting 127.0.0.1 to host.docker.internal for Docker on Windows...
        set FLYWAY_URL=!FLYWAY_URL:127.0.0.1=host.docker.internal!
    )
)

if not defined FLYWAY_USER set FLYWAY_USER=!DB_USER!
if not defined FLYWAY_PASSWORD set FLYWAY_PASSWORD=!DB_PASSWORD!

echo Running Flyway %1...
echo URL: !FLYWAY_URL!
echo User: !FLYWAY_USER!
echo.

docker run --rm ^
  -v "%CURRENT_DIR%db\migrations:/flyway/sql" ^
  flyway/flyway:latest ^
  -url=!FLYWAY_URL! ^
  -user=!FLYWAY_USER! ^
  -password=!FLYWAY_PASSWORD! ^
  -locations=filesystem:/flyway/sql ^
  -baselineOnMigrate=true ^
  %1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Flyway %1 completed successfully!
) else (
    echo.
    echo Flyway %1 failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
