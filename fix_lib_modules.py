#!/usr/bin/env python3

def fix_lib_modules():
    file_path = r"D:\claudia\src-tauri\src\lib.rs"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add missing module declarations that are used in main.rs but not in lib.rs
    old_modules = '''// Declare modules
pub mod checkpoint;
pub mod claude_binary;
pub mod commands;
pub mod analysis;
pub mod process;
pub mod windows_command;
pub mod runtime_utils;'''
    
    new_modules = '''// Declare modules
pub mod checkpoint;
pub mod claude_binary;
pub mod commands;
pub mod analysis;
pub mod process;
pub mod sidecar_wrapper;
pub mod windows_command;
pub mod runtime_utils;
pub mod adapters;
pub mod auto_resolution;'''
    
    content = content.replace(old_modules, new_modules)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Added missing module declarations to lib.rs")

if __name__ == "__main__":
    fix_lib_modules()