import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Clock,
  Code,
  FileText,
  Link,
  Tag,
  MessageSquare,
  Lightbulb,
  ChevronRight,
  Bug,
  AlertTriangle,
  Info,
  XCircle,
  Shield,
  Users,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, formatDistanceToNow } from 'date-fns';
import {
  useErrorTrackingStore,
  type ErrorEntry,
  type ErrorSeverity,
} from '@/stores/errorTrackingStore';
import { cn } from '@/lib/utils';

interface ErrorDetailsModalProps {
  errorId: string;
  onClose: () => void;
}

export const ErrorDetailsModal: React.FC<ErrorDetailsModalProps> = ({ errorId, onClose }) => {
  const {
    errors,
    resolveError,
    retryError,
    tagError,
    addLearningNote,
    getRelatedErrors,
    getSimilarErrors,
  } = useErrorTrackingStore();

  const [activeTab, setActiveTab] = useState('details');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [learningNote, setLearningNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [copied, setCopied] = useState(false);

  const error = errors.get(errorId);
  if (!error) return null;

  const relatedErrors = getRelatedErrors(errorId);
  const similarErrors = getSimilarErrors(error);

  const handleCopyError = () => {
    const errorData = {
      id: error.id,
      timestamp: error.timestamp,
      category: error.category,
      source: error.source,
      severity: error.severity,
      message: error.message,
      code: error.code,
      stack: error.stack,
      context: error.context,
      details: error.details,
    };

    navigator.clipboard.writeText(JSON.stringify(errorData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResolve = (method: 'manual' | 'automatic' | 'retry' | 'ignore') => {
    resolveError(error.id, {
      method,
      notes: resolutionNotes,
      success: true,
    });
    onClose();
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      tagError(error.id, [newTag.trim()]);
      setNewTag('');
    }
  };

  const handleAddLearning = () => {
    if (learningNote.trim()) {
      addLearningNote(error.id, learningNote.trim());
      setLearningNote('');
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'low':
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getImpactIcon = (impact: ErrorEntry['impact']['userImpact']) => {
    switch (impact) {
      case 'blocking':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'major':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'minor':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'none':
        return <Info className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-background border rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            {getSeverityIcon(error.severity)}
            <div>
              <h2 className="text-xl font-semibold">Error Details</h2>
              <p className="text-sm text-muted-foreground">
                {format(new Date(error.timestamp), 'PPpp')}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="details" className="p-6 space-y-6">
              {/* Error Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Error Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="font-mono text-sm">
                      {error.message}
                    </AlertDescription>
                  </Alert>
                  {error.code && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline">Code: {error.code}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Error Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Classification</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Category</span>
                      <Badge variant="secondary" className="capitalize">
                        {error.category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Source</span>
                      <Badge variant="secondary" className="capitalize">
                        {error.source.replace('-', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Severity</span>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(error.severity)}
                        <span className="capitalize">{error.severity}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Impact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">User Impact</span>
                      <div className="flex items-center gap-2">
                        {getImpactIcon(error.impact.userImpact)}
                        <span className="capitalize">{error.impact.userImpact}</span>
                      </div>
                    </div>
                    {error.impact.affectedUsers && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Affected Users</span>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{error.impact.affectedUsers}</span>
                        </div>
                      </div>
                    )}
                    {error.impact.functionalityImpact.length > 0 && (
                      <div className="pt-2">
                        <span className="text-sm text-muted-foreground">Affected Features</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {error.impact.functionalityImpact.map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Stack Trace */}
              {error.stack && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Stack Trace</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyError}
                        className="gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Tags */}
              {error.tags && error.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {error.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="context" className="p-6 space-y-6">
              {/* Context Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Context Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {error.context.component && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Component</span>
                        <code className="text-sm font-mono">{error.context.component}</code>
                      </div>
                    )}
                    {error.context.operation && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Operation</span>
                        <code className="text-sm font-mono">{error.context.operation}</code>
                      </div>
                    )}
                    {error.context.userId && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">User ID</span>
                        <code className="text-sm font-mono">{error.context.userId}</code>
                      </div>
                    )}
                    {error.context.sessionId && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Session ID</span>
                        <code className="text-sm font-mono">{error.context.sessionId}</code>
                      </div>
                    )}
                    {error.context.environment && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Environment</span>
                        <Badge variant="outline">{error.context.environment}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Additional Details */}
              {error.details && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(error.details, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Prevention Suggestion */}
              {error.preventionSuggestion && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Prevention Suggestion
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{error.preventionSuggestion}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="related" className="p-6 space-y-6">
              {/* Related Errors */}
              {relatedErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Related Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {relatedErrors.map((relatedError) => (
                        <div
                          key={relatedError.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            // Switch to the related error
                            onClose();
                            setTimeout(() => {
                              useErrorTrackingStore.getState().selectError(relatedError.id);
                              useErrorTrackingStore.getState().toggleErrorDetailsModal();
                            }, 300);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {getSeverityIcon(relatedError.severity)}
                            <div>
                              <p className="text-sm font-medium line-clamp-1">
                                {relatedError.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(relatedError.timestamp, { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Similar Errors */}
              {similarErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Similar Errors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {similarErrors.slice(0, 5).map((similarError) => (
                        <div
                          key={similarError.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            // Switch to the similar error
                            onClose();
                            setTimeout(() => {
                              useErrorTrackingStore.getState().selectError(similarError.id);
                              useErrorTrackingStore.getState().toggleErrorDetailsModal();
                            }, 300);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {getSeverityIcon(similarError.severity)}
                            <div>
                              <p className="text-sm font-medium line-clamp-1">
                                {similarError.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(similarError.timestamp, { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="actions" className="p-6 space-y-6">
              {/* Resolution Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resolution Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {error.resolved ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Resolved</span>
                      </div>
                      {error.resolvedAt && (
                        <div className="text-sm text-muted-foreground">
                          Resolved {formatDistanceToNow(error.resolvedAt, { addSuffix: true })}
                        </div>
                      )}
                      {error.resolutionMethod && (
                        <Badge variant="secondary" className="capitalize">
                          {error.resolutionMethod}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Unresolved</span>
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="resolution-notes">Resolution Notes</Label>
                        <Textarea
                          id="resolution-notes"
                          placeholder="Add notes about how this error was resolved..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleResolve('manual')}
                          className="flex-1"
                        >
                          Mark as Resolved
                        </Button>
                        {error.retryCount !== undefined && error.retryCount < (error.maxRetries || 3) && (
                          <Button
                            variant="outline"
                            onClick={() => retryError(error.id)}
                            className="gap-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Retry
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => handleResolve('ignore')}
                        >
                          Ignore
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter tag name..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                      Add Tag
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Learning Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Learning Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {error.learningNote && (
                      <Alert>
                        <MessageSquare className="h-4 w-4" />
                        <AlertDescription>{error.learningNote}</AlertDescription>
                      </Alert>
                    )}
                    <Label htmlFor="learning-note">Add Learning Note</Label>
                    <Textarea
                      id="learning-note"
                      placeholder="What can we learn from this error to prevent it in the future?"
                      value={learningNote}
                      onChange={(e) => setLearningNote(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={handleAddLearning}
                      disabled={!learningNote.trim()}
                      className="w-full"
                    >
                      Save Learning Note
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};