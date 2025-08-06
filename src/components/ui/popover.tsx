import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PopoverProps {
  /**
   * The trigger element
   */
  trigger: React.ReactNode;
  /**
   * The content to display in the popover
   */
  content: React.ReactNode;
  /**
   * Whether the popover is open
   */
  open?: boolean;
  /**
   * Callback when the open state changes
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Optional className for the content
   */
  className?: string;
  /**
   * Alignment of the popover relative to the trigger
   */
  align?: "start" | "center" | "end";
  /**
   * Side of the trigger to display the popover
   */
  side?: "top" | "bottom" | "auto";
  /**
   * Offset from the trigger in pixels
   */
  sideOffset?: number;
  /**
   * Maximum height for the popover content
   */
  maxHeight?: string | number;
}

/**
 * Popover component for displaying floating content
 * 
 * @example
 * <Popover
 *   trigger={<Button>Click me</Button>}
 *   content={<div>Popover content</div>}
 *   side="top"
 * />
 */
export const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  open: controlledOpen,
  onOpenChange,
  className,
  align = "center",
  side = "auto",
  sideOffset = 5,
  maxHeight,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [actualSide, setActualSide] = React.useState<"top" | "bottom">("bottom");
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        contentRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, setOpen]);
  
  // Calculate position and detect viewport boundaries
  React.useEffect(() => {
    if (!open || !triggerRef.current || !contentRef.current) return;
    
    const calculatePosition = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      const contentRect = contentRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Determine actual side based on available space
      let calculatedSide: "top" | "bottom" = "bottom";
      if (side === "auto") {
        const spaceBelow = viewportHeight - triggerRect.bottom - sideOffset;
        const spaceAbove = triggerRect.top - sideOffset;
        
        calculatedSide = spaceBelow >= contentRect.height || spaceBelow > spaceAbove ? "bottom" : "top";
      } else {
        calculatedSide = side as "top" | "bottom";
      }
      
      setActualSide(calculatedSide);
      
      // Calculate horizontal position
      let left = 0;
      if (align === "start") {
        left = triggerRect.left;
      } else if (align === "center") {
        left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
      } else if (align === "end") {
        left = triggerRect.right - contentRect.width;
      }
      
      // Ensure content stays within viewport horizontally
      if (left < 0) left = 0;
      if (left + contentRect.width > viewportWidth) {
        left = viewportWidth - contentRect.width - 10;
      }
      
      // Calculate vertical position
      let top = 0;
      if (calculatedSide === "bottom") {
        top = triggerRect.bottom + sideOffset;
        // Ensure content doesn't go beyond viewport bottom
        if (top + contentRect.height > viewportHeight) {
          top = viewportHeight - contentRect.height - 10;
        }
      } else {
        top = triggerRect.top - contentRect.height - sideOffset;
        // Ensure content doesn't go beyond viewport top
        if (top < 0) {
          top = 10;
        }
      }
      
      setPosition({ top, left });
    };
    
    calculatePosition();
    
    // Recalculate on scroll or resize
    window.addEventListener("scroll", calculatePosition, true);
    window.addEventListener("resize", calculatePosition);
    
    return () => {
      window.removeEventListener("scroll", calculatePosition, true);
      window.removeEventListener("resize", calculatePosition);
    };
  }, [open, align, side, sideOffset]);
  
  // Close on escape
  React.useEffect(() => {
    if (!open) return;
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, setOpen]);
  
  const animationY = actualSide === "top" ? { initial: 10, exit: 10 } : { initial: -10, exit: -10 };
  
  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </div>
      
      <AnimatePresence>
        {open && (
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, scale: 0.95, y: animationY.initial }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: animationY.exit }}
            transition={{ duration: 0.15 }}
            className={cn(
              "fixed z-50 min-w-[200px] rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md",
              className
            )}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              maxHeight: maxHeight || "calc(100vh - 20px)",
              overflowY: maxHeight ? "auto" : "visible"
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}; 