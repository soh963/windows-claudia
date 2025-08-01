import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, Plus, MessageSquare, Bot, AlertCircle, Loader2, Folder, BarChart, Server, Settings, FileText, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTabState } from '@/hooks/useTabState';
import { Tab } from '@/contexts/TabContext';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/responsive';
import { buttonVariants } from '@/lib/animations';

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onClose: (id: string) => void;
  onClick: (id: string) => void;
}

const TabItem: React.FC<TabItemProps> = ({ tab, isActive, onClose, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();
  
  const getIcon = () => {
    switch (tab.type) {
      case 'chat':
        return MessageSquare;
      case 'agent':
        return Bot;
      case 'projects':
        return Folder;
      case 'usage':
        return BarChart;
      case 'mcp':
        return Server;
      case 'settings':
        return Settings;
      case 'dashboard':
        return Activity;
      case 'claude-md':
      case 'claude-file':
        return FileText;
      case 'agent-execution':
        return Bot;
      case 'create-agent':
        return Plus;
      case 'import-agent':
        return Plus;
      default:
        return MessageSquare;
    }
  };

  const getStatusIcon = () => {
    switch (tab.status) {
      case 'running':
        return <Loader2 className={cn("animate-spin", isMobile ? "w-4 h-4" : "w-3 h-3")} />;
      case 'error':
        return <AlertCircle className={cn("text-red-500", isMobile ? "w-4 h-4" : "w-3 h-3")} />;
      default:
        return null;
    }
  };

  const Icon = getIcon();
  const statusIcon = getStatusIcon();

  return (
    <Reorder.Item
      value={tab}
      id={tab.id}
      className={cn(
        "relative flex items-center gap-2 text-sm cursor-pointer select-none",
        "border-b-2 transition-all duration-200",
        isActive
          ? "border-blue-500 bg-background text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
        // Responsive sizing
        isMobile ? "px-2 py-2 min-w-[100px] max-w-[150px]" : "px-3 py-1.5 min-w-[120px] max-w-[200px]",
        // Enhanced touch targets on mobile
        isMobile && "min-h-12"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(tab.id)}
      whileHover={{ y: isMobile ? 0 : -1 }}
      whileTap={{ scale: isMobile ? 0.95 : 0.98 }}
    >
      <Icon className={cn("flex-shrink-0", isMobile ? "w-5 h-5" : "w-4 h-4")} />
      
      <span className={cn("flex-1 truncate", isMobile ? "text-sm" : "text-sm")}>
        {tab.title}
      </span>

      {statusIcon && (
        <span className="flex-shrink-0">
          {statusIcon}
        </span>
      )}

      {tab.hasUnsavedChanges && (
        <span className={cn("bg-blue-500 rounded-full flex-shrink-0", isMobile ? "w-3 h-3" : "w-2 h-2")} />
      )}

      <AnimatePresence>
        {(isHovered || isActive || isMobile) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            className={cn(
              "flex-shrink-0 rounded hover:bg-muted-foreground/20",
              "transition-colors duration-150",
              isMobile ? "p-1" : "p-0.5",
              isMobile && "min-w-8 min-h-8"
            )}
          >
            <X className={cn(isMobile ? "w-4 h-4" : "w-3 h-3")} />
          </motion.button>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
};

interface TabManagerProps {
  className?: string;
}

export const TabManager: React.FC<TabManagerProps> = ({ className }) => {
  const {
    tabs,
    activeTabId,
    createChatTab,
    createProjectsTab,
    closeTab,
    switchToTab,
    canAddTab
  } = useTabState();

  const isMobile = useIsMobile();
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  // Listen for tab switch events
  useEffect(() => {
    const handleSwitchToTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      switchToTab(tabId);
    };

    window.addEventListener('switch-to-tab', handleSwitchToTab as EventListener);
    return () => {
      window.removeEventListener('switch-to-tab', handleSwitchToTab as EventListener);
    };
  }, [switchToTab]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleCreateTab = () => {
      createChatTab();
    };

    const handleCloseTab = async () => {
      if (activeTabId) {
        await closeTab(activeTabId);
      }
    };

    const handleNextTab = () => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (tabs[nextIndex]) {
        switchToTab(tabs[nextIndex].id);
      }
    };

    const handlePreviousTab = () => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      if (tabs[previousIndex]) {
        switchToTab(tabs[previousIndex].id);
      }
    };

    const handleTabByIndex = (event: CustomEvent) => {
      const { index } = event.detail;
      if (tabs[index]) {
        switchToTab(tabs[index].id);
      }
    };

    window.addEventListener('create-chat-tab', handleCreateTab);
    window.addEventListener('close-current-tab', handleCloseTab);
    window.addEventListener('switch-to-next-tab', handleNextTab);
    window.addEventListener('switch-to-previous-tab', handlePreviousTab);
    window.addEventListener('switch-to-tab-by-index', handleTabByIndex as EventListener);

    return () => {
      window.removeEventListener('create-chat-tab', handleCreateTab);
      window.removeEventListener('close-current-tab', handleCloseTab);
      window.removeEventListener('switch-to-next-tab', handleNextTab);
      window.removeEventListener('switch-to-previous-tab', handlePreviousTab);
      window.removeEventListener('switch-to-tab-by-index', handleTabByIndex as EventListener);
    };
  }, [tabs, activeTabId, createChatTab, closeTab, switchToTab]);

  // Check scroll buttons visibility
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollButtons);
    window.addEventListener('resize', checkScrollButtons);

    return () => {
      container.removeEventListener('scroll', checkScrollButtons);
      window.removeEventListener('resize', checkScrollButtons);
    };
  }, [tabs]);

  const handleReorder = (newOrder: Tab[]) => {
    // This will be handled by the context when we implement reorderTabs
    console.log('Reorder tabs:', newOrder);
  };

  const handleCloseTab = async (id: string) => {
    await closeTab(id);
  };

  const handleNewTab = () => {
    if (canAddTab()) {
      createProjectsTab();
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newScrollLeft = direction === 'left'
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  return (
    <motion.div 
      className={cn(
        "flex items-center bg-muted/30 border-b backdrop-blur-sm",
        isMobile ? "px-2 py-1" : "px-0 py-0",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Left scroll button */}
      <AnimatePresence>
        {showLeftScroll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollTabs('left')}
            className={cn(
              "hover:bg-muted rounded-sm transition-colors",
              isMobile ? "p-2" : "p-1"
            )}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <ChevronLeft className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 flex overflow-x-auto scrollbar-hide",
          isMobile ? "mx-1" : "mx-0"
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <Reorder.Group
          axis="x"
          values={tabs}
          onReorder={handleReorder}
          className="flex items-stretch"
        >
          <AnimatePresence initial={false}>
            {tabs.map((tab) => (
              <motion.div
                key={tab.id}
                layout
                initial={{ opacity: 0, scale: 0.8, x: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <TabItem
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onClose={handleCloseTab}
                  onClick={switchToTab}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      </div>

      {/* Right scroll button */}
      <AnimatePresence>
        {showRightScroll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollTabs('right')}
            className={cn(
              "hover:bg-muted rounded-sm transition-colors",
              isMobile ? "p-2" : "p-1"
            )}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            <ChevronRight className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* New tab button */}
      <motion.button
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
        onClick={handleNewTab}
        disabled={!canAddTab()}
        className={cn(
          "rounded-sm transition-all duration-200",
          canAddTab()
            ? "hover:bg-muted text-muted-foreground hover:text-foreground"
            : "opacity-50 cursor-not-allowed",
          isMobile ? "p-2 mx-1" : "p-1.5 mx-2",
          isMobile && "min-w-10 min-h-10"
        )}
        title={canAddTab() ? "Browse projects" : "Maximum tabs reached"}
      >
        <Plus className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
      </motion.button>
    </motion.div>
  );
};

export default TabManager;