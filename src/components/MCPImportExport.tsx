import React, { useState } from "react";
import { Download, Upload, FileText, Loader2, Info, Network, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SelectComponent } from "@/components/ui/select";
import { api } from "@/lib/api";

interface MCPImportExportProps {
  /**
   * Callback when import is completed
   */
  onImportCompleted: (imported: number, failed: number) => void;
  /**
   * Callback for error messages
   */
  onError: (message: string) => void;
}

/**
 * Component for importing and exporting MCP server configurations
 */
export const MCPImportExport: React.FC<MCPImportExportProps> = ({
  onImportCompleted,
  onError,
}) => {
  const [importingDesktop, setImportingDesktop] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const [importScope, setImportScope] = useState("local");

  /**
   * Imports servers from Claude Desktop
   */
  const handleImportFromDesktop = async () => {
    try {
      setImportingDesktop(true);
      // Always use "user" scope for Claude Desktop imports (was previously "global")
      const result = await api.mcpAddFromClaudeDesktop("user");
      
      // Show detailed results if available
      if (result.servers && result.servers.length > 0) {
        const successfulServers = result.servers.filter(s => s.success);
        const failedServers = result.servers.filter(s => !s.success);
        
        if (successfulServers.length > 0) {
          const successMessage = `Successfully imported: ${successfulServers.map(s => s.name).join(", ")}`;
          onImportCompleted(result.imported_count, result.failed_count);
          // Show success details
          if (failedServers.length === 0) {
            onError(successMessage);
          }
        }
        
        if (failedServers.length > 0) {
          const failureDetails = failedServers
            .map(s => `${s.name}: ${s.error || "Unknown error"}`)
            .join("\n");
          onError(`Failed to import some servers:\n${failureDetails}`);
        }
      } else {
        onImportCompleted(result.imported_count, result.failed_count);
      }
    } catch (error: any) {
      console.error("Failed to import from Claude Desktop:", error);
      onError(error.toString() || "Failed to import from Claude Desktop");
    } finally {
      setImportingDesktop(false);
    }
  };

  /**
   * Handles JSON file import
   */
  const handleJsonFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setImportingJson(true);
      let totalImported = 0;
      let totalFailed = 0;

      // Process each selected file
      for (const file of Array.from(files)) {
        try {
          const content = await file.text();
          
          // Parse the JSON to validate it
          let jsonData;
          try {
            jsonData = JSON.parse(content);
          } catch (e) {
            console.error(`Invalid JSON in file ${file.name}:`, e);
            totalFailed++;
            continue;
          }

          // Check if it's a single server or multiple servers
          if (jsonData.mcpServers) {
            // Multiple servers format
            for (const [name, config] of Object.entries(jsonData.mcpServers)) {
              try {
                // Determine transport type based on config
                const hasUrl = (config as any).url;
                const hasCommand = (config as any).command;
                
                if (!hasUrl && !hasCommand) {
                  console.error(`Server ${name}: Must have either 'command' (for stdio) or 'url' (for SSE)`);
                  totalFailed++;
                  continue;
                }
                
                const serverConfig = {
                  type: hasUrl ? "sse" : "stdio",
                  command: (config as any).command,
                  args: (config as any).args || [],
                  env: (config as any).env || {},
                  url: (config as any).url
                };
            
                const result = await api.mcpAddJson(name, JSON.stringify(serverConfig), importScope);
                if (result.success) {
                  totalImported++;
                } else {
                  console.error(`Failed to import ${name}: ${result.message}`);
                  totalFailed++;
                }
              } catch (e) {
                console.error(`Error importing ${name}:`, e);
                totalFailed++;
              }
            }
          } else if (jsonData.type) {
            // Single server format - validate based on type
            const type = jsonData.type;
            if (type === "stdio" && !jsonData.command) {
              console.error(`${file.name}: 'command' is required for stdio transport`);
              totalFailed++;
              continue;
            }
            if (type === "sse" && !jsonData.url) {
              console.error(`${file.name}: 'url' is required for SSE transport`);
              totalFailed++;
              continue;
            }
            if (type !== "stdio" && type !== "sse") {
              console.error(`${file.name}: Invalid transport type '${type}'. Must be 'stdio' or 'sse'`);
              totalFailed++;
              continue;
            }
            
            const name = prompt(`Enter a name for the server from ${file.name}:`);
            if (!name) {
              totalFailed++;
              continue;
            }

            const result = await api.mcpAddJson(name, content, importScope);
            if (result.success) {
              totalImported++;
            } else {
              console.error(`Failed to import ${name}: ${result.message}`);
              totalFailed++;
            }
          } else {
            console.error(`Unrecognized JSON format in ${file.name}. Must have either 'type' field or 'mcpServers' object`);
            totalFailed++;
          }
        } catch (error) {
          console.error(`Failed to process file ${file.name}:`, error);
          totalFailed++;
        }
      }

      // Report results for all files
      if (totalImported > 0 || totalFailed > 0) {
        onImportCompleted(totalImported, totalFailed);
      } else {
        onError("No servers were imported. Please check the file format.");
      }
    } catch (error) {
      console.error("Failed to import JSON files:", error);
      onError("Failed to import JSON files");
    } finally {
      setImportingJson(false);
      // Reset the input
      event.target.value = "";
    }
  };

  /**
   * Handles exporting servers
   */
  const handleExport = async () => {
    try {
      // Get all servers as JSON
      const jsonContent = await api.mcpExportAllJson();
      
      // Create a blob and download link
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mcp-servers-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      onError("Configuration exported successfully!");
    } catch (error) {
      console.error("Failed to export servers:", error);
      onError("Failed to export configuration");
    }
  };

  /**
   * Starts Claude Code as MCP server
   */
  const handleStartMCPServer = async () => {
    try {
      await api.mcpServe();
      onError("Claude Code MCP server started. You can now connect to it from other applications.");
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      onError("Failed to start Claude Code as MCP server");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">Import & Export</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Import MCP servers from other sources or export your configuration
        </p>
      </div>

      <div className="space-y-4">
        {/* Import Scope Selection */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              <Label className="text-sm font-medium">Import Scope</Label>
            </div>
            <SelectComponent
              value={importScope}
              onValueChange={(value: string) => setImportScope(value)}
              options={[
                { value: "local", label: "Local (this project only)" },
                { value: "project", label: "Project (shared via .mcp.json)" },
                { value: "user", label: "User (all projects)" },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Choose where to save imported servers from JSON files
            </p>
          </div>
        </Card>

        {/* Import from Claude Desktop */}
        <Card className="p-4 hover:bg-accent/5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-lg">
                <Download className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">Import from Claude Desktop</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically imports all MCP servers from Claude Desktop. Installs to user scope (available across all projects).
                </p>
              </div>
            </div>
            <Button
              onClick={handleImportFromDesktop}
              disabled={importingDesktop}
              className="w-full gap-2 bg-primary hover:bg-primary/90"
            >
              {importingDesktop ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Import from Claude Desktop
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Import from JSON */}
        <Card className="p-4 hover:bg-accent/5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">Import from JSON</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Import server configuration from a JSON file
                </p>
              </div>
            </div>
            <div>
              <input
                type="file"
                accept=".json"
                multiple
                onChange={handleJsonFileSelect}
                disabled={importingJson}
                className="hidden"
                id="json-file-input"
              />
              <Button
                onClick={() => document.getElementById("json-file-input")?.click()}
                disabled={importingJson}
                className="w-full gap-2"
                variant="outline"
              >
                {importingJson ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Choose JSON File
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Export */}
        <Card className="p-4 hover:bg-accent/5 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-green-500/10 rounded-lg">
                <Upload className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">Export Configuration</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Export all MCP servers to a JSON file
                </p>
              </div>
            </div>
            <Button
              onClick={handleExport}
              variant="outline"
              className="w-full gap-2 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/50"
            >
              <Upload className="h-4 w-4" />
              Export to JSON
            </Button>
          </div>
        </Card>

        {/* Serve as MCP */}
        <Card className="p-4 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-green-500/20 rounded-lg">
                <Network className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">Use Claude Code as MCP Server</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Start Claude Code as an MCP server that other applications can connect to
                </p>
              </div>
            </div>
            <Button
              onClick={handleStartMCPServer}
              variant="outline"
              className="w-full gap-2 border-green-500/20 hover:bg-green-500/10 hover:text-green-600 hover:border-green-500/50"
            >
              <Network className="h-4 w-4" />
              Start MCP Server
            </Button>
          </div>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 text-primary" />
            <span>JSON Format Examples</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-medium text-muted-foreground mb-1">Single server:</p>
              <pre className="bg-background p-3 rounded-lg overflow-x-auto">
{`{
  "type": "stdio",
  "command": "/path/to/server",
  "args": ["--arg1", "value"],
  "env": { "KEY": "value" }
}`}
              </pre>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-1">Multiple servers (.mcp.json format):</p>
              <pre className="bg-background p-3 rounded-lg overflow-x-auto">
{`{
  "mcpServers": {
    "server1": {
      "command": "/path/to/server1",
      "args": [],
      "env": {}
    },
    "server2": {
      "command": "/path/to/server2",
      "args": ["--port", "8080"],
      "env": { "API_KEY": "..." }
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}; 