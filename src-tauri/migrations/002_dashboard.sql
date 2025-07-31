-- Dashboard Database Schema Migration
-- Version: 002
-- Purpose: Create tables for Claudia Dashboard functionality
-- Author: Master Orchestrator
-- Date: 2025-07-31

-- Project Health Metrics Table
CREATE TABLE IF NOT EXISTS project_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK(metric_type IN ('security', 'dependencies', 'complexity', 'scalability', 'error_rate')),
    value REAL NOT NULL CHECK(value >= 0 AND value <= 100),
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    details TEXT,
    trend TEXT CHECK(trend IN ('improving', 'stable', 'declining')),
    UNIQUE(project_id, metric_type, timestamp)
);

-- Feature Registry Table
CREATE TABLE IF NOT EXISTS feature_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK(status IN ('completed', 'in_progress', 'planned', 'available', 'unavailable')),
    independence_score REAL CHECK(independence_score >= 0 AND independence_score <= 100),
    dependencies TEXT, -- JSON array of feature IDs
    file_paths TEXT, -- JSON array of relevant file paths
    complexity_score REAL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(project_id, name)
);

-- Risk Assessment Table
CREATE TABLE IF NOT EXISTS risk_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('security', 'feature', 'performance', 'dependency', 'technical_debt')),
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    mitigation TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'mitigated', 'accepted', 'resolved')),
    impact_score REAL CHECK(impact_score >= 1 AND impact_score <= 10),
    probability REAL CHECK(probability >= 0 AND probability <= 1),
    detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    resolved_at INTEGER,
    file_paths TEXT -- JSON array of affected files
);

-- Documentation Status Table
CREATE TABLE IF NOT EXISTS documentation_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    doc_type TEXT NOT NULL CHECK(doc_type IN ('prd', 'tasks', 'tech_stack', 'workflows', 'usage_guides', 'reports')),
    completion_percentage REAL CHECK(completion_percentage >= 0 AND completion_percentage <= 100),
    total_sections INTEGER DEFAULT 0,
    completed_sections INTEGER DEFAULT 0,
    missing_sections TEXT, -- JSON array
    file_paths TEXT, -- JSON array of relevant file paths
    last_updated INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    quality_score REAL,
    UNIQUE(project_id, doc_type)
);

-- AI Usage Metrics Table
CREATE TABLE IF NOT EXISTS ai_usage_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    agent_type TEXT,
    mcp_server TEXT,
    token_count INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_rate REAL,
    avg_response_time INTEGER, -- milliseconds
    total_cost REAL DEFAULT 0.0,
    session_date TEXT NOT NULL, -- YYYY-MM-DD format
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(project_id, model_name, agent_type, mcp_server, session_date)
);

-- Workflow Stages Table
CREATE TABLE IF NOT EXISTS workflow_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    stage_order INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('completed', 'active', 'pending', 'skipped')),
    start_date INTEGER,
    end_date INTEGER,
    duration_days INTEGER,
    efficiency_score REAL,
    bottlenecks TEXT, -- JSON array of identified bottlenecks
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(project_id, stage_name)
);

-- Project Goals and Completion Table
CREATE TABLE IF NOT EXISTS project_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL UNIQUE,
    primary_goal TEXT,
    secondary_goals TEXT, -- JSON array
    overall_completion REAL DEFAULT 0.0 CHECK(overall_completion >= 0 AND overall_completion <= 100),
    features_completion REAL DEFAULT 0.0,
    documentation_completion REAL DEFAULT 0.0,
    tests_completion REAL DEFAULT 0.0,
    deployment_readiness REAL DEFAULT 0.0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Dashboard Configuration Table
CREATE TABLE IF NOT EXISTS dashboard_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL UNIQUE,
    config_version TEXT DEFAULT '1.0',
    refresh_interval INTEGER DEFAULT 300, -- seconds
    cache_duration INTEGER DEFAULT 1800, -- seconds
    enabled_widgets TEXT, -- JSON array of enabled widget names
    custom_metrics TEXT, -- JSON object of custom metric definitions
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Performance Indexes for Query Optimization
CREATE INDEX IF NOT EXISTS idx_health_project_timestamp ON project_health(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_metric_type ON project_health(project_id, metric_type);

CREATE INDEX IF NOT EXISTS idx_features_project_status ON feature_registry(project_id, status);
CREATE INDEX IF NOT EXISTS idx_features_independence ON feature_registry(project_id, independence_score DESC);

CREATE INDEX IF NOT EXISTS idx_risks_project_severity ON risk_items(project_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_risks_category ON risk_items(project_id, category);

CREATE INDEX IF NOT EXISTS idx_ai_usage_project_model ON ai_usage_metrics(project_id, model_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_metrics(project_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_project_order ON workflow_stages(project_id, stage_order);

-- Triggers for Automatic Timestamp Updates
CREATE TRIGGER IF NOT EXISTS update_feature_timestamp 
    AFTER UPDATE ON feature_registry
BEGIN
    UPDATE feature_registry SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_goals_timestamp 
    AFTER UPDATE ON project_goals
BEGIN
    UPDATE project_goals SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
    AFTER UPDATE ON dashboard_config
BEGIN
    UPDATE dashboard_config SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Insert default dashboard configuration for Claudia project
INSERT OR IGNORE INTO dashboard_config (
    project_id,
    config_version,
    refresh_interval,
    cache_duration,
    enabled_widgets,
    custom_metrics
) VALUES (
    'claudia-main',
    '1.0',
    300,
    1800,
    '["health_metrics", "feature_status", "documentation", "ai_usage", "risks", "workflow"]',
    '{}'
);

-- Insert default project goals for Claudia
INSERT OR IGNORE INTO project_goals (
    project_id,
    primary_goal,
    secondary_goals
) VALUES (
    'claudia-main',
    'Windows-optimized Claude Code UI with multi-agent orchestration',
    '["Agent system integration", "MCP server management", "Session handling", "File operations", "Cross-platform compatibility"]'
);