import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ExternalLink,
  Key,
  Settings,
  Sparkles,
  Star,
  Brain,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { GEMINI_MODELS, type Model, type ModelConfiguration } from "@/lib/models";
import { ModelConfiguration as ModelConfigurationComponent } from "./ModelConfiguration";

interface GeminiOnboardingProps {
  /**
   * Whether the onboarding is open
   */
  isOpen: boolean;
  /**
   * Callback when onboarding is closed
   */
  onClose: () => void;
  /**
   * Callback when onboarding is completed
   */
  onComplete: (apiKey: string, selectedModel?: string) => void;
  /**
   * Optional className
   */
  className?: string;
}

// Onboarding steps
type OnboardingStep = "welcome" | "api-key" | "model-selection" | "configuration" | "complete";

const STEPS: { id: OnboardingStep; title: string; description: string }[] = [
  {
    id: "welcome",
    title: "Welcome to Gemini",
    description: "Let's get you set up with Google's AI models",
  },
  {
    id: "api-key",
    title: "API Key Setup",
    description: "Connect your Google AI Studio account",
  },
  {
    id: "model-selection",
    title: "Choose Your Model",
    description: "Select the Gemini model that fits your needs",
  },
  {
    id: "configuration",
    title: "Configure Settings",
    description: "Customize model parameters for optimal performance",
  },
  {
    id: "complete",
    title: "All Set!",
    description: "You're ready to start using Gemini",
  },
];

/**
 * StepIndicator component - Shows progress through onboarding
 */
const StepIndicator: React.FC<{
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}> = ({ currentStep, completedSteps }) => {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPast = index < currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                isCompleted || isPast
                  ? "bg-primary text-primary-foreground"
                  : isCurrent
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted || isPast ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 transition-all",
                  isPast ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * GeminiOnboarding component - Step-by-step setup for Gemini integration
 */
export const GeminiOnboarding: React.FC<GeminiOnboardingProps> = ({
  isOpen,
  onClose,
  onComplete,
  className,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [verifyingApiKey, setVerifyingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash-exp");
  const [modelConfig, setModelConfig] = useState<ModelConfiguration>({
    temperature: 0.7,
    maxOutputTokens: 8192,
    topK: 10,
    topP: 0.95,
  });

  const handleNext = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCompletedSteps((prev) => [...prev, currentStep]);
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setApiKeyError("Please enter an API key");
      return;
    }

    setVerifyingApiKey(true);
    setApiKeyError(null);

    try {
      const isValid = await api.verifyGeminiApiKey(apiKey.trim());
      if (isValid) {
        await api.setGeminiApiKey(apiKey.trim());
        handleNext();
      } else {
        setApiKeyError("Invalid API key. Please check and try again.");
      }
    } catch (err) {
      console.error("Failed to verify API key:", err);
      setApiKeyError("Failed to verify API key. Please try again.");
    } finally {
      setVerifyingApiKey(false);
    }
  };

  const handleComplete = () => {
    onComplete(apiKey, selectedModel);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-center"
          >
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-blue-500/10">
                <Star className="h-12 w-12 text-blue-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Welcome to Gemini Integration</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Google's Gemini models offer powerful AI capabilities with large context windows
                and multimodal support. Let's get you set up in just a few steps.
              </p>
            </div>

            <div className="grid gap-4 max-w-md mx-auto text-left">
              <Card className="p-4">
                <div className="flex gap-3">
                  <Key className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-medium">Secure API Key</h4>
                    <p className="text-sm text-muted-foreground">
                      Your API key is encrypted and stored locally
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex gap-3">
                  <Brain className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-medium">Advanced Models</h4>
                    <p className="text-sm text-muted-foreground">
                      Access to Gemini 2.0 Flash and experimental models
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex gap-3">
                  <Settings className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-medium">Full Customization</h4>
                    <p className="text-sm text-muted-foreground">
                      Fine-tune model parameters for your use case
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Button onClick={handleNext} size="lg" className="gap-2">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        );

      case "api-key":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Connect Your Google AI Studio Account</h2>
              <p className="text-muted-foreground">
                You'll need an API key from Google AI Studio to use Gemini models
              </p>
            </div>

            <Card className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setApiKeyError(null);
                      }}
                      placeholder="AIza..."
                      className="pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {apiKeyError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {apiKeyError}
                    </p>
                  )}
                </div>

                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">How to get your API key:</p>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>
                          Visit{" "}
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Google AI Studio
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                        <li>Sign in with your Google account</li>
                        <li>Click "Create API Key"</li>
                        <li>Copy the key and paste it above</li>
                      </ol>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleApiKeySubmit}
                disabled={!apiKey.trim() || verifyingApiKey}
                className="gap-2"
              >
                {verifyingApiKey ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        );

      case "model-selection":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Choose Your Gemini Model</h2>
              <p className="text-muted-foreground">
                Select the model that best fits your needs
              </p>
            </div>

            <div className="grid gap-4">
              {GEMINI_MODELS.map((model) => (
                <Card
                  key={model.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all",
                    selectedModel === model.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => setSelectedModel(model.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      {model.id.includes("flash") ? (
                        <Star className="h-6 w-6 text-blue-500" />
                      ) : (
                        <Brain className="h-6 w-6 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{model.name}</h3>
                        {selectedModel === model.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {model.description}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Context: {(model.contextWindow / 1000000).toFixed(1)}M tokens</span>
                        <span>Max output: {(model.capabilities?.maxOutputTokens || 8192) / 1000}K</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {model.capabilities?.multimodal && (
                          <Badge variant="secondary" className="text-xs">
                            Multimodal
                          </Badge>
                        )}
                        {model.capabilities?.functionCalling && (
                          <Badge variant="secondary" className="text-xs">
                            Function Calling
                          </Badge>
                        )}
                        {model.id.includes("exp") && (
                          <Badge variant="outline" className="text-xs">
                            Experimental
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        );

      case "configuration":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Configure Model Settings</h2>
              <p className="text-muted-foreground">
                Customize parameters for optimal performance (you can change these later)
              </p>
            </div>

            <Card className="p-6">
              <ModelConfigurationComponent
                modelId={selectedModel}
                configuration={modelConfig}
                onChange={setModelConfig}
                mode="inline"
              />
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        );

      case "complete":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-center"
          >
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-500/10">
                <Check className="h-12 w-12 text-green-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">You're All Set!</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Gemini is now configured and ready to use. You can start using it in your chats
                right away.
              </p>
            </div>

            <Card className="p-6 max-w-md mx-auto text-left">
              <h3 className="font-medium mb-3">Quick Tips:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
                  <span>
                    Switch between models anytime using the model selector in the chat input
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Settings className="h-4 w-4 mt-0.5 text-primary" />
                  <span>
                    Access model settings from the Settings page to fine-tune parameters
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Key className="h-4 w-4 mt-0.5 text-primary" />
                  <span>
                    Your API key is securely stored and encrypted locally
                  </span>
                </li>
              </ul>
            </Card>

            <Button onClick={handleComplete} size="lg" className="gap-2">
              Start Using Gemini
              <Sparkles className="h-4 w-4" />
            </Button>
          </motion.div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Gemini Setup</DialogTitle>
          <DialogDescription className="sr-only">
            Step-by-step setup for Gemini integration
          </DialogDescription>
        </DialogHeader>

        <div className={cn("py-6", className)}>
          <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />
          {renderStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};