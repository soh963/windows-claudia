<script lang="ts">
  import { type ErrorMetrics } from '$lib/stores/errorTrackerStore';
  
  export let metrics: ErrorMetrics;
  
  // Calculate percentages for visualization
  $: categoryData = Object.entries(metrics.errors_by_category).map(([category, count]) => ({
    category,
    count,
    percentage: (count / metrics.total_errors) * 100
  })).sort((a, b) => b.count - a.count);
  
  $: severityData = Object.entries(metrics.errors_by_severity).map(([severity, count]) => ({
    severity,
    count,
    percentage: (count / metrics.total_errors) * 100
  })).sort((a, b) => b.count - a.count);
  
  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'Critical':
        return 'bg-red-500';
      case 'High':
        return 'bg-orange-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  }
  
  function getCategoryColor(index: number) {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-gray-500'
    ];
    return colors[index % colors.length];
  }
</script>

<div class="space-y-6">
  <!-- Severity Distribution -->
  <div>
    <h4 class="text-sm font-medium mb-3">By Severity</h4>
    <div class="space-y-2">
      {#each severityData as item}
        <div class="flex items-center gap-2">
          <div class="w-20 text-sm text-muted-foreground">{item.severity}</div>
          <div class="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
            <div
              class="{getSeverityColor(item.severity)} h-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
              style="width: {item.percentage}%"
            >
              {#if item.percentage > 10}
                <span class="text-xs text-white font-medium">
                  {item.count}
                </span>
              {/if}
            </div>
            {#if item.percentage <= 10 && item.count > 0}
              <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {item.count}
              </span>
            {/if}
          </div>
          <div class="w-12 text-sm text-right text-muted-foreground">
            {item.percentage.toFixed(0)}%
          </div>
        </div>
      {:else}
        <p class="text-sm text-muted-foreground">No data available</p>
      {/each}
    </div>
  </div>
  
  <!-- Category Distribution -->
  <div>
    <h4 class="text-sm font-medium mb-3">By Category</h4>
    <div class="space-y-2">
      {#each categoryData.slice(0, 5) as item, index}
        <div class="flex items-center gap-2">
          <div class="w-32 text-sm text-muted-foreground truncate" title={item.category}>
            {item.category}
          </div>
          <div class="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
            <div
              class="{getCategoryColor(index)} h-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
              style="width: {item.percentage}%"
            >
              {#if item.percentage > 10}
                <span class="text-xs text-white font-medium">
                  {item.count}
                </span>
              {/if}
            </div>
            {#if item.percentage <= 10 && item.count > 0}
              <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {item.count}
              </span>
            {/if}
          </div>
          <div class="w-12 text-sm text-right text-muted-foreground">
            {item.percentage.toFixed(0)}%
          </div>
        </div>
      {:else}
        <p class="text-sm text-muted-foreground">No data available</p>
      {/each}
      
      {#if categoryData.length > 5}
        <p class="text-xs text-muted-foreground mt-2">
          +{categoryData.length - 5} more categories
        </p>
      {/if}
    </div>
  </div>
  
  <!-- Resolution Stats -->
  <div class="grid grid-cols-2 gap-4 pt-4 border-t">
    <div>
      <p class="text-xs text-muted-foreground mb-1">Resolution Rate</p>
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-muted rounded-full h-2 overflow-hidden">
          <div
            class="bg-green-500 h-full transition-all duration-500"
            style="width: {metrics.resolution_rate}%"
          />
        </div>
        <span class="text-sm font-medium">{metrics.resolution_rate.toFixed(1)}%</span>
      </div>
    </div>
    
    <div>
      <p class="text-xs text-muted-foreground mb-1">Auto-Resolution</p>
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-muted rounded-full h-2 overflow-hidden">
          <div
            class="bg-blue-500 h-full transition-all duration-500"
            style="width: {metrics.auto_resolution_rate}%"
          />
        </div>
        <span class="text-sm font-medium">{metrics.auto_resolution_rate.toFixed(1)}%</span>
      </div>
    </div>
  </div>
</div>