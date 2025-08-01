import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadingVariants } from '@/lib/animations';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'dots' | 'pulse' | 'bars';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className,
  size = 'md',
  variant = 'default',
}) => {
  const sizeClass = sizeClasses[size];

  if (variant === 'dots') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={cn('bg-current rounded-full', size === 'sm' ? 'h-1 w-1' : size === 'md' ? 'h-2 w-2' : 'h-3 w-3')}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <motion.div
        className={cn('bg-current rounded-full', sizeClass, className)}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      />
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className={cn('bg-current', size === 'sm' ? 'w-0.5 h-3' : size === 'md' ? 'w-1 h-4' : 'w-1.5 h-6')}
            animate={{
              scaleY: [1, 1.5, 1],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(sizeClass, className)}
      variants={loadingVariants}
      initial="start"
      animate="end"
    >
      <Loader2 className="h-full w-full" />
    </motion.div>
  );
};

interface LoadingStateProps {
  message?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'card';
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  className,
  variant = 'default',
  size = 'md',
}) => {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <LoadingSpinner size={size} />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <motion.div
        className={cn(
          'flex flex-col items-center justify-center p-8 bg-card border rounded-lg space-y-4',
          className
        )}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <LoadingSpinner size={size} />
        <p className="text-sm text-muted-foreground">{message}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn('flex flex-col items-center justify-center space-y-4', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <LoadingSpinner size={size} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </motion.div>
  );
};

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  show,
  message = 'Loading...',
  className,
}) => {
  if (!show) return null;

  return (
    <motion.div
      className={cn(
        'absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <LoadingState message={message} variant="card" />
    </motion.div>
  );
};

interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  children,
  className,
  variant = 'default',
  size = 'md',
  disabled,
  onClick,
}) => {
  const buttonClasses = cn(
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-200',
    'disabled:pointer-events-none disabled:opacity-50',
    {
      'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
      'border border-input bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline',
      'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
      'h-8 px-3 text-xs': size === 'sm',
      'h-9 px-4 py-2': size === 'md',
      'h-10 px-8': size === 'lg',
    },
    className
  );

  return (
    <motion.button
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={{ scale: loading ? 1 : 1.02 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
    >
      <motion.div
        className="flex items-center space-x-2"
        animate={loading ? { opacity: 0.7 } : { opacity: 1 }}
      >
        {loading && <LoadingSpinner size="sm" />}
        <span>{children}</span>
      </motion.div>
    </motion.button>
  );
};

// Progress loading component
interface ProgressLoadingProps {
  progress: number;
  message?: string;
  className?: string;
}

export const ProgressLoading: React.FC<ProgressLoadingProps> = ({
  progress,
  message,
  className,
}) => {
  return (
    <motion.div
      className={cn('space-y-3', className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {message && <p className="text-sm text-muted-foreground text-center">{message}</p>}
      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
        <motion.div
          className="bg-primary h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
    </motion.div>
  );
};