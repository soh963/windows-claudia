import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  AudioWaveform,
  TestTube,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { GEMINI_MODELS } from '@/lib/models';

interface AudioTest {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  result?: string;
  error?: string;
  duration?: number;
}

interface AudioCapabilityTestProps {
  className?: string;
  onTestComplete?: (results: AudioTest[]) => void;
}

/**
 * AudioFunctionalityTest - Comprehensive audio functionality testing component
 * Tests audio input, output, recording, playback, and model integration
 */
export const AudioFunctionalityTest: React.FC<AudioCapabilityTestProps> = ({
  className,
  onTestComplete,
}) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [tests, setTests] = useState<AudioTest[]>([
    {
      id: 'mic-permission',
      name: 'Microphone Permission',
      description: 'Test microphone access and permission',
      status: 'pending'
    },
    {
      id: 'audio-recording',
      name: 'Audio Recording',
      description: 'Test audio recording functionality',
      status: 'pending'
    },
    {
      id: 'audio-playback',
      name: 'Audio Playback',
      description: 'Test audio playback functionality',
      status: 'pending'
    },
    {
      id: 'audio-processing',
      name: 'Audio Processing',
      description: 'Test audio format conversion and processing',
      status: 'pending'
    },
    {
      id: 'gemini-audio-support',
      name: 'Gemini Audio Support',
      description: 'Test Gemini model audio capability integration',
      status: 'pending'
    },
    {
      id: 'audio-quality',
      name: 'Audio Quality',
      description: 'Test audio quality and clarity',
      status: 'pending'
    }
  ]);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout>();

  // Audio level monitoring
  useEffect(() => {
    if (isRecording && analyserRef.current) {
      const updateAudioLevel = () => {
        const dataArray = new Uint8Array(analyserRef.current!.frequencyBinCount);
        analyserRef.current!.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        setAudioLevel((average / 255) * 100);
        
        if (isRecording) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
    }
  }, [isRecording]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Update test status
  const updateTestStatus = useCallback((testId: string, status: AudioTest['status'], result?: string, error?: string, duration?: number) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { ...test, status, result, error, duration }
        : test
    ));
  }, []);

  // Test microphone permission
  const testMicrophonePermission = useCallback(async () => {
    updateTestStatus('mic-permission', 'running');
    const startTime = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      const duration = Date.now() - startTime;
      updateTestStatus('mic-permission', 'passed', 'Microphone access granted', undefined, duration);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestStatus('mic-permission', 'failed', undefined, (error as Error).message, duration);
      return false;
    }
  }, [updateTestStatus]);

  // Test audio recording
  const testAudioRecording = useCallback(async () => {
    updateTestStatus('audio-recording', 'running');
    const startTime = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      mediaRecorder.start();
      
      // Record for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      mediaRecorder.stop();
      stream.getTracks().forEach(track => track.stop());

      await new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const duration = Date.now() - startTime;
          
          if (blob.size > 0) {
            updateTestStatus('audio-recording', 'passed', 
              `Successfully recorded ${(blob.size / 1024).toFixed(1)}KB audio`, undefined, duration);
          } else {
            updateTestStatus('audio-recording', 'failed', undefined, 'No audio data recorded', duration);
          }
          resolve(blob);
        };
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestStatus('audio-recording', 'failed', undefined, (error as Error).message, duration);
      return false;
    }
  }, [updateTestStatus]);

  // Test audio playback
  const testAudioPlayback = useCallback(async () => {
    updateTestStatus('audio-playback', 'running');
    const startTime = Date.now();

    try {
      // Create a simple test tone
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // A4 note
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1; // Low volume

      oscillator.start();
      
      // Play for 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      oscillator.stop();
      audioContext.close();

      const duration = Date.now() - startTime;
      updateTestStatus('audio-playback', 'passed', 'Audio playback test completed', undefined, duration);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestStatus('audio-playback', 'failed', undefined, (error as Error).message, duration);
      return false;
    }
  }, [updateTestStatus]);

  // Test audio processing
  const testAudioProcessing = useCallback(async () => {
    updateTestStatus('audio-processing', 'running');
    const startTime = Date.now();

    try {
      // Test audio format support
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/wav',
        'audio/ogg;codecs=vorbis'
      ];

      const supportedFormats: string[] = [];
      supportedTypes.forEach(type => {
        if (MediaRecorder.isTypeSupported(type)) {
          supportedFormats.push(type);
        }
      });

      if (supportedFormats.length > 0) {
        const duration = Date.now() - startTime;
        updateTestStatus('audio-processing', 'passed', 
          `Supported formats: ${supportedFormats.join(', ')}`, undefined, duration);
        return true;
      } else {
        const duration = Date.now() - startTime;
        updateTestStatus('audio-processing', 'failed', undefined, 'No supported audio formats found', duration);
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestStatus('audio-processing', 'failed', undefined, (error as Error).message, duration);
      return false;
    }
  }, [updateTestStatus]);

  // Test Gemini audio support
  const testGeminiAudioSupport = useCallback(async () => {
    updateTestStatus('gemini-audio-support', 'running');
    const startTime = Date.now();

    try {
      // Check if any Gemini models support audio
      const audioEnabledModels = GEMINI_MODELS.filter(model => 
        model.capabilities?.audioInput || model.capabilities?.audioOutput
      );

      if (audioEnabledModels.length > 0) {
        const duration = Date.now() - startTime;
        const modelNames = audioEnabledModels.map(m => m.name).join(', ');
        updateTestStatus('gemini-audio-support', 'passed', 
          `Audio-enabled models: ${modelNames}`, undefined, duration);
        return true;
      } else {
        const duration = Date.now() - startTime;
        updateTestStatus('gemini-audio-support', 'warning', undefined, 
          'No Gemini models with audio support found', duration);
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestStatus('gemini-audio-support', 'failed', undefined, (error as Error).message, duration);
      return false;
    }
  }, [updateTestStatus]);

  // Test audio quality
  const testAudioQuality = useCallback(async () => {
    updateTestStatus('audio-quality', 'running');
    const startTime = Date.now();

    try {
      // Check audio context capabilities
      const audioContext = new AudioContext();
      const sampleRate = audioContext.sampleRate;
      const outputLatency = audioContext.outputLatency || 0;
      const baseLatency = audioContext.baseLatency || 0;

      audioContext.close();

      const quality = sampleRate >= 44100 ? 'High' : sampleRate >= 22050 ? 'Medium' : 'Low';
      const latency = (outputLatency + baseLatency) * 1000; // Convert to ms

      const duration = Date.now() - startTime;
      updateTestStatus('audio-quality', 'passed', 
        `Quality: ${quality} (${sampleRate}Hz), Latency: ${latency.toFixed(1)}ms`, undefined, duration);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestStatus('audio-quality', 'failed', undefined, (error as Error).message, duration);
      return false;
    }
  }, [updateTestStatus]);

  // Run all tests
  const runAllTests = useCallback(async () => {
    const testFunctions = [
      testMicrophonePermission,
      testAudioRecording,
      testAudioPlayback,
      testAudioProcessing,
      testGeminiAudioSupport,
      testAudioQuality
    ];

    for (const testFn of testFunctions) {
      await testFn();
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    onTestComplete?.(tests);
  }, [
    testMicrophonePermission,
    testAudioRecording,
    testAudioPlayback,
    testAudioProcessing,
    testGeminiAudioSupport,
    testAudioQuality,
    tests,
    onTestComplete
  ]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      audioStreamRef.current = stream;

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recordedChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [isRecording]);

  // Get status icon
  const getStatusIcon = (status: AudioTest['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <TestTube className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <TooltipProvider>
      <Card className={cn("w-full max-w-2xl", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AudioWaveform className="h-5 w-5 text-primary" />
              <CardTitle>Audio Functionality Test</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runAllTests}
              disabled={tests.some(t => t.status === 'running')}
            >
              {tests.some(t => t.status === 'running') ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Audio Testing Controls */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Manual Audio Test</h3>
            
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop ({recordingDuration}s)
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>
              </div>

              {/* Audio Level Indicator */}
              {isRecording && (
                <div className="flex items-center gap-2 flex-1">
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                  <Progress value={audioLevel} className="flex-1 h-2" />
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground min-w-[3ch]">
                    {Math.round(audioLevel)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Test Results */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Test Results</h3>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {tests.map((test) => (
                  <Card key={test.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(test.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium">{test.name}</h4>
                            <Badge 
                              variant={test.status === 'passed' ? 'default' : 
                                     test.status === 'failed' ? 'destructive' : 
                                     test.status === 'warning' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {test.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {test.description}
                          </p>
                          {test.result && (
                            <p className="text-xs text-green-600 mt-1">
                              {test.result}
                            </p>
                          )}
                          {test.error && (
                            <p className="text-xs text-red-600 mt-1">
                              Error: {test.error}
                            </p>
                          )}
                        </div>
                      </div>
                      {test.duration && (
                        <span className="text-xs text-muted-foreground">
                          {test.duration}ms
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">Test Summary: </span>
              {tests.filter(t => t.status === 'passed').length} passed, {' '}
              {tests.filter(t => t.status === 'failed').length} failed, {' '}
              {tests.filter(t => t.status === 'warning').length} warnings
            </div>
            <Badge variant="outline">
              {Math.round((tests.filter(t => t.status === 'passed').length / tests.length) * 100)}% success
            </Badge>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default AudioFunctionalityTest;