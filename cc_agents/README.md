# 🤖 Claudia CC Agents

<div align="center">
  <p>
    <strong>Pre-built AI agents for Claudia powered by Claude Code</strong>
  </p>
  <p>
    <a href="#available-agents">Browse Agents</a> •
    <a href="#importing-agents">Import Guide</a> •
    <a href="#exporting-agents">Export Guide</a> •
    <a href="#contributing">Contribute</a>
  </p>
</div>

---

## 📦 Available Agents

| Agent | Model | Description | Default Task |
|-------|-------|-------------|--------------|
| **🎯 Git Commit Bot**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Automate your Git workflow with intelligent commit messages**<br/><br/>Analyzes Git repository changes, generates detailed commit messages following Conventional Commits specification, and pushes changes to remote repository. | "Push all changes." |
| **🛡️ Security Scanner**<br/>🛡️ `shield` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Advanced AI-powered Static Application Security Testing (SAST)**<br/><br/>Performs comprehensive security audits by spawning specialized sub-agents for: codebase intelligence gathering, threat modeling (STRIDE), vulnerability scanning (OWASP Top 10, CWE), exploit validation, remediation design, and professional report generation. | "Review the codebase for security issues." |
| **🧪 Unit Tests Bot**<br/>💻 `code` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Automated comprehensive unit test generation for any codebase**<br/><br/>Analyzes codebase and generates comprehensive unit tests by: analyzing code structure, creating test plans, writing tests matching your style, verifying execution, optimizing coverage (>80% overall, 100% critical paths), and generating documentation. | "Generate unit tests for this codebase." |
| **🤖 AI/ML Coordinator**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Machine Learning Pipeline Orchestration Specialist**<br/><br/>Orchestrates AI/ML model development, training, and deployment pipelines. Coordinates model lifecycles, optimizes resources, and implements MLOps practices for robust, scalable AI/ML solutions. | "Orchestrate AI/ML model development, training, and deployment pipelines." |
| **🏛️ Architect Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **System Design and Architecture Specialist**<br/><br/>Analyzes requirements and designs overall system architecture. Defines module structures, data models, API designs, and ensures systems are scalable, maintainable, and secure. | "Analyze requirements and design the overall system architecture, including module structure, data models, and API designs." |
| **🌐 API Gateway Agent**<br/>🌐 `globe` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **API Management & Security Specialist**<br/><br/>Designs and implements robust API gateway solutions with focus on security, performance optimization, and enterprise-scale API infrastructure management. | "Design and implement robust API gateway solutions with security and performance optimization." |
| **🔄 Auto Execution Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Automated Code Execution Specialist**<br/><br/>Automates code execution, testing, and verification processes to enable continuous integration and rapid feedback loops throughout the development lifecycle. | "Automate code execution, testing, and verification processes, enabling continuous integration and rapid feedback loops." |
| **🐛 Bug Finder-Fixer**<br/>🛡️ `shield` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Bug Detection & Fixing Specialist**<br/><br/>Systematically identifies, analyzes, and fixes bugs in codebases with surgical precision through comprehensive debugging and root cause analysis. | "Find and fix bugs in the codebase" |
| **💼 Business Logic Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Core Application Logic Processor**<br/><br/>Processes core application business logic ensuring accuracy, efficiency, and strict adherence to defined business rules and requirements. | "Process core application business logic, ensuring accuracy, efficiency, and adherence to business rules." |
| **🔍 Code Analyzer**<br/>💻 `code` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Code Quality & Structure Analyst**<br/><br/>Analyzes code for quality, structure, patterns, potential issues, and helps understand how code works through comprehensive review and analysis. | "Use this agent when you need to analyze code for quality, structure, patterns, potential issues, or to understand how code works" |
| **💻 Code Generation Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **High-Quality Code Implementer**<br/><br/>Generates high-quality code based on design specifications and requirements while adhering to best practices and project conventions. | "Generate high-quality code based on design specifications and requirements, adhering to best practices and project conventions." |
| **📋 Code Review Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Quality Assurance & Code Improvement Specialist**<br/><br/>Performs comprehensive code reviews, identifies bugs, suggests improvements, and ensures adherence to coding standards and best practices. | "Perform comprehensive code reviews, identifying bugs, suggesting improvements, and ensuring adherence to coding standards and best practices." |
| **📊 Data Pipeline Coordinator**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **ETL & Streaming Data Orchestration Specialist**<br/><br/>Manages ETL and streaming data agents ensuring efficient data flow, maintaining data quality, and managing schema evolution across various data sources. | "Orchestrate ETL and streaming data pipelines, ensuring data quality and schema evolution." |
| **🗄️ Database Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Data Persistence & Optimization Specialist**<br/><br/>Manages database interactions, optimizes queries, and ensures data integrity and performance across all aspects of data persistence and retrieval. | "Manage database interactions, optimize queries, and ensure data integrity and performance." |
| **👑 Enterprise Command Center**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Supreme Strategic Coordination & Intelligence Hub**<br/><br/>Unified supreme coordinator combining strategic orchestration, project workflow management, and intelligence synthesis for enterprise-level multi-agent systems. | "Supreme strategic coordination and enterprise intelligence for multi-agent ecosystems." |
| **🔴 Error-Bug Analyzer**<br/>🔍 `search` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Elite Error & Bug Analysis Specialist**<br/><br/>Exceptional analytical capabilities for identifying and fixing code issues through comprehensive error detection and deep bug analysis. | "Analyze code for errors and bugs" |
| **🎨 Frontend Development Suite**<br/>🧩 `layers` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Comprehensive Modern Frontend Development Specialist**<br/><br/>Unified specialist combining UI component development, state management orchestration, and intelligent code generation for modern web applications. | "Comprehensive frontend development including UI components, state management, and modern code generation." |
| **💻 IDE Agent**<br/>🖥️ `terminal` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Integrated Development Environment Facilitator**<br/><br/>Acts as an integrated development environment facilitator enabling code editing, local execution, and debugging directly within the project codebase. | "Act as an integrated development environment (IDE) agent, facilitating code editing, local execution, and debugging within the project codebase." |
| **🧠 Intelligence Synthesis**<br/>🗄️ `database` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Knowledge Aggregation & Strategic Insights**<br/><br/>Central knowledge aggregator and strategic insight generator that collects, analyzes, and synthesizes information from all agents to maintain comprehensive system knowledge. | "Aggregate insights from all agents and maintain system knowledge base." |
| **🎯 Master Orchestrator**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Enterprise Multi-Agent System Command**<br/><br/>Supreme coordinator and strategic decision-maker that analyzes complex tasks, decomposes them into optimal execution strategies, and coordinates specialized agents. | "Analyze project requirements and coordinate multi-agent execution strategy." |
| **📡 Monitor Agent**<br/>🖥️ `terminal` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **System Observability & Health Monitoring Specialist**<br/><br/>Responsible for system-wide observability, health monitoring, and performance tracking with real-time insights, anomaly detection, and comprehensive monitoring coverage. | "Monitor system health, performance metrics, and provide observability across all agents." |
| **⚡ Performance Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Web Application Performance Optimization Specialist**<br/><br/>Optimizes web application performance focusing on loading speed, rendering efficiency, and overall resource utilization for fast and responsive user experience. | "Optimize web application performance, focusing on loading speed, rendering efficiency, and resource utilization." |
| **📅 Project Coordinator**<br/>🌿 `git-branch` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Workflow Management & Scheduling Specialist**<br/><br/>Responsible for project-specific workflow management, task dependency resolution, timeline tracking, and cross-team coordination within the enterprise system. | "Manage project workflows and coordinate cross-team scheduling." |
| **🔧 Resource Manager**<br/>🗄️ `database` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Infrastructure Optimization & Capacity Planning Specialist**<br/><br/>Manages infrastructure resource allocation, capacity planning, and optimization ensuring optimal resource utilization, cost efficiency, and scalability. | "Optimize infrastructure resource allocation and manage system capacity planning." |
| **🔐 State Management Agent**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **Web Application State Orchestration Specialist**<br/><br/>Orchestrates state management solutions for web applications ensuring data consistency, efficient updates, and optimal performance across UI components. | "Orchestrate state management solutions for web applications, ensuring data consistency and efficient updates." |
| **🎨 UI Component Agent**<br/>💻 `code` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Modern Component Development Specialist**<br/><br/>Specialized frontend development expert focused on creating modern, accessible, and performant UI components with emphasis on design systems and user experience. | "Generate and optimize modern UI components with accessibility and performance focus." |
| **🛠️ Use Tools**<br/>🤖 `bot` | <img src="https://img.shields.io/badge/Opus-purple?style=flat-square" alt="Opus"> | **SuperClaude Framework Tool**<br/><br/>Advanced AI development framework integrating 44 specialized agents, 20 MCP servers, 11 personas, and 26 slash commands for comprehensive development tasks. | "Leverage SuperClaude Framework with 44 specialized agents, 20 MCP servers, 11 personas, and 26 slash commands for comprehensive development tasks." |
| **🌐 Web App Coordinator**<br/>🌐 `globe` | <img src="https://img.shields.io/badge/Sonnet-blue?style=flat-square" alt="Sonnet"> | **Frontend/Backend Integration Specialist**<br/><br/>Manages web-specific agent clusters, coordinates frontend and backend development teams, and ensures seamless integration of web application components. | "Coordinate web application development teams and frontend/backend integration." |

### Available Icons

Choose from these icon options when creating agents:
- `bot` - 🤖 General purpose
- `shield` - 🛡️ Security related
- `code` - 💻 Development
- `terminal` - 🖥️ System/CLI
- `database` - 🗄️ Data operations
- `globe` - 🌐 Network/Web
- `file-text` - 📄 Documentation
- `git-branch` - 🌿 Version control

---

## 📥 Importing Agents

### Method 1: Import from GitHub (Recommended)

1. In Claudia, navigate to **CC Agents**
2. Click the **Import** dropdown button
3. Select **From GitHub**
4. Browse available agents from the official repository
5. Preview agent details and click **Import Agent**

### Method 2: Import from Local File

1. Download a `.claudia.json` file from this repository
2. In Claudia, navigate to **CC Agents**
3. Click the **Import** dropdown button
4. Select **From File**
5. Choose the downloaded `.claudia.json` file

## 📤 Exporting Agents

### Export Your Custom Agents

1. In Claudia, navigate to **CC Agents**
2. Find your agent in the grid
3. Click the **Export** button
4. Choose where to save the `.claudia.json` file

### Agent File Format

All agents are stored in `.claudia.json` format with the following structure:

```json
{
  "version": 1,
  "exported_at": "2025-01-23T14:29:58.156063+00:00",
  "agent": {
    "name": "Your Agent Name",
    "icon": "bot",
    "model": "opus|sonnet|haiku",
    "system_prompt": "Your agent's instructions...",
    "default_task": "Default task description"
  }
}
```

## 🔧 Technical Implementation

### How Import/Export Works

The agent import/export system is built on a robust architecture:

#### Backend (Rust/Tauri)
- **Storage**: SQLite database stores agent configurations
- **Export**: Serializes agent data to JSON with version control
- **Import**: Validates and deduplicates agents on import
- **GitHub Integration**: Fetches agents via GitHub API

#### Frontend (React/TypeScript)
- **UI Components**: 
  - `CCAgents.tsx` - Main agent management interface
  - `GitHubAgentBrowser.tsx` - GitHub repository browser
  - `CreateAgent.tsx` - Agent creation/editing form
- **File Operations**: Native file dialogs for import/export
- **Real-time Updates**: Live agent status and execution monitoring

### Key Features

1. **Version Control**: Each agent export includes version metadata
2. **Duplicate Prevention**: Automatic naming conflict resolution
3. **Model Selection**: Choose between Opus, Sonnet, and Haiku models
4. **GitHub Integration**: Direct import from the official repository

## 🤝 Contributing

We welcome agent contributions! Here's how to add your agent:

### 1. Create Your Agent
Design and test your agent in Claudia with a clear, focused purpose.

### 2. Export Your Agent
Export your agent to a `.claudia.json` file with a descriptive name.

### 3. Submit a Pull Request
1. Fork this repository
2. Add your `.claudia.json` file to the `cc_agents` directory
3. Update this README with your agent's details
4. Submit a PR with a description of what your agent does

### Agent Guidelines

- **Single Purpose**: Each agent should excel at one specific task
- **Clear Documentation**: Write comprehensive system prompts
- **Model Choice**: Use Haiku for simple tasks, Sonnet for general purpose, Opus for complex reasoning
- **Naming**: Use descriptive names that clearly indicate the agent's function

## 📜 License

These agents are provided under the same license as the Claudia project. See the main LICENSE file for details.

---

<div align="center">
  <strong>Built with ❤️ by the Claudia community</strong>
</div> 
