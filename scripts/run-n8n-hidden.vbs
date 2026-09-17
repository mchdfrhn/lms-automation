Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\lms-automation"
WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\lms-automation\scripts\n8n-daemon.js""", 0, False
