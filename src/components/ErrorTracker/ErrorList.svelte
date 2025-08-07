<script lang="ts">
  import { errorTrackerStore, type ErrorEntry, ErrorSeverity, ErrorStatus } from '$lib/stores/errorTrackerStore';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
  import { Badge } from '$components/ui/badge';
  import { Button } from '$components/ui/button';
  import { ScrollArea } from '$components/ui/scroll-area';
  import { AlertCircle, CheckCircle, XCircle, RefreshCw, Clock, ChevronRight } from 'lucide-svelte';
  import { formatDistanceToNow } from 'date-fns';

  export let errors: ErrorEntry[] | null = null;
  export let title = 'Error List';
  export let showFilters = false;

  let errorList: ErrorEntry[] = [];
  
  $: {
    if (errors) {
      errorList = errors;
    } else {
      errorTrackerStore.subscribe(state => {
        errorList = state.errors;
      });
    }
  }

  function getSeverityColor(severity: ErrorSeverity) {
    switch (severity) {
      case ErrorSeverity.Critical:
        return 'bg-red-100 text-red-800 border-red-200';
      case ErrorSeverity.High:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case ErrorSeverity.Medium:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case ErrorSeverity.Low:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusIcon(status: ErrorStatus) {
    switch (status) {
      case ErrorStatus.Resolved:
      case ErrorStatus.AutoResolved:
        return CheckCircle;
      case ErrorStatus.Recurring:
        return RefreshCw;
      case ErrorStatus.New:
      case ErrorStatus.InProgress:
        return AlertCircle;
      default:
        return XCircle;
    }
  }

  function getStatusColor(status: ErrorStatus) {
    switch (status) {
      case ErrorStatus.Resolved:
      case ErrorStatus.AutoResolved:
        return 'text-green-600';
      case ErrorStatus.Recurring:
        return 'text-orange-600';
      case ErrorStatus.New:
        return 'text-blue-600';
      case ErrorStatus.InProgress:
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  }

  async function handleViewError(error: ErrorEntry) {
    await errorTrackerStore.getError(error.id);
  }

  async function handleResolveError(error: ErrorEntry) {
    await errorTrackerStore.resolveError(
      error.id,
      ErrorStatus.Resolved,
      'Manually resolved',
      ['User marked as resolved'],
      []
    );
  }
</script>

<Card class="h-full flex flex-col">
  <CardHeader>
    <CardTitle>{title}</CardTitle>
    <CardDescription>
      {errorList.length} error{errorList.length !== 1 ? 's' : ''} found
    </CardDescription>
  </CardHeader>
  
  <CardContent class="flex-1 overflow-hidden">
    <ScrollArea class="h-full">
      <div class="space-y-2">
        {#each errorList as error}
          <div class="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
            <!-- Error Header -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <Badge class={getSeverityColor(error.severity)}>
                    {error.severity}
                  </Badge>
                  <Badge variant="outline">
                    {error.category}
                  </Badge>
                  {#if error.auto_resolved}
                    <Badge variant="secondary" class="text-xs">
                      Auto-Resolved
                    </Badge>
                  {/if}
                </div>
                
                <h4 class="font-medium text-sm mb-1">{error.title}</h4>
                <p class="text-xs text-muted-foreground line-clamp-2">
                  {error.description}
                </p>
              </div>
              
              <div class="flex items-center gap-1">
                <svelte:component 
                  this={getStatusIcon(error.status)} 
                  class="w-4 h-4 {getStatusColor(error.status)}"
                />
              </div>
            </div>
            
            <!-- Error Metadata -->
            <div class="flex items-center justify-between mt-2 pt-2 border-t">
              <div class="flex items-center gap-4 text-xs text-muted-foreground">
                <div class="flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  {formatDistanceToNow(error.last_occurrence * 1000, { addSuffix: true })}
                </div>
                <div>
                  {error.occurrences} occurrence{error.occurrences !== 1 ? 's' : ''}
                </div>
                <div class="font-mono text-xs">
                  {error.error_code.slice(0, 8)}...
                </div>
              </div>
              
              <div class="flex items-center gap-1">
                {#if error.status !== ErrorStatus.Resolved && error.status !== ErrorStatus.AutoResolved}
                  <Button
                    variant="ghost"
                    size="sm"
                    on:click={() => handleResolveError(error)}
                  >
                    Resolve
                  </Button>
                {/if}
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={() => handleViewError(error)}
                >
                  <ChevronRight class="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        {:else}
          <div class="text-center py-8 text-muted-foreground">
            <AlertCircle class="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No errors found</p>
          </div>
        {/each}
      </div>
    </ScrollArea>
  </CardContent>
</Card>