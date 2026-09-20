; Installer for the Windows build. Parameters come from scripts/make-installer.mjs via -D:
;   APP_DIR   the packaged Provenance-win32-<arch> folder
;   OUT_FILE  where to write the installer
;   VERSION   x.y.z
;   ARCH      x64 | arm64 | ia32
;   ICON      the .ico built from the game's own art
;
; It installs per user, so an unsigned game does not also demand administrator rights. Saves live
; in %APPDATA%\Provenance and are deliberately left alone on uninstall.

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define APP "Provenance"
!define PUBLISHER "Provenance"
!define REG_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP}"

Name "${APP} ${VERSION}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
InstallDirRegKey HKCU "Software\${APP}" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APP}"
VIAddVersionKey "FileDescription" "${APP} installer"
VIAddVersionKey "FileVersion" "${VERSION}.0"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" ""

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Play ${APP}"
!define MUI_FINISHPAGE_LINK "The player manual"
!define MUI_FINISHPAGE_LINK_LOCATION "$INSTDIR\PLAYER_MANUAL.md"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; Overwriting a running game fails halfway and leaves a broken folder, so stop before starting.
!macro EnsureNotRunning UN
Function ${UN}EnsureNotRunning
  ${If} ${FileExists} "$INSTDIR\${APP}.exe"
    ClearErrors
    FileOpen $0 "$INSTDIR\${APP}.exe" a
    ${If} ${Errors}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION \
        "${APP} is still running.$\r$\n$\r$\nClose it and press Retry." IDRETRY retry
      Abort
      retry:
        Call ${UN}EnsureNotRunning
    ${Else}
      FileClose $0
    ${EndIf}
  ${EndIf}
FunctionEnd
!macroend
!insertmacro EnsureNotRunning ""
!insertmacro EnsureNotRunning "un."

Section "${APP}" SecApp
  SectionIn RO
  Call EnsureNotRunning

  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}\*.*"

  WriteRegStr HKCU "Software\${APP}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\${APP}" "Version" "${VERSION}"

  CreateShortCut "$SMPROGRAMS\${APP}.lnk" "$INSTDIR\${APP}.exe" "" "$INSTDIR\${APP}.exe" 0

  WriteUninstaller "$INSTDIR\Uninstall ${APP}.exe"
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegStr   HKCU "${REG_UNINSTALL}" "DisplayName"     "${APP}"
  WriteRegStr   HKCU "${REG_UNINSTALL}" "DisplayVersion"  "${VERSION}"
  WriteRegStr   HKCU "${REG_UNINSTALL}" "Publisher"       "${PUBLISHER}"
  WriteRegStr   HKCU "${REG_UNINSTALL}" "DisplayIcon"     "$INSTDIR\${APP}.exe"
  WriteRegStr   HKCU "${REG_UNINSTALL}" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKCU "${REG_UNINSTALL}" "UninstallString" '"$INSTDIR\Uninstall ${APP}.exe"'
  WriteRegStr   HKCU "${REG_UNINSTALL}" "QuietUninstallString" '"$INSTDIR\Uninstall ${APP}.exe" /S'
  WriteRegDWORD HKCU "${REG_UNINSTALL}" "EstimatedSize"   "$0"
  WriteRegDWORD HKCU "${REG_UNINSTALL}" "NoModify" 1
  WriteRegDWORD HKCU "${REG_UNINSTALL}" "NoRepair" 1
SectionEnd

Section /o "Desktop shortcut" SecDesktop
  CreateShortCut "$DESKTOP\${APP}.lnk" "$INSTDIR\${APP}.exe" "" "$INSTDIR\${APP}.exe" 0
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} "The game, its art and the manual. About 390 MB."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Put a shortcut on the desktop as well as the Start Menu."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  Call un.EnsureNotRunning

  Delete "$DESKTOP\${APP}.lnk"
  Delete "$SMPROGRAMS\${APP}.lnk"
  Delete "$INSTDIR\Uninstall ${APP}.exe"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\resources"
  Delete "$INSTDIR\*.*"
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "${REG_UNINSTALL}"
  DeleteRegKey HKCU "Software\${APP}"

  ; Saves in %APPDATA%\Provenance are the player's, and a reinstall should find them where it
  ; left them. Removing a game should not remove the run.
SectionEnd
