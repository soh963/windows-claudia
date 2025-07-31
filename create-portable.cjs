const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function createPortableVersion() {
    console.log('Creating portable version of Claudia...');
    
    const portableDir = path.join(__dirname, 'claudia-portable');
    const releaseDir = path.join(__dirname, 'src-tauri', 'target', 'release');
    const distDir = path.join(__dirname, 'dist');
    const bundleDir = path.join(releaseDir, 'bundle');
    
    // Clean and create portable directory
    await fs.remove(portableDir);
    await fs.ensureDir(portableDir);
    
    // Copy executable
    const exePath = path.join(releaseDir, 'claudia.exe');
    if (await fs.pathExists(exePath)) {
        await fs.copy(exePath, path.join(portableDir, 'claudia.exe'));
        console.log('✅ Copied claudia.exe');
    } else {
        console.error('❌ claudia.exe not found. Please run "bun run tauri build" first.');
        return;
    }
    
    // Look for resources in bundle directory
    const nsisDir = path.join(bundleDir, 'nsis');
    if (await fs.pathExists(nsisDir)) {
        // Extract resources from NSIS bundle if possible
        const resourcesPath = path.join(nsisDir, 'resources');
        if (await fs.pathExists(resourcesPath)) {
            await fs.copy(resourcesPath, path.join(portableDir, 'resources'));
            console.log('✅ Copied bundled resources');
        }
    }
    
    // Copy WebView2 loader if exists
    const webview2Path = path.join(releaseDir, 'WebView2Loader.dll');
    if (await fs.pathExists(webview2Path)) {
        await fs.copy(webview2Path, path.join(portableDir, 'WebView2Loader.dll'));
        console.log('✅ Copied WebView2Loader.dll');
    }
    
    // Create launcher script
    const launcherContent = `@echo off
setlocal

:: Set Tauri environment for portable mode
set TAURI_SKIP_DEVSERVER_CHECK=true
set APPDATA=%~dp0appdata

:: Create local appdata directory
if not exist "%~dp0appdata" mkdir "%~dp0appdata"

:: Launch Claudia
start "" "%~dp0claudia.exe"

endlocal
`;
    
    await fs.writeFile(path.join(portableDir, 'launch-claudia.bat'), launcherContent);
    console.log('✅ Created launcher script');
    
    // Create README
    const readmeContent = `# Claudia Portable

This is a portable version of Claudia.

## How to use:
1. Run launch-claudia.bat to start Claudia
2. All settings will be stored in the local appdata folder

## Requirements:
- Windows 10/11
- WebView2 Runtime (usually pre-installed on Windows 10/11)

## Known Limitations:
Due to Tauri's security model, the portable version has some limitations:
- May require WebView2 Runtime installation
- Some features might not work as expected
- For best experience, use the installer version

## Alternative:
For development or testing, you can run Claudia from source:
1. Install Node.js and Bun
2. Navigate to the source directory
3. Run: bun install
4. Run: bun run tauri dev
`;
    
    await fs.writeFile(path.join(portableDir, 'README.txt'), readmeContent);
    console.log('✅ Created README');
    
    console.log('\n✅ Portable version created in:', portableDir);
    console.log('\nNote: Due to Tauri\'s architecture, full portable functionality is limited.');
    console.log('For best results, use the installer or run in development mode.');
}

createPortableVersion().catch(console.error);