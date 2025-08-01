// Test script to verify database schema and functionality
use rusqlite::{Connection, Result};
use std::env;

fn main() -> Result<()> {
    // Get the app data directory (similar to how the app does it)
    let app_data_dir = env::var("APPDATA")
        .map(|appdata| std::path::PathBuf::from(appdata).join("com.claude.claudia"))
        .or_else(|_| {
            env::var("LOCALAPPDATA")
                .map(|appdata| std::path::PathBuf::from(appdata).join("com.claude.claudia"))
        })
        .unwrap_or_else(|_| std::path::PathBuf::from("./test_data"));

    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
    let db_path = app_data_dir.join("agents.db");
    
    println!("Testing database at: {}", db_path.display());
    
    // Open the database
    let conn = Connection::open(&db_path)?;
    
    // Test 1: Check if projects table exists
    println!("\n=== Testing projects table ===");
    let result = conn.execute("SELECT COUNT(*) FROM projects", []);
    match result {
        Ok(count) => println!("✓ Projects table exists and accessible"),
        Err(e) => {
            println!("✗ Projects table error: {}", e);
            return Err(e);
        }
    }
    
    // Test 2: Check if sessions table exists
    println!("\n=== Testing sessions table ===");
    let result = conn.execute("SELECT COUNT(*) FROM sessions", []);
    match result {
        Ok(count) => println!("✓ Sessions table exists and accessible"),
        Err(e) => {
            println!("✗ Sessions table error: {}", e);
            return Err(e);
        }
    }
    
    // Test 3: Check dashboard tables
    println!("\n=== Testing dashboard tables ===");
    let dashboard_tables = vec![
        "project_health",
        "feature_registry", 
        "risk_items",
        "documentation_status",
        "ai_usage_metrics",
        "workflow_stages",
        "project_goals",
        "dashboard_config"
    ];
    
    for table in dashboard_tables {
        let result = conn.execute(&format!("SELECT COUNT(*) FROM {}", table), []);
        match result {
            Ok(_) => println!("✓ {} table exists", table),
            Err(e) => println!("✗ {} table error: {}", table, e),
        }
    }
    
    // Test 4: Test project insertion and retrieval
    println!("\n=== Testing project operations ===");
    
    // Insert a test project
    let current_dir = env::current_dir().unwrap();
    let project_path = current_dir.to_string_lossy();
    
    let result = conn.execute(
        "INSERT OR IGNORE INTO projects (id, path, name, description, project_type, status, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)",
        [
            "test-project",
            &project_path,
            "Test Project",
            "A test project for database validation",
            "test",
            "active"
        ],
    );
    
    match result {
        Ok(rows) => {
            if rows > 0 {
                println!("✓ Successfully inserted test project");
            } else {
                println!("✓ Test project already exists");
            }
        },
        Err(e) => {
            println!("✗ Failed to insert test project: {}", e);
            return Err(e);
        }
    }
    
    // Query the test project
    let mut stmt = conn.prepare("SELECT id, path, name, description FROM projects WHERE id = 'test-project'")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    })?;
    
    for row in rows {
        let (id, path, name, description) = row?;
        println!("✓ Retrieved project: {} - {} at {}", id, name.unwrap_or("No name".to_string()), path);
        println!("  Description: {}", description.unwrap_or("No description".to_string()));
    }
    
    // Test 5: Dashboard functionality
    println!("\n=== Testing dashboard operations ===");
    
    // Insert test dashboard config
    let result = conn.execute(
        "INSERT OR IGNORE INTO dashboard_config (project_id, config_version, enabled_widgets) 
         VALUES ('test-project', '1.0', '[\"health_metrics\", \"feature_status\"]')",
        [],
    );
    
    match result {
        Ok(_) => println!("✓ Dashboard config operations working"),
        Err(e) => println!("✗ Dashboard config error: {}", e),
    }
    
    println!("\n=== Database test completed successfully! ===");
    Ok(())
}