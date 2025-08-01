import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/lib/animations";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
  hoverable?: boolean;
}

/**
 * Card component - A container with consistent styling and sections
 * 
 * @example
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Card description</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     Content goes here
 *   </CardContent>
 *   <CardFooter>
 *     Footer content
 *   </CardFooter>
 * </Card>
 * 
 * @example
 * <Card animated hoverable>
 *   Interactive card with animations
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, animated = false, hoverable = false, ...props }, ref) => {
    const baseClasses = cn(
      "rounded-lg border shadow-xs transition-all duration-200",
      hoverable && "cursor-pointer",
      className
    );

    const baseStyle = {
      borderColor: "var(--color-border)",
      backgroundColor: "var(--color-card)",
      color: "var(--color-card-foreground)"
    };

    if (animated || hoverable) {
      // Separate HTML props from motion props to avoid conflicts
      const { 
        onDrag, onDragEnd, onDragStart, onDragEnter, onDragExit, onDragLeave, onDragOver, onDrop,
        onAnimationStart, onAnimationEnd, onAnimationIteration,
        ...htmlProps 
      } = props;
      return (
        <motion.div
          ref={ref}
          className={baseClasses}
          style={baseStyle}
          variants={cardVariants}
          initial="rest"
          whileHover={hoverable ? "hover" : undefined}
          whileTap={hoverable ? "tap" : undefined}
          {...htmlProps}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={baseClasses}
        style={baseStyle}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

/**
 * CardHeader component - Top section of a card
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * CardTitle component - Main title within CardHeader
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/**
 * CardDescription component - Descriptive text within CardHeader
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/**
 * CardContent component - Main content area of a card
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/**
 * CardFooter component - Bottom section of a card
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }; 