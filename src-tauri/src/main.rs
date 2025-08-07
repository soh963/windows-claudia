// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod checkpoint;
mod claude_binary;
mod commands;
mod analysis;
mod process;
mod sidecar_wrapper;
mod windows_command;
mod runtime_utils;

use checkpoint::state::CheckpointState;
use commands::execution_control::{
    ExecutionControlState, stop_execution, continue_execution, reset_execution,
    get_execution_status, update_execution_metrics,
};
use commands::agents::{
    cleanup_finished_processes, create_agent, delete_agent, export_agent,
    export_agent_to_file, fetch_github_agent_content, fetch_github_agents, get_agent,
    get_agent_run, get_agent_run_with_real_time_metrics, get_claude_binary_path,
    get_live_session_output, get_session_output, get_session_status, import_agent,
    import_agent_from_file, import_agent_from_github, init_database, kill_agent_session,
    list_agent_runs, list_agent_runs_with_metrics, list_agents, list_claude_installations,
    list_running_sessions, load_agent_session_history, set_claude_binary_path, stream_session_output, update_agent, AgentDb,
};
use commands::claude::{
    cancel_claude_execution, check_auto_checkpoint, check_claude_auth, check_claude_version, cleanup_old_checkpoints,
    clear_checkpoint_manager, continue_claude_code, create_checkpoint, execute_claude_code,
    find_claude_md_files, fork_from_checkpoint, get_checkpoint_diff, get_checkpoint_settings,
    get_checkpoint_state_stats, get_claude_session_output, get_claude_settings, get_project_sessions,
    get_recently_modified_files, get_session_timeline, get_system_prompt, list_checkpoints,
    list_directory_contents, list_projects, list_running_claude_sessions, load_session_history,
    open_new_session, read_claude_md_file, restore_checkpoint, resume_claude_code,
    save_claude_md_file, save_claude_settings, save_system_prompt, search_files,
    validate_session_exists, recover_session, load_session_history_claude_enhanced,
    track_checkpoint_message, track_session_messages, update_checkpoint_settings,
    get_hooks_config, update_hooks_config, validate_hook_command,
    ClaudeProcessState,
};
use commands::mcp::{
    mcp_add, mcp_add_from_claude_desktop, mcp_add_json, mcp_get, mcp_get_server_status, mcp_list,
    mcp_read_project_config, mcp_remove, mcp_reset_project_choices, mcp_save_project_config,
    mcp_serve, mcp_test_connection, mcp_update, mcp_export_json, mcp_export_all_json,
};
use commands::gemini::{
    has_gemini_api_key, set_gemini_api_key, verify_gemini_api_key, execute_gemini_code,
    get_gemini_api_key_command, test_gemini_events,
};
use commands::gemini_chat::{
    send_gemini_chat_message,
};
use commands::gemini_enhanced::{
    execute_gemini_code_enhanced,
};
use commands::gemini_models::{
    get_gemini_model_info, list_gemini_models, recommend_gemini_model, validate_gemini_model,
};
use commands::gemini_processor::{
    process_gemini_request,
};
use commands::gemini_performance::{
    get_gemini_performance_metrics, get_gemini_cache_stats,
};
use commands::gemini_resilience::{
    get_gemini_health_status,
};
use commands::gemini_monitoring::{
    get_gemini_monitoring_metrics, get_gemini_analytics,
};
use commands::gemini_backend::{
    execute_gemini_enhanced, get_gemini_backend_config, update_gemini_backend_config,
    get_gemini_backend_status,
};
use commands::gemini_universal::{
    discover_gemini_models, validate_gemini_model_universal, execute_gemini_universal,
    get_gemini_fallback_chain,
};
use commands::gemini_test_suite::{
    test_gemini_model_comprehensive, test_all_gemini_models,
};
use commands::ollama::{
    check_ollama_status, get_ollama_models, execute_ollama_request,
    pull_ollama_model, delete_ollama_model, get_ollama_model_info,
};

use commands::usage::{
    get_session_stats, get_usage_by_date_range, get_usage_details, get_usage_stats,
};
use commands::ai_usage_tracker::{
    track_ai_usage, get_ai_usage_stats, get_session_ai_usage, estimate_ai_cost, get_ai_model_info,
};
use commands::ai_session_integrator::{
    ai_session_start, ai_session_track_message, ai_session_end, ai_session_get_active, ai_session_cleanup_expired,
};
// Temporarily disabled due to compilation issues
// use commands::auto_model_selection::{
//     get_auto_model_recommendation, analyze_task_requirements, update_latest_models_on_startup,
//     get_latest_models,
// };
use commands::ai_benchmark_system::{
    collect_ai_model_benchmarks, update_benchmarks_from_web, intelligent_model_selection,
    save_benchmark_data, get_latest_benchmark_data,
};
use commands::storage::{
    storage_list_tables, storage_read_table, storage_update_row, storage_delete_row,
    storage_insert_row, storage_execute_sql, storage_reset_database,
};
use commands::proxy::{get_proxy_settings, save_proxy_settings, apply_proxy_settings};
use commands::session_manager::{load_session_history_enhanced, delete_session, create_secure_session, add_secure_message};
use commands::error_tracker::{record_error, get_error, list_errors, resolve_error, get_error_stats};
use commands::debug_system::{
    log_debug_entry, start_operation_trace, add_trace_step, complete_operation_trace,
    record_performance_metrics, get_debug_logs, get_operation_traces, get_performance_metrics,
    set_debug_level, cleanup_old_debug_entries
};
use commands::universal_mcp::{
    get_universal_mcp_config, save_universal_mcp_config, execute_with_universal_mcp,
    get_supported_mcp_servers, test_universal_mcp_integration
};
use commands::claude_sync::{
    sync_claude_commands, get_claude_sync_state, set_claude_sync_enabled,
    get_synced_claude_commands, check_claude_availability, set_claude_sync_interval,
    force_refresh_claude_commands, get_next_sync_time, start_auto_sync, GlobalSyncState,
};
use commands::session_deduplication::{
    check_message_duplicate, clear_session_deduplication, create_isolated_session,
    validate_session_boundary, get_session_isolation_state, cleanup_old_sessions,
    MessageDeduplicationManager, SessionIsolationManager,
};
use commands::universal_model_executor::{
    execute_with_universal_tools, get_universal_model_capabilities, 
    test_universal_model_execution, get_realtime_model_performance,
};
use commands::simple_model_validator::{
    validate_all_models, test_specific_model, test_auto_selection, system_health_check,
};
use process::ProcessRegistryState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    // Initialize cross-mode runtime environment
    runtime_utils::setup_environment();
    runtime_utils::setup_logging();


    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize agents database
            let conn = init_database(&app.handle()).expect("Failed to initialize agents database");
            
            // Store the connection in the AgentDb state
            let db_state = commands::agents::AgentDb(Mutex::new(conn));
            app.manage(db_state);
            
            // Load and apply proxy settings from the database
            {
                let db = app.state::<AgentDb>();
                let proxy_settings = match db.0.lock() {
                    Ok(conn) => {
                        // Directly query proxy settings from the database
                        let mut settings = commands::proxy::ProxySettings::default();
                        
                        let keys = vec![
                            ("proxy_enabled", "enabled"),
                            ("proxy_http", "http_proxy"),
                            ("proxy_https", "https_proxy"),
                            ("proxy_no", "no_proxy"),
                            ("proxy_all", "all_proxy"),
                        ];
                        
                        for (db_key, field) in keys {
                            if let Ok(value) = conn.query_row(
                                "SELECT value FROM app_settings WHERE key = ?1",
                                rusqlite::params![db_key],
                                |row| row.get::<_, String>(0),
                            ) {
                                match field {
                                    "enabled" => settings.enabled = value == "true",
                                    "http_proxy" => settings.http_proxy = Some(value).filter(|s| !s.is_empty()),
                                    "https_proxy" => settings.https_proxy = Some(value).filter(|s| !s.is_empty()),
                                    "no_proxy" => settings.no_proxy = Some(value).filter(|s| !s.is_empty()),
                                    "all_proxy" => settings.all_proxy = Some(value).filter(|s| !s.is_empty()),
                                    _ => {}
                                }
                            }
                        }
                        
                        log::info!("Loaded proxy settings: enabled={}", settings.enabled);
                        settings
                    }
                    Err(e) => {
                        log::warn!("Failed to lock database for proxy settings: {}", e);
                        commands::proxy::ProxySettings::default()
                    }
                };
                
                // Apply the proxy settings
                apply_proxy_settings(&proxy_settings);
            }
            
            // Re-open the connection for the app to manage
            let conn = init_database(&app.handle()).expect("Failed to initialize agents database");
            app.manage(AgentDb(Mutex::new(conn)));

            // Initialize error tracking tables
            let db_for_errors = app.state::<AgentDb>();
            if let Err(e) = tauri::async_runtime::block_on(commands::error_tracker::init_error_tables(&db_for_errors)) {
                log::warn!("Failed to initialize error tracking tables: {}", e);
            } else {
                log::info!("Error tracking system initialized");
            }

            // Initialize debug system tables
            if let Err(e) = tauri::async_runtime::block_on(commands::debug_system::init_debug_tables(&db_for_errors)) {
                log::warn!("Failed to initialize debug system tables: {}", e);
            } else {
                log::info!("Debug system initialized");
            }

            // Initialize universal MCP tables
            if let Err(e) = tauri::async_runtime::block_on(commands::universal_mcp::init_universal_mcp_tables(&db_for_errors)) {
                log::warn!("Failed to initialize universal MCP tables: {}", e);
            } else {
                log::info!("Universal MCP system initialized");
            }

            // Update latest models on startup (spawn async task)
            let db_handle = app.handle().clone();
            std::thread::spawn(move || {
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    let db_for_models = db_handle.state::<AgentDb>();
                    // TODO: Re-enable when auto_model_selection is fixed
                    // Update latest models on startup
                    // if let Err(e) = update_latest_models_on_startup(db_for_models.clone()).await {
                    //     log::warn!("Failed to update latest models on startup: {}", e);
                    // } else {
                    //     log::info!("Successfully updated latest models on startup");
                    // }
                    
                    // Initialize and save benchmark data on startup
                    if let Err(e) = save_benchmark_data(db_for_models.clone()).await {
                        log::warn!("Failed to save benchmark data on startup: {}", e);
                    } else {
                        log::info!("Successfully initialized benchmark data on startup");
                    }
                });
            });

            // Initialize checkpoint state
            let checkpoint_state = CheckpointState::new();

            // Set the Claude directory path
            if let Ok(claude_dir) = dirs::home_dir()
                .ok_or_else(|| "Could not find home directory")
                .and_then(|home| {
                    let claude_path = home.join(".claude");
                    claude_path
                        .canonicalize()
                        .map_err(|_| "Could not find ~/.claude directory")
                })
            {
                let state_clone = checkpoint_state.clone();
                tauri::async_runtime::spawn(async move {
                    state_clone.set_claude_dir(claude_dir).await;
                });
            }

            app.manage(checkpoint_state);

            // Initialize process registry
            app.manage(ProcessRegistryState::default());

            // Initialize Claude process state
            app.manage(ClaudeProcessState::default());
            // Initialize Execution Control state
            app.manage(ExecutionControlState::default());

            // Initialize Claude sync state
            let sync_state = GlobalSyncState::default();
            let sync_state_clone = sync_state.clone();
            app.manage(sync_state);
            
            // Initialize session deduplication and isolation managers
            app.manage(MessageDeduplicationManager::new());
            app.manage(SessionIsolationManager::new());

            // Start automatic Claude sync background task after setup is complete
            let app_handle = app.handle().clone();
            let sync_state_arc = std::sync::Arc::new(sync_state_clone);
            
            // Spawn the background task in a separate thread to avoid borrow issues
            std::thread::spawn(move || {
                tauri::async_runtime::spawn(async move {
                    // Wait a bit for the app to be fully initialized
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    start_auto_sync(app_handle, sync_state_arc).await;
                });
            });

            // Start daily knowledge base update task
            let db_path = app.path().app_data_dir().unwrap().join("claudia.sqlite");
            let db_path_str = db_path.to_str().unwrap().to_string();
            let db_path_arc = std::sync::Arc::new(db_path_str);

            // TODO: Re-enable when model_knowledge_base compilation is fixed
            // tauri::async_runtime::spawn(async move {
            //     commands::model_knowledge_base::daily_knowledge_update_task(db_path_arc).await;
            // });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Claude & Project Management
            list_projects,
            get_project_sessions,
            get_claude_settings,
            open_new_session,
            get_system_prompt,
            check_claude_version,
            check_claude_auth,
            save_system_prompt,
            save_claude_settings,
            find_claude_md_files,
            read_claude_md_file,
            save_claude_md_file,
            load_session_history,
            load_session_history_enhanced,
            load_session_history_claude_enhanced,
            validate_session_exists,
            recover_session,
            delete_session,
            create_secure_session,
            add_secure_message,
            
            // Error Knowledge Base
            record_error,
            get_error,
            list_errors,
            resolve_error,
            get_error_stats,
            
            // Debug System & Tracing
            log_debug_entry,
            start_operation_trace,
            add_trace_step,
            complete_operation_trace,
            record_performance_metrics,
            get_debug_logs,
            get_operation_traces,
            get_performance_metrics,
            set_debug_level,
            cleanup_old_debug_entries,
            
            // Universal MCP Integration
            get_universal_mcp_config,
            save_universal_mcp_config,
            execute_with_universal_mcp,
            get_supported_mcp_servers,
            test_universal_mcp_integration,
            
            execute_claude_code,
            continue_claude_code,
            resume_claude_code,
            cancel_claude_execution,
            list_running_claude_sessions,
            get_claude_session_output,
            list_directory_contents,
            search_files,
            get_recently_modified_files,
            get_hooks_config,
            update_hooks_config,
            validate_hook_command,
            
            // Gemini Integration
            has_gemini_api_key,
            set_gemini_api_key,
            verify_gemini_api_key,
            execute_gemini_code,
            get_gemini_api_key_command,
            test_gemini_events,
            
            // Enhanced Gemini Features
            execute_gemini_code_enhanced,
            execute_gemini_enhanced,
            
            // Gemini Model Management
            get_gemini_model_info,
            list_gemini_models,
            recommend_gemini_model,
            validate_gemini_model,
            
            // Gemini Processing
            process_gemini_request,
            send_gemini_chat_message,
            
            // Gemini Performance
            get_gemini_performance_metrics,
            get_gemini_cache_stats,
            
            // Gemini Resilience
            get_gemini_health_status,
            
            // Gemini Monitoring
            get_gemini_monitoring_metrics,
            get_gemini_analytics,
            
            // Gemini Backend
            get_gemini_backend_config,
            update_gemini_backend_config,
            get_gemini_backend_status,
            
            // Gemini Universal Compatibility
            discover_gemini_models,
            validate_gemini_model_universal,
            execute_gemini_universal,
            get_gemini_fallback_chain,
            test_gemini_model_comprehensive,
            test_all_gemini_models,
            
            // Ollama Integration
            check_ollama_status,
            get_ollama_models,
            execute_ollama_request,
            pull_ollama_model,
            delete_ollama_model,
            get_ollama_model_info,
            
            // Checkpoint Management
            create_checkpoint,
            restore_checkpoint,
            list_checkpoints,
            fork_from_checkpoint,
            get_session_timeline,
            update_checkpoint_settings,
            get_checkpoint_diff,
            track_checkpoint_message,
            track_session_messages,
            check_auto_checkpoint,
            cleanup_old_checkpoints,
            get_checkpoint_settings,
            clear_checkpoint_manager,
            get_checkpoint_state_stats,
            
            // Agent Management
            list_agents,
            create_agent,
            update_agent,
            delete_agent,
            get_agent,
            list_agent_runs,
            get_agent_run,
            list_agent_runs_with_metrics,
            get_agent_run_with_real_time_metrics,
            list_running_sessions,
            kill_agent_session,
            get_session_status,
            cleanup_finished_processes,
            get_session_output,
            get_live_session_output,
            stream_session_output,
            load_agent_session_history,
            get_claude_binary_path,
            set_claude_binary_path,
            list_claude_installations,
            export_agent,
            export_agent_to_file,
            import_agent,
            import_agent_from_file,
            fetch_github_agents,
            fetch_github_agent_content,
            import_agent_from_github,
            
            // Usage & Analytics
            get_usage_stats,
            get_usage_by_date_range,
            get_usage_details,
            get_session_stats,
            
            // AI Usage Tracking
            track_ai_usage,
            get_ai_usage_stats,
            get_session_ai_usage,
            estimate_ai_cost,
            get_ai_model_info,
            
            // AI Session Integration
            ai_session_start,
            ai_session_track_message,
            ai_session_end,
            ai_session_get_active,
            ai_session_cleanup_expired,
            
            // Auto Model Selection - temporarily disabled
            // get_auto_model_recommendation,
            // analyze_task_requirements,
            // update_latest_models_on_startup,
            // get_latest_models,
            
            // AI Benchmark System
            collect_ai_model_benchmarks,
            update_benchmarks_from_web,
            intelligent_model_selection,
            save_benchmark_data,
            get_latest_benchmark_data,
            
            // MCP (Model Context Protocol)
            mcp_add,
            mcp_list,
            mcp_get,
            mcp_remove,
            mcp_add_json,
            mcp_add_from_claude_desktop,
            mcp_serve,
            mcp_test_connection,
            mcp_reset_project_choices,
            mcp_get_server_status,
            mcp_read_project_config,
            mcp_save_project_config,
            mcp_update,
            mcp_export_json,
            mcp_export_all_json,
            
            // Storage Management
            storage_list_tables,
            storage_read_table,
            storage_update_row,
            storage_delete_row,
            storage_insert_row,
            storage_execute_sql,
            storage_reset_database,
            
            // Slash Commands
            commands::slash_commands::slash_commands_list,
            commands::slash_commands::slash_command_get,
            commands::slash_commands::slash_command_save,
            commands::slash_commands::slash_command_delete,
            commands::slash_commands::execute_claude_slash_command,
            
            // Proxy Settings
            get_proxy_settings,
            save_proxy_settings,
            
            // Claude Sync
            sync_claude_commands,
            get_claude_sync_state,
            set_claude_sync_enabled,
            get_synced_claude_commands,
            check_claude_availability,
            set_claude_sync_interval,
            force_refresh_claude_commands,
            get_next_sync_time,
            
            // Session Deduplication & Isolation
            check_message_duplicate,
            clear_session_deduplication,
            create_isolated_session,
            validate_session_boundary,
            get_session_isolation_state,
            cleanup_old_sessions,
            
            // Intelligent Routing
            commands::intelligent_routing::analyze_chat_input,
            commands::intelligent_routing::parse_mcp_install_request,
            commands::intelligent_routing::get_intelligent_model_recommendation,
            commands::intelligent_routing::update_model_performance_metrics,
            commands::intelligent_routing::update_model_benchmarks_from_web,
            commands::intelligent_routing::get_model_analytics,
            
            // Universal Model Execution
            execute_with_universal_tools,
            get_universal_model_capabilities,
            test_universal_model_execution,
            get_realtime_model_performance,
            
            // Model Validation & Testing
            validate_all_models,
            test_specific_model,
            test_auto_selection,
            system_health_check,
            
            // Image Handler
            commands::image_handler::save_base64_image,
            commands::image_handler::cleanup_temp_images,
            
            // MCP Manager
            commands::mcp_manager::search_mcp_servers,
            commands::mcp_manager::install_mcp_server,
            commands::mcp_manager::auto_install_mcp,
            
            // Dashboard
            commands::dashboard::dashboard_get_summary,
            commands::dashboard::dashboard_update_health_metric,
            commands::dashboard::dashboard_update_feature,
            commands::dashboard::dashboard_analyze_project,
            commands::dashboard::dashboard_get_ai_analytics,
            commands::dashboard::dashboard_get_ai_cost_trends,
            commands::dashboard::dashboard_get_model_performance,
            commands::dashboard::dashboard_get_mcp_analytics,
            commands::dashboard_seed::dashboard_seed_data,
            commands::dashboard_utils::get_current_working_project,
            commands::dashboard_utils::get_recent_projects,
            commands::dashboard_utils::create_project_if_not_exists,
            
            // Execution Control
            stop_execution,
            continue_execution,
            reset_execution,
            get_execution_status,
            update_execution_metrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
