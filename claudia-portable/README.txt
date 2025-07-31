# Claudia Portable

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
