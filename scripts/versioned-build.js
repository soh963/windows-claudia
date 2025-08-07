#!/usr/bin/env node

/**
 * Versioned Build Script for Claudia
 * Includes version number in the build output name
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Get build timestamp
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Determine platform
const platform = process.platform;
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

// Create build name with version
const buildName = `Claudia-v${version}`;
const fullBuildName = `${buildName}-${timestamp}`;

console.log('========================================');
console.log('  Claudia Versioned Build System');
console.log('========================================');
console.log(`Version: ${version}`);
console.log(`Platform: ${platform}`);
console.log(`Build Name: ${fullBuildName}`);
console.log('========================================');

try {
    // Update tauri.conf.json with version
    const tauriConfigPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
    
    // Ensure version is synchronized
    if (tauriConfig.version !== version) {
        console.log(`Updating tauri.conf.json version from ${tauriConfig.version} to ${version}`);
        tauriConfig.version = version;
        fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2));
    }
    
    // Build the application
    console.log('Building Claudia...');
    
    // Use bun to build frontend first
    console.log('Building frontend with bun...');
    execSync('bun run build', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    
    // Then build with Tauri
    console.log('Building with Tauri...');
    const buildCommand = `bun run tauri build`;
    
    execSync(buildCommand, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    
    // After build, rename the output files to include version
    console.log('Renaming output files with version...');
    
    const targetDir = path.join(__dirname, '..', 'src-tauri', 'target', 'release');
    const bundleDir = path.join(targetDir, 'bundle');
    
    // Platform-specific renaming
    if (isWindows) {
        // Windows: .exe and .msi files
        const exePath = path.join(targetDir, 'Claudia.exe');
        const versionedExePath = path.join(targetDir, `${buildName}.exe`);
        
        if (fs.existsSync(exePath)) {
            fs.renameSync(exePath, versionedExePath);
            console.log(`✓ Renamed: Claudia.exe → ${buildName}.exe`);
        }
        
        // Check for MSI installer
        const msiDir = path.join(bundleDir, 'msi');
        if (fs.existsSync(msiDir)) {
            const files = fs.readdirSync(msiDir);
            files.forEach(file => {
                if (file.endsWith('.msi')) {
                    const oldPath = path.join(msiDir, file);
                    const newPath = path.join(msiDir, `${buildName}_x64.msi`);
                    fs.renameSync(oldPath, newPath);
                    console.log(`✓ Renamed: ${file} → ${buildName}_x64.msi`);
                }
            });
        }
        
        // Check for NSIS installer
        const nsisDir = path.join(bundleDir, 'nsis');
        if (fs.existsSync(nsisDir)) {
            const files = fs.readdirSync(nsisDir);
            files.forEach(file => {
                if (file.endsWith('.exe')) {
                    const oldPath = path.join(nsisDir, file);
                    const newPath = path.join(nsisDir, `${buildName}_x64-setup.exe`);
                    fs.renameSync(oldPath, newPath);
                    console.log(`✓ Renamed: ${file} → ${buildName}_x64-setup.exe`);
                }
            });
        }
    } else if (isMac) {
        // macOS: .app and .dmg files
        const dmgDir = path.join(bundleDir, 'dmg');
        if (fs.existsSync(dmgDir)) {
            const files = fs.readdirSync(dmgDir);
            files.forEach(file => {
                if (file.endsWith('.dmg')) {
                    const oldPath = path.join(dmgDir, file);
                    const newPath = path.join(dmgDir, `${buildName}.dmg`);
                    fs.renameSync(oldPath, newPath);
                    console.log(`✓ Renamed: ${file} → ${buildName}.dmg`);
                }
            });
        }
    } else if (isLinux) {
        // Linux: AppImage and .deb files
        const appimageDir = path.join(bundleDir, 'appimage');
        if (fs.existsSync(appimageDir)) {
            const files = fs.readdirSync(appimageDir);
            files.forEach(file => {
                if (file.endsWith('.AppImage')) {
                    const oldPath = path.join(appimageDir, file);
                    const newPath = path.join(appimageDir, `${buildName}.AppImage`);
                    fs.renameSync(oldPath, newPath);
                    console.log(`✓ Renamed: ${file} → ${buildName}.AppImage`);
                }
            });
        }
        
        const debDir = path.join(bundleDir, 'deb');
        if (fs.existsSync(debDir)) {
            const files = fs.readdirSync(debDir);
            files.forEach(file => {
                if (file.endsWith('.deb')) {
                    const oldPath = path.join(debDir, file);
                    const newPath = path.join(debDir, `${buildName}_amd64.deb`);
                    fs.renameSync(oldPath, newPath);
                    console.log(`✓ Renamed: ${file} → ${buildName}_amd64.deb`);
                }
            });
        }
    }
    
    // Create a build info file
    const buildInfo = {
        version,
        buildName: fullBuildName,
        timestamp: now.toISOString(),
        platform,
        nodejs: process.version,
        commit: getGitCommit()
    };
    
    const buildInfoPath = path.join(targetDir, 'build-info.json');
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
    console.log(`✓ Created build-info.json`);
    
    console.log('========================================');
    console.log('  Build completed successfully!');
    console.log(`  Version: ${version}`);
    console.log(`  Output: ${targetDir}`);
    console.log('========================================');
    
} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
}

function getGitCommit() {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
        return 'unknown';
    }
}