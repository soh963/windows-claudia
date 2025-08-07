#!/usr/bin/env python3

import re

def fix_cross_model_memory_borrowing():
    file_path = r"D:\claudia\src-tauri\src\commands\cross_model_memory.rs"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the borrowing issue in search_memories function
    old_code = '''    let sql = if let Some(sid) = session_id {
        format!(
            "SELECT id, session_id, model, memory_type, priority, content, metadata,
             token_count, relevance_score, created_at, accessed_at, access_count
             FROM cross_model_memory
             WHERE session_id = ? AND content LIKE ?
             ORDER BY relevance_score DESC
             LIMIT {}",
            limit
        )
    } else {
        format!(
            "SELECT id, session_id, model, memory_type, priority, content, metadata,
             token_count, relevance_score, created_at, accessed_at, access_count
             FROM cross_model_memory
             WHERE content LIKE ?
             ORDER BY relevance_score DESC
             LIMIT {}",
            limit
        )
    };
    
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let search_pattern = format!("%{}%", query);
    let params: Vec<&dyn rusqlite::ToSql> = if session_id.is_some() {
        vec![&session_id.as_ref().unwrap() as &dyn rusqlite::ToSql, &search_pattern]
    } else {
        vec![&search_pattern]
    };'''
    
    new_code = '''    let search_pattern = format!("%{}%", query);
    
    let (sql, params): (String, Vec<&dyn rusqlite::ToSql>) = if let Some(ref sid) = session_id {
        (format!(
            "SELECT id, session_id, model, memory_type, priority, content, metadata,
             token_count, relevance_score, created_at, accessed_at, access_count
             FROM cross_model_memory
             WHERE session_id = ? AND content LIKE ?
             ORDER BY relevance_score DESC
             LIMIT {}",
            limit
        ), vec![sid as &dyn rusqlite::ToSql, &search_pattern as &dyn rusqlite::ToSql])
    } else {
        (format!(
            "SELECT id, session_id, model, memory_type, priority, content, metadata,
             token_count, relevance_score, created_at, accessed_at, access_count
             FROM cross_model_memory
             WHERE content LIKE ?
             ORDER BY relevance_score DESC
             LIMIT {}",
            limit
        ), vec![&search_pattern as &dyn rusqlite::ToSql])
    };
    
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Failed to prepare statement: {}", e))?;'''
    
    content = content.replace(old_code, new_code)
    
    # Also fix unused variable warnings by prefixing with underscore
    content = content.replace("target_model: String,", "_target_model: String,")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed cross_model_memory.rs borrowing and lifetime issues")

if __name__ == "__main__":
    fix_cross_model_memory_borrowing()