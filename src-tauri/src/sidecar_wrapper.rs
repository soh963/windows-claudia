/// Windows-specific wrapper for sidecar processes to ensure hidden execution
/// This module provides utilities to wrap sidecar binaries with proper Windows flags

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
#[cfg(target_os = "windows")]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
#[cfg(target_os = "windows")]
const DETACHED_PROCESS: u32 = 0x00000008;

/// Wraps the execution of a command to ensure it runs without a visible window on Windows
pub fn execute_hidden(program: &str, args: Vec<String>) -> std::io::Result<std::process::ExitStatus> {
    let mut cmd = Command::new(program);
    
    for arg in args {
        cmd.arg(arg);
    }
    
    #[cfg(target_os = "windows")]
    {
        // Apply all flags to ensure complete window suppression
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS);
    }
    
    cmd.status()
}

/// Creates a Windows batch file wrapper that executes commands without showing a console
#[cfg(target_os = "windows")]
pub fn create_batch_wrapper(target_exe: &str, wrapper_path: &str) -> std::io::Result<()> {
    use std::fs;
    
    // Create a VBScript that launches the target without a window
    let vbs_content = format!(
        r#"Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "{}" & chr(34) & " " & WScript.Arguments.Named.Item("args"), 0, True
Set WshShell = Nothing"#,
        target_exe
    );
    
    let vbs_path = wrapper_path.replace(".bat", ".vbs");
    fs::write(&vbs_path, vbs_content)?;
    
    // Create a batch file that calls the VBScript
    let bat_content = format!(
        r#"@echo off
cscript //nologo "{}" /args:"%*"
exit /b %errorlevel%"#,
        vbs_path
    );
    
    fs::write(wrapper_path, bat_content)?;
    
    Ok(())
}

/// Alternative: Create a PowerShell wrapper that hides the window
#[cfg(target_os = "windows")]
pub fn create_powershell_wrapper(target_exe: &str, wrapper_path: &str) -> std::io::Result<()> {
    use std::fs;
    
    let ps1_content = format!(
        r#"$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "{}"
$psi.Arguments = $args -join " "
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
$psi.UseShellExecute = $false

$process = [System.Diagnostics.Process]::Start($psi)
$process.WaitForExit()
exit $process.ExitCode"#,
        target_exe
    );
    
    let ps1_path = wrapper_path.replace(".bat", ".ps1");
    fs::write(&ps1_path, ps1_content)?;
    
    // Create a batch file that calls PowerShell with the script
    let bat_content = format!(
        r#"@echo off
powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "{}" %*
exit /b %errorlevel%"#,
        ps1_path
    );
    
    fs::write(wrapper_path, bat_content)?;
    
    Ok(())
}