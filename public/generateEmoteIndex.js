// Ultimate animatedcursor.js - Supports both static and animated cursors
// Place this in public/animatedcursor.js
console.log('🎯 Loading Ultimate Animated Cursor System...');

(function() {
  // State management
  let animatedCursorEl = null;
  let currentCursorType = null; // 'static', 'animated', 'oneko', or null
  let currentCursorUrl = null;
  
  // Animation state
  let mousePosX = 0;
  let mousePosY = 0;
  let lastRequestId = null;
  let isGloballyStopped = true;
  let isHiddenByHover = false;
  
  // Configuration
  const CURSOR_ID = "ultimate-animated-cursor-element";
  const CURSOR_SIZE = 32;
  const INTERACTIVE_SELECTORS = 'button, a, input, textarea, select, [role="button"], .cursor-pointer, [onclick]';
  
  // Cursor positioning with smooth interpolation
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  const SMOOTHING = 0.15; // Lower = smoother, higher = more responsive

  function updatePosition() {
    if (animatedCursorEl && !isGloballyStopped && !isHiddenByHover) {
      // Smooth cursor movement
      currentX += (targetX - currentX) * SMOOTHING;
      currentY += (targetY - currentY) * SMOOTHING;
      
      // Use transform for better performance
      animatedCursorEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    
    if (!isGloballyStopped) {
      lastRequestId = requestAnimationFrame(updatePosition);
    }
  }

  function onMouseMove(event) {
    targetX = event.clientX;
    targetY = event.clientY;
    
    // For static cursors using CSS, update immediately
    if (currentCursorType === 'static') {
      mousePosX = event.clientX;
      mousePosY = event.clientY;
    }
  }

  function createAnimatedCursorElement(url, type) {
    const el = document.createElement("div");
    el.id = CURSOR_ID;
    el.className = 'ultimate-cursor';
    
    // Base styles
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '999999',
      width: `${CURSOR_SIZE}px`,
      height: `${CURSOR_SIZE}px`,
      display: 'none',
      willChange: 'transform',
      userSelect: 'none',
      
      // Background setup
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      backgroundSize: 'contain',
      
      
      // Smooth transitions
      transition: 'opacity 0.2s ease',
      
      // Ensure proper layering
      isolation: 'isolate'
    });

    // Set background based on type
    if (type === 'animated' || type === 'static') {
      el.style.backgroundImage = `url('${url}')`;
    }
    
    return el;
  }

  function startInteractiveElementHandlers() {
    // Remove existing handlers
    document.removeEventListener('mouseenter', handleInteractiveEnter, true);
    document.removeEventListener('mouseleave', handleInteractiveLeave, true);
    
    // Add new handlers
    document.addEventListener('mouseenter', handleInteractiveEnter, true);
    document.addEventListener('mouseleave', handleInteractiveLeave, true);
  }

  function handleInteractiveEnter(event) {
    if (event.target?.matches?.(INTERACTIVE_SELECTORS)) {
      if (currentCursorType === 'animated') {
        hideAnimatedCursor();
      }
    }
  }

  function handleInteractiveLeave(event) {
    if (event.target?.matches?.(INTERACTIVE_SELECTORS)) {
      if (currentCursorType === 'animated') {
        showAnimatedCursor();
      }
    }
  }

  function stopAllCursors() {
    console.log('🧹 Cleaning up all cursor effects...');
    
    isGloballyStopped = true;
    isHiddenByHover = false;
    
    // Stop animation loop
    if (lastRequestId) {
      cancelAnimationFrame(lastRequestId);
      lastRequestId = null;
    }
    
    // Remove animated cursor element
    if (animatedCursorEl) {
      animatedCursorEl.remove();
      animatedCursorEl = null;
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseenter', handleInteractiveEnter, true);
    document.removeEventListener('mouseleave', handleInteractiveLeave, true);
    
    // Reset CSS cursor
    document.body.style.cursor = 'auto';
    
    // Clear state
    currentCursorType = null;
    currentCursorUrl = null;
    
    console.log('✅ All cursors stopped and cleaned up');
  }

  function hideAnimatedCursor() {
    if (!isGloballyStopped && animatedCursorEl && currentCursorType === 'animated') {
      isHiddenByHover = true;
      animatedCursorEl.style.opacity = '0';
      document.body.style.cursor = 'auto';
    }
  }

  function showAnimatedCursor() {
    if (!isGloballyStopped && isHiddenByHover && animatedCursorEl && currentCursorType === 'animated') {
      isHiddenByHover = false;
      animatedCursorEl.style.opacity = '1';
      document.body.style.cursor = 'none';
    }
  }

  // === PUBLIC API ===

  window.startAnimatedGifCursor = function(gifUrl) {
    console.log('🚀 Starting animated GIF cursor:', gifUrl);
    
    if (!gifUrl) {
      console.error('❌ No GIF URL provided');
      return false;
    }

    try {
      // Stop any existing cursors
      stopAllCursors();

      // Create cursor element
      animatedCursorEl = createAnimatedCursorElement(gifUrl, 'animated');
      document.body.appendChild(animatedCursorEl);
      console.log('✅ Animated cursor element created');

      // Initialize position
      currentX = targetX = mousePosX;
      currentY = targetY = mousePosY;
      
      // Start the cursor
      isGloballyStopped = false;
      isHiddenByHover = false;
      currentCursorType = 'animated';
      currentCursorUrl = gifUrl;
      
      animatedCursorEl.style.display = 'block';
      animatedCursorEl.style.opacity = '1';
      document.body.style.cursor = 'none';
      
      // Start event listeners
      document.addEventListener('mousemove', onMouseMove);
      startInteractiveElementHandlers();
      
      // Start animation loop
      lastRequestId = requestAnimationFrame(updatePosition);
      
      console.log('✨ Animated GIF cursor started successfully');
      return true;
      
    } catch (error) {
      console.error('💥 Failed to start animated cursor:', error);
      stopAllCursors();
      return false;
    }
  };

  window.startStaticCursor = function(imageUrl, hotspotX = 0, hotspotY = 0) {
    console.log('🖼️ Starting static cursor:', imageUrl);
    
    if (!imageUrl) {
      console.error('❌ No image URL provided');
      return false;
    }

    try {
      // Stop any existing cursors
      stopAllCursors();
      
      // Set CSS cursor with hotspot
      const cursorStyle = `url('${imageUrl}') ${hotspotX} ${hotspotY}, auto`;
      document.body.style.cursor = cursorStyle;
      
      // Update state
      currentCursorType = 'static';
      currentCursorUrl = imageUrl;
      
      console.log('✅ Static cursor applied:', cursorStyle);
      
      // Verify cursor was applied
      setTimeout(() => {
        const appliedCursor = getComputedStyle(document.body).cursor;
        if (appliedCursor.includes(imageUrl)) {
          console.log('✨ Static cursor verified successfully');
        } else {
          console.warn('⚠️ Static cursor may not have loaded properly');
          // Fallback without hotspot
          document.body.style.cursor = `url('${imageUrl}'), auto`;
        }
      }, 100);
      
      return true;
      
    } catch (error) {
      console.error('💥 Failed to start static cursor:', error);
      window.resetCursor();
      return false;
    }
  };

  window.stopAnimatedGifCursor = function() {
    console.log('🛑 Stopping animated cursor');
    if (currentCursorType === 'animated') {
      stopAllCursors();
    }
    return true;
  };

  window.hideAnimatedGifCursor = function() {
    hideAnimatedCursor();
    return true;
  };

  window.showAnimatedGifCursor = function() {
    showAnimatedCursor();
    return true;
  };

  window.resetCursor = function() {
    console.log('🔄 Resetting to default cursor');
    stopAllCursors();
    return true;
  };

  // Universal cursor starter - detects type automatically
  window.startCursor = function(url, options = {}) {
    if (!url) {
      console.error('❌ No cursor URL provided');
      return false;
    }

    const { 
      hotspotX = 0, 
      hotspotY = 0, 
      forceStatic = false 
    } = options;

    console.log('🎯 Starting cursor (auto-detect):', url);

    // Detect cursor type
    const isGif = url.toLowerCase().endsWith('.gif');
    const isOneko = url.toLowerCase().includes('oneko');

    if (isOneko) {
      console.log('🐱 Detected oneko cursor - delegating to oneko script');
      // Let oneko script handle this
      return false;
    } else if (isGif && !forceStatic) {
      return window.startAnimatedGifCursor(url);
    } else {
      return window.startStaticCursor(url, hotspotX, hotspotY);
    }
  };

  // Get current cursor info
  window.getCurrentCursor = function() {
    return {
      type: currentCursorType,
      url: currentCursorUrl,
      isActive: !isGloballyStopped,
      isHidden: isHiddenByHover
    };
  };

  // Initialize mouse position tracking
  function initializeMouseTracking() {
    document.addEventListener('mousemove', function(e) {
      mousePosX = e.clientX;
      mousePosY = e.clientY;
      targetX = e.clientX;
      targetY = e.clientY;
      currentX = e.clientX;
      currentY = e.clientY;
    }, { once: true });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMouseTracking);
  } else {
    initializeMouseTracking();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', stopAllCursors);

  console.log('✅ Ultimate Animated Cursor System loaded successfully!');
  console.log('📋 Available functions:');
  console.log('  🎬 window.startAnimatedGifCursor(url) - Start animated GIF cursor');
  console.log('  🖼️ window.startStaticCursor(url, hotspotX, hotspotY) - Start static image cursor');
  console.log('  🎯 window.startCursor(url, options) - Auto-detect and start appropriate cursor');
  console.log('  🛑 window.stopAnimatedGifCursor() - Stop animated cursor');
  console.log('  🔄 window.resetCursor() - Reset to default cursor');
  console.log('  👁️ window.hideAnimatedGifCursor() - Temporarily hide animated cursor');
  console.log('  👁️ window.showAnimatedGifCursor() - Show hidden animated cursor');
  console.log('  ℹ️ window.getCurrentCursor() - Get current cursor info');

})();