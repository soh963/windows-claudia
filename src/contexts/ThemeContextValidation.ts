// Theme Context Validation Script
// This validates that React and hooks are properly available

import React from 'react';

export function validateThemeContextDependencies(): boolean {
  try {
    console.log('🔍 Validating React and hooks availability...');
    
    // Check React object
    if (!React || typeof React !== 'object') {
      console.error('❌ React is not properly imported');
      return false;
    }
    console.log('✅ React object is available');
    
    // Check individual hooks
    const hooks = ['useState', 'useEffect', 'useContext', 'useCallback', 'createContext'];
    for (const hook of hooks) {
      if (typeof React[hook as keyof typeof React] !== 'function') {
        console.error(`❌ React.${hook} is not available`);
        return false;
      }
    }
    console.log('✅ All required React hooks are available');
    
    // Check if we're in a proper React environment
    if (typeof document === 'undefined') {
      console.warn('⚠️ Running in non-DOM environment (likely server-side)');
    } else {
      console.log('✅ Running in browser environment');
    }
    
    console.log('🎉 All Theme Context dependencies validated successfully');
    return true;
  } catch (error) {
    console.error('💥 Validation failed:', error);
    return false;
  }
}

// Auto-validate on import
if (typeof window !== 'undefined') {
  // Only validate in browser environment
  setTimeout(() => {
    validateThemeContextDependencies();
  }, 0);
}