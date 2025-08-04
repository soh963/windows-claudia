use std::fs;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, serde::Serialize)]
pub struct SavedImage {
    pub path: String,
    pub filename: String,
}

#[tauri::command]
pub async fn save_base64_image(
    app: AppHandle,
    base64_data: String,
    mime_type: Option<String>,
) -> Result<SavedImage, String> {
    // Parse the base64 data URL if it includes the data: prefix
    let (actual_mime_type, base64_content) = if base64_data.starts_with("data:") {
        // Extract mime type and base64 content from data URL
        let parts: Vec<&str> = base64_data.split(',').collect();
        if parts.len() != 2 {
            return Err("Invalid base64 data URL format".to_string());
        }
        
        let header = parts[0];
        let mime = header
            .strip_prefix("data:")
            .and_then(|s| s.strip_suffix(";base64"))
            .unwrap_or("image/png");
        
        (mime.to_string(), parts[1].to_string())
    } else {
        // Use provided mime type or default to png
        (mime_type.unwrap_or_else(|| "image/png".to_string()), base64_data)
    };
    
    // Decode base64
    let image_data = general_purpose::STANDARD
        .decode(&base64_content)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Determine file extension from mime type
    let extension = match actual_mime_type.as_str() {
        "image/jpeg" => "jpg",
        "image/jpg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        _ => "png", // Default to png
    };
    
    // Create temp directory path
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp directory: {}", e))?;
    
    // Create claudia subdirectory in temp
    let claudia_temp = temp_dir.join("claudia_images");
    fs::create_dir_all(&claudia_temp)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    // Generate unique filename
    let filename = format!("claudia_image_{}_{}.{}", 
        chrono::Local::now().format("%Y%m%d_%H%M%S"),
        Uuid::new_v4().simple(),
        extension
    );
    
    let file_path = claudia_temp.join(&filename);
    
    // Write file
    fs::write(&file_path, image_data)
        .map_err(|e| format!("Failed to write image file: {}", e))?;
    
    // Return the absolute path
    let absolute_path = file_path
        .to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())?
        .to_string();
    
    Ok(SavedImage {
        path: absolute_path,
        filename,
    })
}

#[tauri::command]
pub async fn cleanup_temp_images(app: AppHandle) -> Result<u32, String> {
    let temp_dir = app
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get temp directory: {}", e))?;
    
    let claudia_temp = temp_dir.join("claudia_images");
    
    if !claudia_temp.exists() {
        return Ok(0);
    }
    
    let mut count = 0;
    
    // Read directory and clean up old files (older than 24 hours)
    if let Ok(entries) = fs::read_dir(&claudia_temp) {
        let now = std::time::SystemTime::now();
        let one_day = std::time::Duration::from_secs(24 * 60 * 60);
        
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if let Ok(age) = now.duration_since(modified) {
                        if age > one_day {
                            if fs::remove_file(entry.path()).is_ok() {
                                count += 1;
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(count)
}