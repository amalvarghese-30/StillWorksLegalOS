; NSIS Custom Installer Script for StillWorks LegalOS
; This script runs during installation and can customize the installer behavior

!ifndef STILLWORKS_LEGALOS_INSTALLER_NSH
!define STILLWORKS_LEGALOS_INSTALLER_NSH

; Custom welcome page text
!define MUI_WELCOMEPAGE_TITLE "Welcome to StillWorks LegalOS Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of StillWorks LegalOS.$\n$\nClick Next to continue."

; Custom finish page text
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "StillWorks LegalOS has been successfully installed.$\n$\nClick Finish to launch the application."

; License page text (optional - add custom license text)
; !define MUI_LICENSEPAGE_TEXT "Please read the license agreement before installing StillWorks LegalOS."

; Enable per-machine installation (requires admin)
RequestExecutionLevel admin

; Ensure installer runs with admin rights
!macro customInit
  ; Custom initialization if needed
!macroend

!endif