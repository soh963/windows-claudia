<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { errorTrackerStore, criticalErrors, unresolvedErrors, recurringErrors, type ErrorMetrics, type ErrorEntry, ErrorSeverity, ErrorCategory, ErrorStatus } from '$lib/stores/errorTrackerStore';
  import ErrorMetricsCard from './ErrorMetricsCard.svelte';
  import ErrorList from './ErrorList.svelte';
  import ErrorDetails from './ErrorDetails.svelte';
  import ErrorChart from './ErrorChart.svelte';
  import { Button } from '$components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$components/ui/tabs';
  import { Badge } from '$components/ui/badge';
  import { Input } from '$components/ui/input';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$components/ui/select';
  import { AlertCircle, CheckCircle, XCircle, RefreshCw, Activity, Shield, Search } from 'lucide-svelte';

  let metrics: ErrorMetrics | null = null;
  let selectedError: ErrorEntry | null = null;
  let searchText = '';
  let selectedCategory: ErrorCategory | 'all' = 'all';
  let selectedSeverity: ErrorSeverity | 'all' = 'all';
  let selectedStatus: ErrorStatus | 'all' = 'all';
  let timeRange = 24; // hours
  let autoRefresh = true;
  let refreshInterval: number;

  const unsubscribe = errorTrackerStore.subscribe(state => {
    metrics = state.metrics;
    selectedError = state.selectedError;
  });

  onMount(async () => {
    await errorTrackerStore.initialize();
    
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        errorTrackerStore.loadMetrics(timeRange);
        errorTrackerStore.loadErrors({
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          severity: selectedSeverity !== 'all' ? selectedSeverity : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          search_text: searchText || undefined
        });
      }, 30000); // Refresh every 30 seconds
    }
  });

  onDestroy(() => {
    unsubscribe();
    errorTrackerStore.cleanup();
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function handleSearch() {
    await errorTrackerStore.loadErrors({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      severity: selectedSeverity !== 'all' ? selectedSeverity : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      search_text: searchText || undefined
    });
  }

  async function handleTimeRangeChange(hours: number) {
    timeRange = hours;
    await errorTrackerStore.loadMetrics(hours);
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        errorTrackerStore.loadMetrics(timeRange);
        handleSearch();
      }, 30000);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  }

  function getSeverityColor(severity: ErrorSeverity) {
    switch (severity) {
      case ErrorSeverity.Critical:
        return 'text-red-600 bg-red-100';
      case ErrorSeverity.High:
        return 'text-orange-600 bg-orange-100';
      case ErrorSeverity.Medium:
        return 'text-yellow-600 bg-yellow-100';
      case ErrorSeverity.Low:
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
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
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b">
    <div class="flex items-center gap-2">
      <Shield class="w-6 h-6 text-primary" />
      <h2 class="text-2xl font-semibold">Error Tracking Dashboard</h2>
    </div>
    
    <div class="flex items-center gap-2">
      <Button
        variant={autoRefresh ? 'default' : 'outline'}
        size="sm"
        on:click={toggleAutoRefresh}
      >
        <Activity class="w-4 h-4 mr-1" />
        {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        on:click={() => {
          errorTrackerStore.loadMetrics(timeRange);
          handleSearch();
        }}
      >
        <RefreshCw class="w-4 h-4" />
      </Button>
    </div>
  </div>

  <!-- Metrics Overview -->
  {#if metrics}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      <ErrorMetricsCard
        title="Total Errors"
        value={metrics.total_errors}
        description={`Last ${timeRange} hours`}
        variant="default"
      />
      <ErrorMetricsCard
        title="Resolution Rate"
        value={`${metrics.resolution_rate.toFixed(1)}%`}
        description={`${metrics.resolved_errors} resolved`}
        variant="success"
      />
      <ErrorMetricsCard
        title="Auto-Resolution"
        value={`${metrics.auto_resolution_rate.toFixed(1)}%`}
        description={`${metrics.auto_resolved_errors} auto-resolved`}
        variant="info"
      />
      <ErrorMetricsCard
        title="Recurring Errors"
        value={metrics.recurring_errors}
        description="Need attention"
        variant="warning"
      />
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 overflow-hidden">
    <Tabs defaultValue="overview" class="h-full">
      <TabsList class="mx-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="errors">All Errors</TabsTrigger>
        <TabsTrigger value="critical">Critical</TabsTrigger>
        <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
        <TabsTrigger value="recurring">Recurring</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" class="h-full p-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          <!-- Top Errors -->
          <Card>
            <CardHeader>
              <CardTitle>Top Errors</CardTitle>
              <CardDescription>Most frequent errors in the last {timeRange} hours</CardDescription>
            </CardHeader>
            <CardContent>
              {#if metrics?.top_errors}
                <div class="space-y-2">
                  {#each metrics.top_errors as error}
                    <div class="flex items-center justify-between p-2 rounded-lg border">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <Badge class={getSeverityColor(error.severity)}>
                            {error.severity}
                          </Badge>
                          <span class="font-medium text-sm">{error.title}</span>
                        </div>
                        <div class="text-xs text-muted-foreground mt-1">
                          {error.error_code} · {error.occurrences} occurrences
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        on:click={() => errorTrackerStore.getError(error.error_code)}
                      >
                        View
                      </Button>
                    </div>
                  {/each}
                </div>
              {/if}
            </CardContent>
          </Card>

          <!-- Error Distribution -->
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
              <CardDescription>Errors by category and severity</CardDescription>
            </CardHeader>
            <CardContent>
              {#if metrics}
                <ErrorChart {metrics} />
              {/if}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="errors" class="h-full p-4">
        <!-- Search and Filters -->
        <div class="flex gap-2 mb-4">
          <div class="flex-1">
            <Input
              placeholder="Search errors..."
              bind:value={searchText}
              on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <Select bind:value={selectedCategory} on:change={handleSearch}>
            <SelectTrigger class="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {#each Object.values(ErrorCategory) as category}
                <SelectItem value={category}>{category}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
          
          <Select bind:value={selectedSeverity} on:change={handleSearch}>
            <SelectTrigger class="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {#each Object.values(ErrorSeverity) as severity}
                <SelectItem value={severity}>{severity}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
          
          <Select bind:value={selectedStatus} on:change={handleSearch}>
            <SelectTrigger class="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {#each Object.values(ErrorStatus) as status}
                <SelectItem value={status}>{status}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
          
          <Button on:click={handleSearch}>
            <Search class="w-4 h-4 mr-1" />
            Search
          </Button>
        </div>
        
        <!-- Error List -->
        <ErrorList />
      </TabsContent>

      <TabsContent value="critical" class="h-full p-4">
        <ErrorList errors={$criticalErrors} title="Critical Errors" />
      </TabsContent>

      <TabsContent value="unresolved" class="h-full p-4">
        <ErrorList errors={$unresolvedErrors} title="Unresolved Errors" />
      </TabsContent>

      <TabsContent value="recurring" class="h-full p-4">
        <ErrorList errors={$recurringErrors} title="Recurring Errors" />
      </TabsContent>

      <TabsContent value="analytics" class="h-full p-4">
        <!-- Time Range Selector -->
        <div class="flex gap-2 mb-4">
          <Button
            variant={timeRange === 1 ? 'default' : 'outline'}
            size="sm"
            on:click={() => handleTimeRangeChange(1)}
          >
            1 Hour
          </Button>
          <Button
            variant={timeRange === 6 ? 'default' : 'outline'}
            size="sm"
            on:click={() => handleTimeRangeChange(6)}
          >
            6 Hours
          </Button>
          <Button
            variant={timeRange === 24 ? 'default' : 'outline'}
            size="sm"
            on:click={() => handleTimeRangeChange(24)}
          >
            24 Hours
          </Button>
          <Button
            variant={timeRange === 168 ? 'default' : 'outline'}
            size="sm"
            on:click={() => handleTimeRangeChange(168)}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === 720 ? 'default' : 'outline'}
            size="sm"
            on:click={() => handleTimeRangeChange(720)}
          >
            30 Days
          </Button>
        </div>
        
        {#if metrics}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Error Trends -->
            <Card>
              <CardHeader>
                <CardTitle>Error Trends</CardTitle>
                <CardDescription>Error occurrence over time</CardDescription>
              </CardHeader>
              <CardContent>
                <!-- Add time-series chart here -->
              </CardContent>
            </Card>
            
            <!-- Resolution Performance -->
            <Card>
              <CardHeader>
                <CardTitle>Resolution Performance</CardTitle>
                <CardDescription>Mean time to resolution: {metrics.mean_time_to_resolution ? `${Math.round(metrics.mean_time_to_resolution / 3600)} hours` : 'N/A'}</CardDescription>
              </CardHeader>
              <CardContent>
                <!-- Add resolution performance chart here -->
              </CardContent>
            </Card>
          </div>
        {/if}
      </TabsContent>
    </Tabs>
  </div>

  <!-- Error Details Modal -->
  {#if selectedError}
    <ErrorDetails error={selectedError} on:close={() => selectedError = null} />
  {/if}
</div>

<style>
  /* Custom styles if needed */
</style>