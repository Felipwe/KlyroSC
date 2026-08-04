!macro customInit
  ${If} ${FileExists} "$LOCALAPPDATA\KlyroSC\Update.exe"
    nsExec::Exec 'taskkill /F /IM KlyroSC.exe /T'
    ExecWait '"$LOCALAPPDATA\KlyroSC\Update.exe" --uninstall -s'
    RMDir /r "$LOCALAPPDATA\KlyroSC"
    RMDir /r "$LOCALAPPDATA\SquirrelTemp"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\KlyroSC"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\com.squirrel.KlyroSC.KlyroSC"
    Delete "$DESKTOP\KlyroSC.lnk"
    Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\KlyroSC.lnk"
    RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\KlyroSC"
  ${EndIf}
!macroend
