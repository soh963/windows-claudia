import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor,
  Smartphone,
  Tablet,
  Play,
  Pause,
  Settings,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Import actual components
import { ProgressTracker } from '@/components/ProgressTracker';
import { ModelSelector } from '@/components/ModelSelector';
import { IntelligentChat } from '@/components/IntelligentChat';
import { ChatWindowWithProgressTracker } from '@/components/ChatWindowWithProgressTracker';
import { UIOverlapTestReport } from '@/components/UIOverlapTestReport';
import { useMonitoringStore } from '@/stores/monitoringStore';
import { enableOverlapDetection, disableOverlapDetection } from '@/utils/visualOverlapDetector';

type DevicePreset = 'mobile' | 'tablet' | 'desktop' | 'custom';

interface ViewportSize {
  width: number;
  height: number;
}

const DEVICE_PRESETS: Record<DevicePreset, ViewportSize & { icon: React.ReactNode }> = {
  mobile: { width: 375, height: 812, icon: <Smartphone className="h-4 w-4" /> },
  tablet: { width: 768, height: 1024, icon: <Tablet className="h-4 w-4" /> },
  desktop: { width: 1920, height: 1080, icon: <Monitor className="h-4 w-4" /> },
  custom: { width: 1200, height: 800, icon: <Settings className="h-4 w-4" /> },
};

export const UIOverlapPreventionDemo: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>('desktop');
  const [viewportSize, setViewportSize] = useState<ViewportSize>(DEVICE_PRESETS.desktop);
  const [showProgressTracker, setShowProgressTracker] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(true);
  const [showIntelligentChat, setShowIntelligentChat] = useState(true);
  const [chatInput, setChatInput] = useState('create a new React component');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOverlapDetection, setShowOverlapDetection] = useState(false);
  const [showTestReport, setShowTestReport] = useState(false);
  const [scale, setScale] = useState(0.75);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitoring store
  const { showProgressTracker: storeShowProgress, toggleProgressTracker } = useMonitoringStore();

  // Handle device preset change
  const handleDeviceChange = (device: DevicePreset) => {
    setSelectedDevice(device);
    if (device !== 'custom') {
      setViewportSize(DEVICE_PRESETS[device]);
    }
  };

  // Handle viewport size change
  const handleViewportChange = (dimension: 'width' | 'height', value: number) => {
    setViewportSize(prev => ({
      ...prev,
      [dimension]: value,
    }));
    setSelectedDevice('custom');
  };

  // Toggle overlap detection
  const handleOverlapDetectionToggle = (enabled: boolean) => {
    setShowOverlapDetection(enabled);
    if (enabled) {
      enableOverlapDetection({
        highlightColor: 'rgba(255, 0, 0, 0.4)',
        checkInterval: 500,
      });
    } else {
      disableOverlapDetection();
    }
  };

  // Simulate interactions
  const simulateInteractions = () => {
    setIsPlaying(true);
    
    // Sequence of interactions
    const sequence = [
      () => setShowProgressTracker(false),
      () => setShowProgressTracker(true),
      () => toggleProgressTracker(),
      () => setChatInput('implement authentication system with JWT tokens'),
      () => setShowModelSelector(false),
      () => setShowModelSelector(true),
      () => setShowIntelligentChat(false),
      () => setShowIntelligentChat(true),
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index < sequence.length) {
        sequence[index]();
        index++;
      } else {
        clearInterval(interval);
        setIsPlaying(false);
      }
    }, 1500);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">UI Overlap Prevention Demo</h1>
            <Badge variant="secondary">Live Preview</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTestReport(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Run Tests
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Controls Sidebar */}
        <div className="w-80 border-r bg-card overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Device Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Device Preset</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DEVICE_PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={selectedDevice === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDeviceChange(key as DevicePreset)}
                    className="justify-start"
                  >
                    {preset.icon}
                    <span className="ml-2 capitalize">{key}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Viewport Size */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Viewport Size</h3>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Width: {viewportSize.width}px</Label>
                  <Slider
                    value={[viewportSize.width]}
                    onValueChange={([value]) => handleViewportChange('width', value)}
                    min={320}
                    max={1920}
                    step={10}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Height: {viewportSize.height}px</Label>
                  <Slider
                    value={[viewportSize.height]}
                    onValueChange={([value]) => handleViewportChange('height', value)}
                    min={480}
                    max={1080}
                    step={10}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Component Visibility */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Component Visibility</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="progress-tracker">Progress Tracker</Label>
                  <Switch
                    id="progress-tracker"
                    checked={showProgressTracker}
                    onCheckedChange={setShowProgressTracker}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="model-selector">Model Selector</Label>
                  <Switch
                    id="model-selector"
                    checked={showModelSelector}
                    onCheckedChange={setShowModelSelector}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="intelligent-chat">Intelligent Chat</Label>
                  <Switch
                    id="intelligent-chat"
                    checked={showIntelligentChat}
                    onCheckedChange={setShowIntelligentChat}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Preview Controls */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Preview Controls</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="overlap-detection">Overlap Detection</Label>
                  <Switch
                    id="overlap-detection"
                    checked={showOverlapDetection}
                    onCheckedChange={handleOverlapDetectionToggle}
                  />
                </div>
                <div>
                  <Label className="text-xs">Scale: {Math.round(scale * 100)}%</Label>
                  <Slider
                    value={[scale]}
                    onValueChange={([value]) => setScale(value)}
                    min={0.25}
                    max={1}
                    step={0.05}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={simulateInteractions}
                disabled={isPlaying}
                className="w-full"
                size="sm"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Playing Simulation...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Simulate Interactions
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="w-full"
                size="sm"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Exit Fullscreen
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Fullscreen Preview
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-muted/20 overflow-hidden p-8">
          <div className="h-full flex items-center justify-center">
            <motion.div
              className={cn(
                "relative bg-background border-2 border-border rounded-lg shadow-2xl overflow-hidden",
                isFullscreen && "fixed inset-4 z-50"
              )}
              style={{
                width: isFullscreen ? 'calc(100% - 2rem)' : viewportSize.width * scale,
                height: isFullscreen ? 'calc(100% - 2rem)' : viewportSize.height * scale,
                transform: isFullscreen ? 'none' : `scale(${scale})`,
                transformOrigin: 'center',
              }}
              animate={{
                width: isFullscreen ? 'calc(100% - 2rem)' : viewportSize.width,
                height: isFullscreen ? 'calc(100% - 2rem)' : viewportSize.height,
              }}
              transition={{ type: 'spring', damping: 20 }}
            >
              {/* Viewport Info Badge */}
              <div className="absolute top-2 left-2 z-50">
                <Badge variant="secondary" className="text-xs">
                  {viewportSize.width} × {viewportSize.height}
                </Badge>
              </div>

              {/* Demo Content */}
              <div className="h-full w-full relative overflow-hidden">
                {/* Chat Window with Progress Tracker */}
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="border-b p-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Chat Interface</h2>
                    {showModelSelector && (
                      <ModelSelector
                        value="auto"
                        onChange={() => {}}
                        compact={viewportSize.width < 768}
                      />
                    )}
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm">Welcome to the chat interface!</p>
                      </div>
                      {showIntelligentChat && (
                        <IntelligentChat input={chatInput} />
                      )}
                    </div>
                  </div>

                  {/* Input Area */}
                  <div className="border-t p-4">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="w-full px-3 py-2 border rounded-lg bg-background"
                    />
                  </div>
                </div>

                {/* Progress Tracker */}
                {showProgressTracker && storeShowProgress && (
                  <ProgressTracker />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Test Report Modal */}
      {showTestReport && (
        <UIOverlapTestReport
          onClose={() => setShowTestReport(false)}
          autoRun
        />
      )}
    </div>
  );
};