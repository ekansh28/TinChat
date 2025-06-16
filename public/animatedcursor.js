// Save this as: public/animatedcursor.js
console.log('🎯 Loading Ultimate Animated Cursor System...');

(function() {
  // State management
  let animatedCursorEl = null;
  let currentCursorType = null;
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
  const SMOOTHING = 0.15;

  function updatePosition() {
    if (animatedCursorEl && !isGloballyStopped && !isHiddenByHover) {
      currentX += (targetX - currentX) * SMOOTHING;
      currentY += (targetY - currentY) * SMOOTHING;
      animatedCursorEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    
    if (!isGloballyStopped) {
      lastRequestId = requestAnimationFrame(updatePosition);
    }
  }

  function onMouseMove(event) {
    targetX = event.clientX;
    targetY = event.clientY;
    
    if (currentCursorType === 'static') {
      mousePosX = event.clientX;
      mousePosY = event.clientY;
    }
  }

  function createAnimatedCursorElement(url, type) {
    const el = document.createElement("div");
    el.id = CURSOR_ID;
    el.className = 'ultimate-cursor';
    
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '999999',
      width: `${CURSOR_SIZE}px`,
      height: `${CURSOR_SIZE}px`,
      display: 'none',
      willChange: 'transform',
      userSelect: 'none',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: '0 0',
      backgroundSize: 'contain',
      filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.4))',
      transition: 'opacity 0.2s ease',
      isolation: 'isolate'
    });

    if (type === 'animated' || type === 'static') {
      el.style.backgroundImage = `url('${url}')`;
    }
    
    return el;
  }

  function stopAllCursors() {
    console.log('🧹 Cleaning up all cursor effects...');
    
    isGloballyStopped = true;
    isHiddenByHover = false;
    
    if (lastRequestId) {
      cancelAnimationFrame(lastRequestId);
      lastRequestId = null;
    }
    
    if (animatedCursorEl) {
      animatedCursorEl.remove();
      animatedCursorEl = null;
    }
    
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseenter', handleInteractiveEnter, true);
    document.removeEventListener('mouseleave', handleInteractiveLeave, true);
    
    document.body.style.cursor = 'auto';
    
    currentCursorType = null;
    currentCursorUrl = null;
    
    console.log('✅ All cursors stopped and cleaned up');
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
      stopAllCursors();

      animatedCursorEl = createAnimatedCursorElement(gifUrl, 'animated');
      document.body.appendChild(animatedCursorEl);
      console.log('✅ Animated cursor element created');

      currentX = targetX = mousePosX;
      currentY = targetY = mousePosY;
      
      isGloballyStopped = false;
      isHiddenByHover = false;
      currentCursorType = 'animated';
      currentCursorUrl = gifUrl;
      
      animatedCursorEl.style.display = 'block';
      animatedCursorEl.style.opacity = '1';
      document.body.style.cursor = 'none';
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseenter', handleInteractiveEnter, true);
      document.addEventListener('mouseleave', handleInteractiveLeave, true);
      
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
      stopAllCursors();
      
      const cursorStyle = `url('${imageUrl}') ${hotspotX} ${hotspotY}, auto`;
      document.body.style.cursor = cursorStyle;
      
      currentCursorType = 'static';
      currentCursorUrl = imageUrl;
      
      console.log('✅ Static cursor applied:', cursorStyle);
      
      setTimeout(() => {
        const appliedCursor = getComputedStyle(document.body).cursor;
        if (appliedCursor.includes(imageUrl)) {
          console.log('✨ Static cursor verified successfully');
        } else {
          console.warn('⚠️ Static cursor may not have loaded properly');
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

    const isGif = url.toLowerCase().endsWith('.gif');
    const isOneko = url.toLowerCase().includes('oneko');

    if (isOneko) {
      console.log('🐱 Detected oneko cursor - delegating to oneko script');
      return false;
    } else if (isGif && !forceStatic) {
      return window.startAnimatedGifCursor(url);
    } else {
      return window.startStaticCursor(url, hotspotX, hotspotY);
    }
  };

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMouseTracking);
  } else {
    initializeMouseTracking();
  }

  window.addEventListener('beforeunload', stopAllCursors);

  console.log('✅ Ultimate Animated Cursor System loaded successfully!');
  console.log('📋 Available functions:');
  console.log('  🎬 window.startAnimatedGifCursor(url)');
  console.log('  🖼️ window.startStaticCursor(url, hotspotX, hotspotY)');
  console.log('  🎯 window.startCursor(url, options)');
  console.log('  🛑 window.stopAnimatedGifCursor()');
  console.log('  🔄 window.resetCursor()');

})();