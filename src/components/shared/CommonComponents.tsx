/**
 * Common Reusable Components
 * Eliminates duplication across the application
 */

import React, { memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  cn, 
  typography, 
  spacing, 
  animations, 
  transitions,
  buttonVariants 
} from '@/lib/ui-utils';

/**
 * Loading State Component
 */
export const LoadingState = memo<{
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}>(({ message = "Loading...", size = 'md', fullScreen = false }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={cn("animate-spin text-muted-foreground", sizeClasses[size])} />
      {message && (
        <p className={cn(typography.muted)}>{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        {content}
      </div>
    );
  }

  return content;
});

LoadingState.displayName = 'LoadingState';

/**
 * Error State Component
 */
export const ErrorState = memo<{
  error: string | Error;
  onRetry?: () => void;
  fullScreen?: boolean;
}>(({ error, onRetry, fullScreen = false }) => {
  const errorMessage = typeof error === 'string' ? error : error.message;

  const content = (
    <Card className={cn(spacing.md, "border-destructive/50 bg-destructive/10")}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <p className={cn(typography.small, "text-destructive font-medium")}>
            Error occurred
          </p>
          <p className={cn(typography.small, "text-destructive/80")}>
            {errorMessage}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2"
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-8 bg-background/80 backdrop-blur-sm z-50">
        {content}
      </div>
    );
  }

  return content;
});

ErrorState.displayName = 'ErrorState';

/**
 * Empty State Component
 */
export const EmptyState = memo<{
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}>(({ title, description, icon, action }) => {
  return (
    <motion.div
      {...animations.fadeIn}
      transition={transitions.normal}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className={cn(typography.h4, "mb-2")}>{title}</h3>
      {description && (
        <p className={cn(typography.muted, "max-w-md mb-4")}>
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';

/**
 * Status Message Component
 */
type StatusType = 'info' | 'success' | 'warning' | 'error';

export const StatusMessage = memo<{
  type: StatusType;
  message: string;
  onClose?: () => void;
  autoClose?: number;
}>(({ type, message, onClose, autoClose }) => {
  const icons = {
    info: <Info className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    warning: <AlertCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
  };

  const styles = {
    info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    success: 'bg-green-500/10 text-green-600 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  return (
    <motion.div
      {...animations.slideIn}
      transition={transitions.fast}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-md border",
        styles[type]
      )}
    >
      <span className="flex-shrink-0">{icons[type]}</span>
      <span className={typography.small}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-auto flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
});

StatusMessage.displayName = 'StatusMessage';

/**
 * Section Header Component
 */
export const SectionHeader = memo<{
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}>(({ title, description, action, className }) => {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="space-y-1">
        <h2 className={typography.h3}>{title}</h2>
        {description && (
          <p className={typography.muted}>{description}</p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0 ml-4">
          {action}
        </div>
      )}
    </div>
  );
});

SectionHeader.displayName = 'SectionHeader';

/**
 * Animated List Component
 */
export const AnimatedList = memo<{
  items: Array<{ id: string; content: ReactNode }>;
  className?: string;
}>(({ items, className }) => {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div className={cn("space-y-2", className)}>
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              ...transitions.fast,
              delay: index * 0.05,
            }}
          >
            {item.content}
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
});

AnimatedList.displayName = 'AnimatedList';

/**
 * Collapsible Section Component
 */
export const CollapsibleSection = memo<{
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}>(({ title, children, defaultOpen = false, className }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <span className={typography.h4}>{title}</span>
        <ChevronRight 
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transitions.normal}
            className="overflow-hidden"
          >
            <div className={spacing.md}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

CollapsibleSection.displayName = 'CollapsibleSection';

/**
 * Progress Indicator Component
 */
export const ProgressIndicator = memo<{
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}>(({ value, max = 100, label, showPercentage = true, size = 'md' }) => {
  const percentage = Math.min(100, (value / max) * 100);
  
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="space-y-2">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className={typography.small}>{label}</span>
          )}
          {showPercentage && (
            <span className={typography.muted}>{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div className={cn("bg-secondary rounded-full overflow-hidden", heights[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={transitions.normal}
          className="h-full bg-primary"
        />
      </div>
    </div>
  );
});

ProgressIndicator.displayName = 'ProgressIndicator';

// Import for ChevronRight
import { ChevronRight } from 'lucide-react';