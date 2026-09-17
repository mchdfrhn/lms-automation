@echo off
echo =======================================================
echo   MEMULAI n8n DENGAN DUKUNGAN EXECUTE COMMAND NODE     
echo =======================================================
set NODES_EXCLUDE=[]
if exist "%LOCALAPPDATA%\npm-cache\_npx\a8a7eec953f1f314\node_modules\n8n\bin\n8n" (
    node "%LOCALAPPDATA%\npm-cache\_npx\a8a7eec953f1f314\node_modules\n8n\bin\n8n" start
) else (
    npx n8n start
)
