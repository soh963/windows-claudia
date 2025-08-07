#!/usr/bin/env python3

# Quick fix for cross_model_memory.rs PartialEq issue

def fix_cross_model_memory():
    file_path = r"D:\claudia\src-tauri\src\commands\cross_model_memory.rs"
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the MemoryType enum by adding PartialEq
    old_line = "#[derive(Debug, Clone, Serialize, Deserialize)]\npub enum MemoryType {"
    new_line = "#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]\npub enum MemoryType {"
    
    content = content.replace(old_line, new_line)
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed MemoryType PartialEq derivation")

if __name__ == "__main__":
    fix_cross_model_memory()