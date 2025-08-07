#!/usr/bin/env python3

import re

def fix_error_detection_imports():
    file_path = r"D:\claudia\src-tauri\src\commands\error_detection_system.rs"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add Manager import to tauri import line
    old_import = "use tauri::{command, AppHandle, Emitter, State};"
    new_import = "use tauri::{command, AppHandle, Emitter, State, Manager};"
    
    content = content.replace(old_import, new_import)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed error_detection_system.rs imports")

def fix_model_disability_imports():
    file_path = r"D:\claudia\src-tauri\src\commands\model_disability_manager.rs"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add Manager and Emitter imports
    if "use tauri::" in content:
        # Find the tauri import line and add missing imports
        old_pattern = r"use tauri::\{([^}]*)\};"
        match = re.search(old_pattern, content)
        if match:
            imports = match.group(1).strip()
            if "Manager" not in imports:
                imports += ", Manager"
            if "Emitter" not in imports:
                imports += ", Emitter"
            new_import = f"use tauri::{{{imports}}};"
            content = re.sub(old_pattern, new_import, content)
    else:
        # Add new import line at the beginning after existing imports
        content = "use tauri::{Manager, Emitter};\n" + content
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed model_disability_manager.rs imports")

if __name__ == "__main__":
    fix_error_detection_imports()
    fix_model_disability_imports()