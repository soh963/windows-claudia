# Claudia: Project Documentation

**Date**: August 2025
**Version**: 1.0.0

This document provides a comprehensive overview of the Claudia project, including its architecture, features, and development guidelines. It is intended for developers, contributors, and anyone interested in the technical details of the Claudia AI assistant platform.

---

## Table of Contents
1.  [Project Overview](#1-project-overview)
2.  [System Architecture](#2-system-architecture)
3.  [Key Features](#3-key-features)
4.  [Development and Contribution](#4-development-and-contribution)
5.  [Git Workflow](#5-git-workflow)
6.  [Commit History](#6-commit-history)

---

## 1. Project Overview

**Claudia** is a powerful desktop application designed to enhance the experience of working with Claude Code. It provides a graphical user interface (GUI) for managing AI sessions, creating custom agents, and tracking usage. This fork is specifically optimized for Windows and includes a rich set of pre-built agents to streamline development workflows.

### Key Differentiators of this Fork
- **Windows Optimizations**: Includes fixes for Windows-specific build errors and a development environment pre-configured for Windows.
- **Pre-built CC Agents**: A collection of 29 ready-to-use agents for various development tasks, such as Git workflow automation, security scanning, and code analysis.
- **Enhanced UI/UX**: A modern interface with advanced features like a project dashboard, real-time analytics, and smooth animations.

---

## 2. System Architecture

Claudia is built with a robust architecture that separates the frontend and backend, ensuring a modular and maintainable codebase.

- **Frontend**: Developed with **React 18, TypeScript, and Vite 6**, providing a modern and responsive user experience.
- **Backend**: Powered by **Rust with Tauri 2**, offering a secure and high-performance foundation.
- **UI Framework**: Styled with **Tailwind CSS v4 and shadcn/ui**, ensuring a beautiful and accessible interface.
- **Database**: Utilizes **SQLite** for local data storage, managed via `rusqlite`.

### Core Components
- **AI Model Manager**: A unified interface for interacting with Claude, Gemini, and Ollama models.
- **Session Manager**: Implements strict session isolation with unique IDs (UUID v4 + timestamp + salt) to prevent cross-contamination.
- **MCP Server**: Manages Model Context Protocol servers for enhanced context and documentation access.
- **Agent System**: Allows for the creation and execution of specialized AI agents in isolated processes.
- **Error Knowledge Base**: A system for tracking, analyzing, and automatically resolving errors.

---

## 3. Key Features

- **Project & Session Management**: A visual browser for navigating projects and resuming past sessions.
- **Custom AI Agents**: A library of 29 pre-built agents and the ability to create custom ones.
- **Usage Analytics Dashboard**: Real-time tracking of API usage and costs.
- **Timeline & Checkpoints**: A visual timeline for session versioning and easy restoration of previous states.
- **`CLAUDIA.md` Management**: A built-in editor for project documentation.

---

## 4. Development and Contribution

We welcome contributions to improve Claudia. Please follow these guidelines to get started.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite 6
- **Backend**: Rust, Tauri 2
- **UI**: Tailwind CSS v4, shadcn/ui
- **Database**: SQLite
- **Package Manager**: Bun

### Getting Started
1.  **Prerequisites**: Ensure you have Rust, Bun, Git, and the Claude Code CLI installed.
2.  **Clone the repository**: `git clone https://github.com/soh963/windows-claudia.git`
3.  **Install dependencies**: `bun install`
4.  **Run in development mode**: `bun run tauri dev`

### Contribution Guidelines
- **Pull Requests**: Follow the specified title prefixes (`Feature:`, `Fix:`, `Docs:`, etc.) and provide a clear description of your changes.
- **Coding Standards**: Adhere to the defined standards for both frontend (React/TypeScript) and backend (Rust) code.
- **Security**: Validate all inputs, use prepared statements for database operations, and never log sensitive data.
- **Testing**: Add tests for new functionality and ensure all existing tests pass.

---

## 5. Git Workflow

An automated Git commit workflow system is in place to maintain a consistent and organized commit history.

### Key Components
- **Core Scripts**: `git-workflow.js` (Node.js) and `git-workflow.ps1` (PowerShell) for cross-platform support.
- **Git Hooks**: `pre-commit` for code validation and `commit-msg` for message formatting.
- **Configuration**: `.git-workflow.json` for customizable workflows and `.gitmessage` for commit templates.

### Usage
- **`git wf`**: Interactive commit workflow.
- **`git wf-status`**: Check categorized file status.
- **`git wf-backup`**: Create a backup of the current state.

---

## 6. Commit History

A detailed record of all significant changes is maintained in `COMMIT_RECORD_DETAILED.md`. This includes a comprehensive list of new features, architectural enhancements, and infrastructure improvements.

### Major Implementations (as of August 6, 2025)
- **Gemini Integration**: A complete suite for Gemini API integration, including backend architecture, model management, and real-time monitoring.
- **Error Tracking System**: A robust system for error detection, analysis, and knowledge base management.
- **Progress Monitoring**: A visualization system for tracking real-time metrics and session tasks.
- **Development Infrastructure**: A full testing framework with Vitest and Playwright, CI/CD pipelines, and extensive code coverage.
- **UI/UX Enhancements**: A suite of new components, including an advanced model selector, AI analytics dashboard, and a responsive design system.
