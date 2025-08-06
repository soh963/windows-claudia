import React, { useState } from 'react';
import { Key, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug logging
  React.useEffect(() => {
    console.log('[GeminiApiKeyModal] isOpen:', isOpen);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Verify the API key by making a test request
      const isValid = await api.verifyGeminiApiKey(apiKey);
      
      if (isValid) {
        // Save the API key
        await api.setGeminiApiKey(apiKey);
        onSuccess();
      } else {
        setError('Invalid API key. Please check and try again.');
      }
    } catch (error) {
      console.error('Failed to verify Gemini API key:', error);
      setError('Failed to verify API key. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Gemini API Key Required
          </DialogTitle>
          <DialogDescription>
            To use Gemini models, you need to provide your Google AI Studio API key.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium">
              API Key
            </label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API key"
              className="font-mono"
              disabled={isVerifying}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="bg-muted p-3 rounded-md text-sm space-y-2">
            <p>To get your API key:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Visit Google AI Studio</li>
              <li>Sign in with your Google account</li>
              <li>Go to API keys section</li>
              <li>Create a new API key or copy an existing one</li>
            </ol>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Get API Key <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isVerifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!apiKey.trim() || isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Save API Key'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};