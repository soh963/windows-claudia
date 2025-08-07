#[cfg(test)]
mod tests {
    use super::super::*;
    use std::collections::HashMap;
    
    #[tokio::test]
    async fn test_import_error_agent() {
        let agent = agents::ImportErrorAgent::new();
        
        let mut context = HashMap::new();
        context.insert("error_message".to_string(), "Cannot find module '@tauri-apps/api'".to_string());
        
        assert!(agent.can_handle("IMPORT_ERROR", &context).await);
        
        // Test non-matching error
        context.insert("error_message".to_string(), "Database locked".to_string());
        assert!(!agent.can_handle("DB_ERROR", &context).await);
    }
    
    #[tokio::test]
    async fn test_pattern_matching() {
        let engine = patterns::PatternEngine::new();
        
        let mut context = HashMap::new();
        context.insert("session_id".to_string(), "test-123".to_string());
        
        let matches = engine.match_error(
            "Session contamination detected: duplicate response from session",
            &context,
            None
        );
        
        assert!(!matches.is_empty());
        assert_eq!(matches[0].pattern_id, "session_contamination");
        assert!(matches[0].confidence > 0.7);
    }
    
    #[tokio::test]
    async fn test_retry_config() {
        let config = strategies::RetryConfig::default();
        
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.initial_delay_ms, 1000);
        assert_eq!(config.backoff_multiplier, 2.0);
        assert!(config.jitter);
    }
    
    #[tokio::test]
    async fn test_error_pattern_categories() {
        let engine = patterns::PatternEngine::new();
        
        // Test API key error
        let matches = engine.match_error(
            "Error: Invalid API key - 401 Unauthorized",
            &HashMap::new(),
            None
        );
        
        assert!(!matches.is_empty());
        let api_match = matches.iter().find(|m| m.pattern_id == "api_key_invalid");
        assert!(api_match.is_some());
        assert_eq!(api_match.unwrap().category, "Authentication");
        
        // Test database error
        let matches = engine.match_error(
            "SQLITE_BUSY: database locked",
            &HashMap::new(),
            None
        );
        
        assert!(!matches.is_empty());
        let db_match = matches.iter().find(|m| m.pattern_id == "database_locked");
        assert!(db_match.is_some());
        assert_eq!(db_match.unwrap().category, "Database");
    }
    
    #[tokio::test]
    async fn test_resolution_strategies() {
        let strategies = strategies::get_default_strategies();
        
        assert!(strategies.contains_key("session_recovery"));
        assert!(strategies.contains_key("api_retry"));
        
        let session_strategy = strategies.get("session_recovery").unwrap();
        assert_eq!(session_strategy.name, "Session Recovery Strategy");
        assert!(!session_strategy.steps.is_empty());
    }
}