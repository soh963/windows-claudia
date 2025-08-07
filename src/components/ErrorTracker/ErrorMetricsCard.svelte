<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$components/ui/card';
  import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';
  
  export let title: string;
  export let value: string | number;
  export let description: string = '';
  export let variant: 'default' | 'success' | 'warning' | 'error' | 'info' = 'default';
  export let trend: 'up' | 'down' | 'neutral' | null = null;
  export let trendValue: string | null = null;

  $: variantClasses = {
    default: 'border-gray-200',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    error: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50'
  }[variant];

  $: valueClasses = {
    default: 'text-gray-900',
    success: 'text-green-700',
    warning: 'text-yellow-700',
    error: 'text-red-700',
    info: 'text-blue-700'
  }[variant];

  $: trendClasses = {
    up: 'text-red-600',
    down: 'text-green-600',
    neutral: 'text-gray-600'
  }[trend || 'neutral'];
</script>

<Card class={variantClasses}>
  <CardHeader class="pb-2">
    <CardTitle class="text-sm font-medium text-muted-foreground">
      {title}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div class="flex items-end justify-between">
      <div>
        <div class="text-2xl font-bold {valueClasses}">
          {value}
        </div>
        {#if description}
          <CardDescription class="mt-1">
            {description}
          </CardDescription>
        {/if}
      </div>
      
      {#if trend && trendValue}
        <div class="flex items-center gap-1 {trendClasses}">
          {#if trend === 'up'}
            <TrendingUp class="w-4 h-4" />
          {:else if trend === 'down'}
            <TrendingDown class="w-4 h-4" />
          {:else}
            <Minus class="w-4 h-4" />
          {/if}
          <span class="text-sm font-medium">{trendValue}</span>
        </div>
      {/if}
    </div>
  </CardContent>
</Card>