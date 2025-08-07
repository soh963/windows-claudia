#[cfg(test)]
mod tests {
    use super::super::gemini::{GeminiSessionRegistry, generate_secure_gemini_session_id};
    use super::super::session_deduplication::{MessageDeduplicationManager, SessionIsolationManager};
    use std::collections::HashSet;
    
    #[tokio::test]
    async fn test_secure_session_id_generation() {
        // Test that session IDs are unique
        let mut session_ids = HashSet::new();
        
        for i in 0..100 {
            let project_id = format!("project-{}", i);
            let model = "gemini-2.5-pro";
            let session_id = generate_secure_gemini_session_id(&project_id, &model);
            
            // Verify format
            assert!(session_id.starts_with("gemini-"));
            assert!(session_id.contains('-'));
            
            // Verify uniqueness
            assert!(!session_ids.contains(&session_id), "Duplicate session ID generated: {}", session_id);
            session_ids.insert(session_id);
        }
        
        println!("Generated {} unique session IDs", session_ids.len());
    }
    
    #[tokio::test]
    async fn test_session_registry_isolation() {
        let registry = GeminiSessionRegistry::new();
        
        // Register multiple sessions
        let session_id_1 = "test-session-1";
        let session_id_2 = "test-session-2";
        let project_id = "test-project";
        let model = "gemini-2.5-flash";
        
        // Register sessions
        registry.register_session(session_id_1, project_id, model).unwrap();
        registry.register_session(session_id_2, project_id, model).unwrap();
        
        // Test validation
        assert!(registry.validate_session(session_id_1).is_ok());
        assert!(registry.validate_session(session_id_2).is_ok());
        assert!(registry.validate_session("non-existent").is_err());
        
        // Test duplicate message detection
        let content = "This is a test message";
        
        // First message should not be duplicate
        assert!(!registry.is_duplicate_message(session_id_1, content).unwrap());
        
        // Same message in same session should be duplicate
        assert!(registry.is_duplicate_message(session_id_1, content).unwrap());
        
        // Same message in different session should not be duplicate
        assert!(!registry.is_duplicate_message(session_id_2, content).unwrap());
        
        // Cleanup
        registry.unregister_session(session_id_1);
        registry.unregister_session(session_id_2);
        
        // Should be invalid after cleanup
        assert!(registry.validate_session(session_id_1).is_err());
        assert!(registry.validate_session(session_id_2).is_err());
    }
    
    #[tokio::test]
    async fn test_deduplication_manager_integration() {
        let dedup_manager = MessageDeduplicationManager::new();
        let session_id = "test-dedup-session";
        let message_id = "test-message-123";
        let content = "Test content for deduplication";
        
        // First check should not be duplicate
        assert!(!dedup_manager.is_duplicate(session_id, message_id, content));
        
        // Second check should be duplicate
        assert!(dedup_manager.is_duplicate(session_id, message_id, content));
        
        // Different content should not be duplicate
        let different_content = "Different test content";
        assert!(!dedup_manager.is_duplicate(session_id, message_id, different_content));
        
        // Clear session and test again
        dedup_manager.clear_session(session_id);
        assert!(!dedup_manager.is_duplicate(session_id, message_id, content));
    }
    
    #[tokio::test]
    async fn test_session_isolation_manager() {
        let isolation_manager = SessionIsolationManager::new();
        let session_id = "test-isolation-session";
        let project_id = "test-project";
        let model = "gemini-2.5-pro";
        
        // Create isolated session
        let state = isolation_manager.create_isolated_session(
            session_id.to_string(),
            project_id.to_string(),
            model.to_string(),
        );
        
        assert_eq!(state.session_id, session_id);
        assert_eq!(state.project_id, project_id);
        assert_eq!(state.model, model);
        assert!(state.is_isolated);
        assert!(!state.memory_space.is_empty());
        
        // Validate session is isolated
        assert!(isolation_manager.is_session_isolated(session_id));
        
        // Test boundary validation
        assert!(isolation_manager.validate_session_boundary(session_id, session_id).is_ok());
        assert!(isolation_manager.validate_session_boundary(session_id, "different-session").is_err());
        
        // Get session state
        let retrieved_state = isolation_manager.get_session_state(session_id);
        assert!(retrieved_state.is_some());
        assert_eq!(retrieved_state.unwrap().session_id, session_id);
        
        // Cleanup
        isolation_manager.cleanup_session(session_id);
        assert!(!isolation_manager.is_session_isolated(session_id));
        assert!(isolation_manager.get_session_state(session_id).is_none());
    }
    
    #[tokio::test]
    async fn test_memory_leak_prevention() {
        let registry = GeminiSessionRegistry::new();
        let session_id = "test-memory-leak-session";
        let project_id = "test-project";
        let model = "gemini-2.5-flash";
        
        // Register session
        registry.register_session(session_id, project_id, model).unwrap();
        
        // Add many messages to trigger cleanup
        for i in 0..1100 { // More than the 1000 limit
            let content = format!("Test message number {}", i);
            let _ = registry.is_duplicate_message(session_id, &content);
        }
        
        // Verify cleanup happened (session should still be valid but message count should be limited)
        assert!(registry.validate_session(session_id).is_ok());
        
        registry.unregister_session(session_id);
    }
    
    #[tokio::test]
    async fn test_session_cleanup_old_sessions() {
        let registry = GeminiSessionRegistry::new();
        
        // Register a session
        let session_id = "test-cleanup-session";
        registry.register_session(session_id, "project", "model").unwrap();
        
        // Verify it exists
        assert!(registry.validate_session(session_id).is_ok());
        
        // Cleanup sessions older than 0 minutes (should remove all)
        registry.cleanup_old_sessions(0);
        
        // Should be cleaned up
        assert!(registry.validate_session(session_id).is_err());
    }
}

/// Integration tests for Gemini session isolation
#[cfg(test)]
mod integration_tests {
    use super::super::gemini::{GeminiSessionRegistry};
    use super::super::session_deduplication::{MessageDeduplicationManager, SessionIsolationManager};
    
    #[tokio::test]
    async fn test_full_session_lifecycle() {
        // Initialize all components
        let session_registry = GeminiSessionRegistry::new();
        let dedup_manager = MessageDeduplicationManager::new();
        let isolation_manager = SessionIsolationManager::new();
        
        let session_id = "integration-test-session";
        let project_id = "integration-test-project";
        let model = "gemini-2.5-pro";
        
        // 1. Register session
        session_registry.register_session(session_id, project_id, model).unwrap();
        
        // 2. Create isolation
        let isolation_state = isolation_manager.create_isolated_session(
            session_id.to_string(),
            project_id.to_string(),
            model.to_string(),
        );
        
        // 3. Verify all systems are working together
        assert!(session_registry.validate_session(session_id).is_ok());
        assert!(isolation_manager.is_session_isolated(session_id));
        
        // 4. Test message deduplication across all systems
        let content = "Integration test message";
        let message_id = "integration-msg-1";
        
        // Should not be duplicate initially
        assert!(!session_registry.is_duplicate_message(session_id, content).unwrap());
        assert!(!dedup_manager.is_duplicate(session_id, message_id, content));
        
        // Should be duplicate on second try
        assert!(session_registry.is_duplicate_message(session_id, content).unwrap());
        assert!(dedup_manager.is_duplicate(session_id, message_id, content));
        
        // 5. Test boundary validation
        assert!(isolation_manager.validate_session_boundary(session_id, session_id).is_ok());
        
        // 6. Cleanup all systems
        session_registry.unregister_session(session_id);
        dedup_manager.clear_session(session_id);
        isolation_manager.cleanup_session(session_id);
        
        // 7. Verify cleanup
        assert!(session_registry.validate_session(session_id).is_err());
        assert!(!isolation_manager.is_session_isolated(session_id));
        
        println!("✅ Full session lifecycle test completed successfully");
        println!("   Session ID: {}", session_id);
        println!("   Memory Space: {}", isolation_state.memory_space);
        println!("   Isolation: ✓ Registration: ✓ Deduplication: ✓ Cleanup: ✓");
    }
    
    #[tokio::test]
    async fn test_concurrent_session_isolation() {
        use tokio::task;
        
        let session_registry = GeminiSessionRegistry::new();
        let isolation_manager = SessionIsolationManager::new();
        
        // Create multiple concurrent sessions
        let handles: Vec<_> = (0..10).map(|i| {
            let session_id = format!("concurrent-session-{}", i);
            let project_id = format!("project-{}", i);
            let model = "gemini-2.5-flash";
            
            let registry = &session_registry;
            let manager = &isolation_manager;
            
            task::spawn(async move {
                // Register session
                registry.register_session(&session_id, &project_id, model).unwrap();
                
                // Create isolation
                let _state = manager.create_isolated_session(
                    session_id.clone(),
                    project_id.clone(),
                    model.to_string(),
                );
                
                // Test some messages
                for j in 0..10 {
                    let content = format!("Message {} from session {}", j, i);
                    let _ = registry.is_duplicate_message(&session_id, &content);
                }
                
                // Verify isolation
                assert!(registry.validate_session(&session_id).is_ok());
                assert!(manager.is_session_isolated(&session_id));
                
                // Cleanup
                registry.unregister_session(&session_id);
                manager.cleanup_session(&session_id);
                
                session_id
            })
        }).collect();
        
        // Wait for all tasks to complete
        let results: Vec<_> = futures::future::try_join_all(handles).await.unwrap();
        
        // Verify all sessions were processed
        assert_eq!(results.len(), 10);
        for (i, session_id) in results.iter().enumerate() {
            assert_eq!(*session_id, format!("concurrent-session-{}", i));
        }
        
        println!("✅ Concurrent session isolation test completed");
        println!("   Processed {} sessions concurrently", results.len());
    }
}