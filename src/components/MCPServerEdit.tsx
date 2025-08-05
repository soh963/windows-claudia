import React, { useState, useEffect } from "react";
import { Save, Copy, FileJson, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, type MCPServer } from "@/lib/api";

interface MCPServerEditProps {
  /**
   * Server to edit
   */
  server: MCPServer;
  /**
   * Whether the dialog is open
   */
  open: boolean;
  /**
   * Callback when dialog is closed
   */
  onClose: () => void;
  /**
   * Callback when server is successfully updated
   */
  onUpdated: () => void;
}

interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

/**
 * Dialog for editing an MCP server configuration as JSON
 */
export const MCPServerEdit: React.FC<MCPServerEditProps> = ({
  server,
  open,
  onClose,
  onUpdated,
}) => {
  const [jsonContent, setJsonContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize JSON content when dialog opens
  useEffect(() => {
    if (open) {
      loadServerJson();
    }
  }, [open, server]);

  /**
   * Loads the server configuration as JSON
   */
  const loadServerJson = async () => {
    try {
      const json = await api.mcpExportJson(server.name);
      setJsonContent(json);
      setError(null);
      setValidationError(null);
    } catch (err) {
      console.error("Failed to export server as JSON:", err);
      setError("Failed to load server configuration");
    }
  };

  /**
   * Validates the JSON content
   */
  const validateJson = (content: string): MCPServerConfig | null => {
    try {
      const config = JSON.parse(content) as MCPServerConfig;
      
      // Validate based on transport type
      if (server.transport === "stdio") {
        if (!config.command || typeof config.command !== "string") {
          setValidationError("Command is required for stdio transport");
          return null;
        }
        if (config.args && !Array.isArray(config.args)) {
          setValidationError("Args must be an array");
          return null;
        }
      } else if (server.transport === "sse") {
        if (!config.url || typeof config.url !== "string") {
          setValidationError("URL is required for SSE transport");
          return null;
        }
      }
      
      // Validate env if present
      if (config.env && typeof config.env !== "object") {
        setValidationError("Environment variables must be an object");
        return null;
      }
      
      setValidationError(null);
      return config;
    } catch (err) {
      setValidationError("Invalid JSON format");
      return null;
    }
  };

  /**
   * Handles JSON content change
   */
  const handleJsonChange = (value: string) => {
    setJsonContent(value);
    if (value.trim()) {
      validateJson(value);
    } else {
      setValidationError(null);
    }
  };

  /**
   * Copies JSON to clipboard
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  /**
   * Saves the updated configuration
   */
  const handleSave = async () => {
    const config = validateJson(jsonContent);
    if (!config) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const result = await api.mcpUpdate(
        server.name,
        server.transport,
        config.command,
        config.args || [],
        config.env || {},
        config.url,
        server.scope
      );
      
      if (result.success) {
        onUpdated();
        onClose();
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error("Failed to update server:", err);
      setError("Failed to update server configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit MCP Server Configuration</DialogTitle>
          <DialogDescription>
            Edit the JSON configuration for {server.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Server Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Transport:</span>{" "}
              <span className="font-medium">{server.transport}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Scope:</span>{" "}
              <span className="font-medium">{server.scope}</span>
            </div>
          </div>

          {/* JSON Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Configuration (JSON)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={jsonContent}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder="Loading configuration..."
              className="font-mono text-sm h-64 resize-none"
              spellCheck={false}
            />
          </div>

          {/* Validation Error */}
          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* JSON Format Help */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileJson className="h-4 w-4 text-primary" />
              JSON Format
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {server.transport === "stdio" ? (
                <>
                  <p>Required fields for stdio transport:</p>
                  <pre className="bg-background rounded p-2 mt-1">
{`{
  "command": "/path/to/server",
  "args": ["arg1", "arg2"],
  "env": {
    "KEY": "value"
  }
}`}
                  </pre>
                </>
              ) : (
                <>
                  <p>Required fields for SSE transport:</p>
                  <pre className="bg-background rounded p-2 mt-1">
{`{
  "url": "https://example.com/sse",
  "env": {
    "API_KEY": "value"
  }
}`}
                  </pre>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !!validationError || !jsonContent.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};