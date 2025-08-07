#!/usr/bin/env python3

def register_error_detection_commands():
    file_path = r"D:\claudia\src-tauri\src\main.rs"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add imports at the top with other imports
    import_line = "use commands::error_tracker::{track_error, record_error, get_error, list_errors, resolve_error, get_error_stats, get_error_metrics, search_errors};"
    
    # Add error detection system imports after the error_tracker import
    new_import_line = import_line + "\nuse commands::error_detection_system::{initialize_error_detection_system, detect_error_in_message, get_error_detection_status};"
    
    content = content.replace(import_line, new_import_line)
    
    # Add the commands to the invoke handler
    # Find the error tracking commands section and add after it
    old_section = '''            // Error Tracking System
            track_error,
            record_error,
            get_error,
            list_errors,
            resolve_error,
            get_error_stats,
            get_error_metrics,
            search_errors,'''
    
    new_section = '''            // Error Tracking System
            track_error,
            record_error,
            get_error,
            list_errors,
            resolve_error,
            get_error_stats,
            get_error_metrics,
            search_errors,
            
            // Error Detection System
            initialize_error_detection_system,
            detect_error_in_message,
            get_error_detection_status,'''
    
    content = content.replace(old_section, new_section)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Registered error detection commands in main.rs")

if __name__ == "__main__":
    register_error_detection_commands()