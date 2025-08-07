<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { errorTrackerStore, type ErrorEntry, ErrorStatus } from '$lib/stores/errorTrackerStore';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$components/ui/dialog';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import { Button } from '$components/ui/button';
  import { Textarea } from '$components/ui/textarea';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$components/ui/tabs';
  import { ScrollArea } from '$components/ui/scroll-area';
  import { AlertCircle, CheckCircle, Copy, X, FileText, Code, Shield, Clock } from 'lucide-svelte';
  import { format } from 'date-fns';

  export let error: ErrorEntry;

  const dispatch = createEventDispatcher();
  
  let rootCause = error.root_cause || '';
  let resolutionSteps = error.resolution_steps.join('\n');
  let preventionStrategies = error.prevention_strategies.join('\n');
  let resolving = false;

  async function handleResolve() {
    resolving = true;
    try {
      await errorTrackerStore.resolveError(
        error.id,
        ErrorStatus.Resolved,
        rootCause || undefined,
        resolutionSteps ? resolutionSteps.split('\n').filter(s => s.trim()) : undefined,
        preventionStrategies ? preventionStrategies.split('\n').filter(s => s.trim()) : undefined
      );
      dispatch('close');
    } catch (err) {
      console.error('Failed to resolve error:', err);
    } finally {
      resolving = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<Dialog open={true} on:close={handleClose}>
  <DialogContent class="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle class="flex items-center justify-between">
        <span>Error Details</span>
        <Button variant="ghost" size="icon" on:click={handleClose}>
          <X class="w-4 h-4" />
        </Button>
      </DialogTitle>
      <DialogDescription>
        {error.error_code}
      </DialogDescription>
    </DialogHeader>

    <Tabs defaultValue="overview" class="flex-1 overflow-hidden">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="technical">Technical Details</TabsTrigger>
        <TabsTrigger value="resolution">Resolution</TabsTrigger>
        <TabsTrigger value="prevention">Prevention</TabsTrigger>
      </TabsList>

      <ScrollArea class="flex-1 mt-4">
        <TabsContent value="overview" class="space-y-4">
          <!-- Error Summary -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center justify-between">
                <span>{error.title}</span>
                <div class="flex items-center gap-2">
                  <Badge variant={error.auto_resolved ? 'secondary' : 'default'}>
                    {error.status}
                  </Badge>
                  <Badge variant="outline">{error.severity}</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-sm text-muted-foreground mb-4">{error.description}</p>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <h4 class="text-sm font-medium mb-1">Category</h4>
                  <p class="text-sm text-muted-foreground">{error.category}</p>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-1">Occurrences</h4>
                  <p class="text-sm text-muted-foreground">{error.occurrences}</p>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-1">First Occurred</h4>
                  <p class="text-sm text-muted-foreground">
                    {format(error.occurred_at * 1000, 'PPpp')}
                  </p>
                </div>
                <div>
                  <h4 class="text-sm font-medium mb-1">Last Occurred</h4>
                  <p class="text-sm text-muted-foreground">
                    {format(error.last_occurrence * 1000, 'PPpp')}
                  </p>
                </div>
                {#if error.resolved_at}
                  <div>
                    <h4 class="text-sm font-medium mb-1">Resolved At</h4>
                    <p class="text-sm text-muted-foreground">
                      {format(error.resolved_at * 1000, 'PPpp')}
                    </p>
                  </div>
                {/if}
                {#if error.session_id}
                  <div>
                    <h4 class="text-sm font-medium mb-1">Session ID</h4>
                    <p class="text-sm text-muted-foreground font-mono">{error.session_id}</p>
                  </div>
                {/if}
              </div>
            </CardContent>
          </Card>

          <!-- Context -->
          {#if Object.keys(error.context).length > 0}
            <Card>
              <CardHeader>
                <CardTitle class="text-sm">Context</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="space-y-2">
                  {#each Object.entries(error.context) as [key, value]}
                    <div class="flex justify-between text-sm">
                      <span class="font-medium">{key}:</span>
                      <span class="text-muted-foreground">{value}</span>
                    </div>
                  {/each}
                </div>
              </CardContent>
            </Card>
          {/if}
        </TabsContent>

        <TabsContent value="technical" class="space-y-4">
          <!-- Stack Trace -->
          {#if error.stack_trace}
            <Card>
              <CardHeader>
                <CardTitle class="flex items-center justify-between">
                  <span class="text-sm">Stack Trace</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => copyToClipboard(error.stack_trace || '')}
                  >
                    <Copy class="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre class="text-xs bg-muted p-2 rounded overflow-x-auto">
                  <code>{error.stack_trace}</code>
                </pre>
              </CardContent>
            </Card>
          {/if}

          <!-- Pattern Match -->
          {#if error.pattern_id}
            <Card>
              <CardHeader>
                <CardTitle class="text-sm">Pattern Match</CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-sm text-muted-foreground">
                  This error matched pattern: <span class="font-mono">{error.pattern_id}</span>
                </p>
                {#if error.auto_resolved}
                  <p class="text-sm text-green-600 mt-2">
                    ✓ Successfully auto-resolved using pattern-based strategy
                  </p>
                {/if}
              </CardContent>
            </Card>
          {/if}
        </TabsContent>

        <TabsContent value="resolution" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Root Cause Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                bind:value={rootCause}
                placeholder="Describe the root cause of this error..."
                class="min-h-[100px]"
                disabled={error.status === ErrorStatus.Resolved || error.status === ErrorStatus.AutoResolved}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Resolution Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                bind:value={resolutionSteps}
                placeholder="List the steps taken to resolve this error (one per line)..."
                class="min-h-[150px]"
                disabled={error.status === ErrorStatus.Resolved || error.status === ErrorStatus.AutoResolved}
              />
            </CardContent>
          </Card>

          {#if error.status !== ErrorStatus.Resolved && error.status !== ErrorStatus.AutoResolved}
            <div class="flex justify-end">
              <Button on:click={handleResolve} disabled={resolving}>
                {resolving ? 'Resolving...' : 'Mark as Resolved'}
              </Button>
            </div>
          {/if}
        </TabsContent>

        <TabsContent value="prevention" class="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Prevention Strategies</CardTitle>
              <CardDescription>
                Document strategies to prevent this error from recurring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                bind:value={preventionStrategies}
                placeholder="List prevention strategies (one per line)..."
                class="min-h-[200px]"
                disabled={error.status === ErrorStatus.Resolved || error.status === ErrorStatus.AutoResolved}
              />
            </CardContent>
          </Card>

          {#if error.status !== ErrorStatus.Resolved && error.status !== ErrorStatus.AutoResolved}
            <div class="flex justify-end">
              <Button on:click={handleResolve} disabled={resolving}>
                {resolving ? 'Saving...' : 'Save & Resolve'}
              </Button>
            </div>
          {/if}
        </TabsContent>
      </ScrollArea>
    </Tabs>
  </DialogContent>
</Dialog>