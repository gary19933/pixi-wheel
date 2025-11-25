(async function(){
  try{
  // ---- Config ---------------------------------------------------------------
  // Backend API URL - uses environment variable or defaults to localhost for development
  // In production, set VITE_API_GATEWAY environment variable (e.g., https://api.yoursite.com)
  let MICROSERVICE_GATEWAY = 'http://localhost:3000';
  let USE_MICROSERVICE_FOR_SPIN = false;
  
  // Try to get Vite environment variables (only works when processed by Vite)
  try {
    // In ES modules, import.meta is available - access it directly
    const env = import.meta.env;
    if (env) {
      MICROSERVICE_GATEWAY = env.VITE_API_GATEWAY || MICROSERVICE_GATEWAY;
      USE_MICROSERVICE_FOR_SPIN = env.VITE_USE_MICROSERVICE_FOR_SPIN === 'true';
    }
  } catch (e) {
    // Not in Vite environment or import.meta not available, use defaults
  }
  
  // Fallback: detect environment from window location
  if (typeof window !== 'undefined') {
    if (window.location.origin.includes('localhost')) {
      MICROSERVICE_GATEWAY = 'http://localhost:3000';
    } else {
      MICROSERVICE_GATEWAY = window.location.origin;
    }
  }
  
  const CONFIG = { 
    API_ENDPOINT: `${MICROSERVICE_GATEWAY}/api/gameplay/claim`, 
    USE_MICROSERVICE_FOR_SPIN: USE_MICROSERVICE_FOR_SPIN,
    ENABLE_SFX: true, 
    BASE_RADIUS: 400, 
    HUB_RADIUS: 80 
  };

  // ---- Loading Screen -----------------------------------------------------
  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'loadingScreen';
  loadingScreen.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 10000; display: none; background-size: cover; background-position: center; background-repeat: no-repeat;';
  document.body.appendChild(loadingScreen);
  
  function showLoadingScreen() {
    // Check if active is available before accessing it
    if (typeof active !== 'undefined' && active?.assets?.loadingScreen) {
      loadingScreen.style.backgroundImage = `url(${active.assets.loadingScreen})`;
      loadingScreen.style.display = 'block';
      document.getElementById('game').style.display = 'none';
    }
  }
  
  function hideLoadingScreen() {
    loadingScreen.style.display = 'none';
    document.getElementById('game').style.display = 'block';
  }

  // ---- Pixi app ------------------------------------------------------------
  const app = new PIXI.Application({ resizeTo: document.getElementById('game'), backgroundAlpha: 0, antialias: true, autoDensity: true, powerPreference: 'high-performance' });
  document.getElementById('game').appendChild(app.view);
  const DESIGN = { w: 1080, h: 1920 };

  // Root & layers ------------------------------------------------------------
  const root = new PIXI.Container();
  const bgLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  const topbarLayer = new PIXI.Container();
  const modalLayer = new PIXI.Container();
  app.stage.addChild(bgLayer); 
  app.stage.addChild(root); 
  app.stage.addChild(uiLayer);
  app.stage.addChild(topbarLayer);
  app.stage.addChild(modalLayer);

  const wheelContainer = new PIXI.Container();
  root.addChild(wheelContainer);

  // Responsive ---------------------------------------------------------------
  let sizeMultiplier = 1.6; let autoMultiplier = 1;
  // Store calculated wheel radius directly for mobile (in DESIGN coordinates)
  let calculatedWheelRadius = null;
  
  function computeAutoMultiplier(){ 
    const vw=app.renderer.width, vh=app.renderer.height; 
    const mobile = isMobile();
    const minEdge=Math.min(vw,vh); 
    const maxEdge=Math.max(vw,vh);
    
    if (mobile) {
      // Mobile: Calculate wheel size DIRECTLY from available space (no fixed scale)
      // This method calculates the actual wheel radius in screen pixels, then converts to DESIGN coordinates
      const safeArea = getSafeAreaInsets();
      const topbarHeight = Math.max(12, safeArea.top + 8) + 30; // Topbar + buttons
      const logoHeight = 50; // Estimated logo height
      const logoSpacing = 40; // Reduced to give more space to wheel
      const chanceHeight = 30;
      const chanceSpacing = 50; // Reduced spacing
      const buttonHeight = 22; // Updated to match actual button height
      const buttonSpacing = 30; // Reduced spacing
      const bottomPadding = Math.max(15, safeArea.bottom + 8); // Reduced padding
      
      // Calculate available space for wheel dynamically
      const usedSpace = topbarHeight + logoHeight + logoSpacing + chanceHeight + chanceSpacing + buttonHeight + buttonSpacing + bottomPadding;
      const availableHeight = vh - usedSpace;
      
      // Calculate available width (account for safe areas and left/right margins)
      const safeAreaLeft = safeArea.left || 0;
      const safeAreaRight = safeArea.right || 0;
      // Add left and right margins for spin wheel on mobile
      const wheelLeftMargin = 20; // Left margin in pixels
      const wheelRightMargin = 20; // Right margin in pixels
      const availableWidth = vw - safeAreaLeft - safeAreaRight - wheelLeftMargin - wheelRightMargin;
      
      // Dynamic percentage based on screen aspect ratio
      const aspectRatio = vh / vw;
      const isPortrait = aspectRatio > 1.2; // Portrait mode
      
      // Use maximum space - match screenshot where wheel is very large
      const heightPercentage = isPortrait ? 0.99 : 0.96; // Use 99% of height in portrait
      const widthPercentage = isPortrait ? 0.95 : 0.98; // Use 95% of width in portrait
      
      // Calculate max wheel diameter in SCREEN PIXELS (not DESIGN coordinates)
      const maxWheelDiameterFromHeight = availableHeight * heightPercentage;
      const maxWheelDiameterFromWidth = availableWidth * widthPercentage;
      
      // Use the smaller of the two to ensure wheel fits both dimensions
      const maxWheelDiameterScreen = Math.min(maxWheelDiameterFromHeight, maxWheelDiameterFromWidth);
      
      // Calculate wheel radius in SCREEN PIXELS
      const wheelRadiusScreen = maxWheelDiameterScreen / 2;
      
      // Convert screen radius to DESIGN coordinates
      // Calculate the scale that will be used in layout()
      // Mobile uses min of scaleX and scaleY to fit screen
      const scaleX = vw / DESIGN.w;
      const scaleY = vh / DESIGN.h;
      const scale = Math.min(scaleX, scaleY);
      
      // Clamp scale for mobile (same as in layout function)
      const minScale = 0.3;
      const maxScale = 2.0;
      const clampedScale = Math.max(minScale, Math.min(maxScale, scale));
      
      // Convert screen radius to DESIGN coordinates using the scale
      const wheelRadiusDesign = wheelRadiusScreen / clampedScale;
      
      // Store the calculated radius directly (will be used in drawWheel)
      calculatedWheelRadius = wheelRadiusDesign;
      
      // Also calculate autoMultiplier for compatibility (but won't limit size)
      autoMultiplier = wheelRadiusDesign / CONFIG.BASE_RADIUS;
      
      // No limits - use the calculated size directly
    } else {
      // Web: Original logic
      const targetDiameter=minEdge*0.8; 
      autoMultiplier = targetDiameter/(CONFIG.BASE_RADIUS*2); 
      autoMultiplier=Math.max(0.6, Math.min(1.6, autoMultiplier)); 
      calculatedWheelRadius = null; // Reset for web
    }
  }
  // Helper function to detect mobile - improved detection
  function isMobile() {
    // Check user agent
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    
    // Check screen size (more accurate for mobile)
    const isMobileSize = window.innerWidth <= 768 || window.screen.width <= 768;
    
    // Check touch capability
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Mobile if: (UA matches OR screen is small) AND (touch device OR small screen)
    return (isMobileUA || isMobileSize) && (isTouchDevice || isMobileSize);
  }
  
  // Get actual screen dimensions for better scaling
  function getScreenDimensions() {
    return {
      width: window.innerWidth || window.screen.width,
      height: window.innerHeight || window.screen.height,
      isPortrait: (window.innerHeight || window.screen.height) > (window.innerWidth || window.screen.width)
    };
  }
  
  // Get safe area insets for iPhone notch/Dynamic Island and Android status bar
  function getSafeAreaInsets() {
    // Try to get CSS safe-area-inset values
    const style = getComputedStyle(document.documentElement);
    const safeAreaTop = parseInt(style.getPropertyValue('--safe-area-inset-top') || '0');
    
    // If CSS variable not available, detect device type
    if (safeAreaTop === 0) {
      const ua = navigator.userAgent || navigator.vendor || window.opera;
      const isIOS = /iPad|iPhone|iPod/.test(ua);
      const isAndroid = /Android/.test(ua);
      const isIPhoneX = isIOS && (window.screen.height >= 812 || window.screen.width >= 812);
      
      if (isIPhoneX) {
        // iPhone X and newer have notch/Dynamic Island
        // Approximate safe area: 44-59px for notch, 59px+ for Dynamic Island (iPhone 14 Pro and newer)
        const screenHeight = window.screen.height;
        if (screenHeight >= 932) {
          // iPhone 14 Pro Max, 15 Pro Max, etc. - Dynamic Island
          return { top: 59, bottom: 34, left: 0, right: 0 };
        } else if (screenHeight >= 844) {
          // iPhone 12/13/14 Pro, etc. - notch
          return { top: 47, bottom: 34, left: 0, right: 0 };
        } else {
          // iPhone X/XS/11 Pro, etc. - notch
          return { top: 44, bottom: 34, left: 0, right: 0 };
        }
      } else if (isAndroid) {
        // Android devices typically have a status bar that's 24-32px tall
        // Add minimum top margin to prevent buttons from being blocked
        return { top: 28, bottom: 0, left: 0, right: 0 };
      }
    }
    
    return { top: safeAreaTop || 0, bottom: 0, left: 0, right: 0 };
  }
  
  function layout(){ 
    const vw=app.renderer.width, vh=app.renderer.height; 
    const mobile = isMobile();
    const screen = getScreenDimensions();
    
    // Ensure 9:16 aspect ratio (1080×1920 = 9:16)
    // DESIGN dimensions are already 9:16 ratio
    const DESIGN_ASPECT_RATIO = DESIGN.w / DESIGN.h; // Should be 9/16 = 0.5625
    
    // Mobile: Auto-fit to screen while maintaining 9:16 aspect ratio
    // Web: Fixed 1080×1920 (maintains aspect ratio)
    let scale;
    if (mobile) {
      // Mobile: Scale to fill screen while maintaining 9:16 ratio
      // Calculate scale based on viewport, but ensure we maintain the 9:16 ratio
      const scaleX = vw / DESIGN.w;
      const scaleY = vh / DESIGN.h;
      scale = Math.min(scaleX, scaleY); // Use smaller scale to maintain aspect ratio
      
      // For very small screens, ensure minimum scale
      const minScale = 0.3;
      const maxScale = 2.0;
      scale = Math.max(minScale, Math.min(maxScale, scale));
      
      // Ensure the scaled dimensions maintain 9:16 ratio
      // The scale calculation already does this, but we verify
      const scaledWidth = DESIGN.w * scale;
      const scaledHeight = DESIGN.h * scale;
      const actualAspectRatio = scaledWidth / scaledHeight;
      
      // If aspect ratio is off, adjust (shouldn't happen with Math.min, but safety check)
      if (Math.abs(actualAspectRatio - DESIGN_ASPECT_RATIO) > 0.01) {
        // Recalculate to maintain exact 9:16
        scale = Math.min(vw / DESIGN.w, vh / DESIGN.h);
      }
    } else {
      // Web: Fixed 1080×1920 design, scale to fit viewport while maintaining aspect ratio
      scale = Math.min(vw/DESIGN.w, vh/DESIGN.h);
    }
    
    // Apply scale and center the 9:16 design area
    root.scale.set(scale); 
    root.x=vw/2-(DESIGN.w*scale)/2; 
    root.y=vh/2-(DESIGN.h*scale)/2; 
    
    // Vertical layout: Logo → Wheel → Chance → Spin Button
    // ===== WHEEL VERTICAL POSITION =====
    // Mobile: Center wheel in available vertical space
    // Web: Fixed position
    let wheelY;
    if (mobile) {
      // Mobile: Calculate available vertical space and center wheel
      const safeArea = getSafeAreaInsets();
      
      // Calculate top space (topbar + logo)
      const topbarButtonSize = 30; // Mobile button size
      const topbarMargin = Math.max(12, safeArea.top + 8);
      const topbarHeight = topbarMargin + topbarButtonSize;
      
      // Logo height (estimated based on scale) - reduce spacing to give more room to wheel
      const logoScale = 0.5; // Mobile logo scale
      const estimatedLogoHeight = 100 * logoScale; // Approximate logo height
      const logoSpacing = 40; // Reduced spacing between logo and wheel (was 60)
      const topSpace = topbarHeight + estimatedLogoHeight + logoSpacing;
      
      // Calculate bottom space (chance counter + spin button + padding) - reduce spacing
      const chanceCounterHeight = 30; // Font size
      const chanceSpacing = 50; // Reduced spacing between wheel and chance counter (was 60)
      const spinButtonHeight = 22; // Updated mobile button height
      const spinButtonSpacing = 30; // Reduced spacing between chance counter and button (was 40)
      const bottomPadding = 15; // Reduced bottom padding (was 20)
      const bottomSpace = chanceSpacing + chanceCounterHeight + spinButtonSpacing + spinButtonHeight + bottomPadding;
      
      // Calculate available vertical space
      const availableHeight = vh - topSpace - bottomSpace;
      
      // Get wheel radius (will be calculated in computeAutoMultiplier, but estimate first)
      // Use a reasonable estimate for initial calculation
      const estimatedWheelRadius = 200; // Will be adjusted after computeAutoMultiplier
      
      // Center the wheel in available space
      // Position wheel center at: topSpace + (availableHeight / 2)
      wheelY = topSpace + (availableHeight / 2);
      
      // Ensure wheel doesn't overflow (safety check)
      wheelY = Math.max(estimatedWheelRadius + topSpace, Math.min(vh - estimatedWheelRadius - bottomSpace, wheelY));
    } else {
      // Web: Fixed position
      wheelY = 800;
    }
    
    wheelContainer.x = DESIGN.w/2; 
    
    // Set temporary wheel position (needed for computeAutoMultiplier and drawWheel)
    wheelContainer.y = wheelY;
    
    drawBackground(); 
    computeAutoMultiplier(); 
    drawWheel(); // This calculates WHEEL_RADIUS
    
    // For mobile, recalculate wheel position to center everything vertically
    if (mobile) {
      const safeArea = getSafeAreaInsets();
      
      // All calculations in SCREEN COORDINATES (vh, actual pixels)
      const topbarButtonSize = 30;
      const topbarMargin = Math.max(12, safeArea.top + 8);
      const topbarHeight = topbarMargin + topbarButtonSize;
      
      // Logo height in screen coordinates
      const logoScale = 0.5;
      let logoHeightScreen = 0;
      if (logoSprite.texture && logoSprite.texture.baseTexture.valid) {
        logoHeightScreen = (logoSprite.texture.height * logoScale) * scale;
      } else {
        logoHeightScreen = (100 * logoScale) * scale;
      }
      const logoSpacingScreen = 60 * scale;
      
      // Wheel diameter in screen coordinates
      const wheelDiameterScreen = (WHEEL_RADIUS * 2) * scale;
      const wheelRadiusScreen = WHEEL_RADIUS * scale;
      
      // Bottom elements in screen coordinates
      const chanceCounterHeightScreen = 30 * scale;
      const chanceSpacingScreen = 60 * scale;
      const spinButtonHeightScreen = 15 * scale;
      const spinButtonSpacingScreen = 40 * scale;
      const bottomSafeArea = safeArea.bottom || 0;
      const bottomPaddingScreen = Math.max(20, bottomSafeArea + 10);
      
      // Calculate total content height in SCREEN COORDINATES
      const totalContentHeightScreen = 
        topbarHeight + 
        logoHeightScreen + 
        logoSpacingScreen + 
        wheelDiameterScreen + 
        chanceSpacingScreen + 
        chanceCounterHeightScreen + 
        spinButtonSpacingScreen + 
        spinButtonHeightScreen + 
        bottomPaddingScreen;
      
      // Calculate white space and center content
      const totalWhiteSpace = vh - totalContentHeightScreen;
      const contentStartYScreen = totalWhiteSpace / 2;
      
      // Calculate wheel center in SCREEN COORDINATES
      // From top of content: topbar + logo + logoSpacing + wheelRadius
      const wheelCenterFromContentTopScreen = 
        topbarHeight + 
        logoHeightScreen + 
        logoSpacingScreen + 
        wheelRadiusScreen;
      
      // Final wheel center position in SCREEN COORDINATES
      const wheelCenterYScreen = contentStartYScreen + wheelCenterFromContentTopScreen;
      
      // Convert screen Y to DESIGN Y coordinate
      // wheelContainer.y is in DESIGN space (0-1920)
      // Formula: designY = (screenY - root.y) / root.scale.y
      wheelY = (wheelCenterYScreen - root.y) / root.scale.y;
      
      // Update wheel position in DESIGN coordinates
      wheelContainer.y = wheelY;
      
      // Redraw wheel at correct position
      drawWheel();
    } 
    // Logo is positioned in drawLogo() relative to wheel position
    drawLogo(); 
    drawGameLogo();
    drawChanceCounter(); 
    drawTopbar(); 
    drawSpinButton(); 
  }
  app.renderer.on('resize', layout);
  
  // Handle mobile orientation changes and window resize for better responsiveness
  let resizeTimeout;
  function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Update renderer size
      const gameEl = document.getElementById('game');
      if (gameEl) {
        app.renderer.resize(gameEl.clientWidth, gameEl.clientHeight);
        layout();
      }
    }, 150); // Debounce resize events
  }
  
  // Listen for window resize and orientation changes
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    // Delay to allow orientation change to complete
    setTimeout(() => {
      const gameEl = document.getElementById('game');
      if (gameEl) {
        app.renderer.resize(gameEl.clientWidth, gameEl.clientHeight);
        layout();
      }
    }, 300);
  });

  // ---- Templates -----------------------------------------------------------
  const LS_KEY = 'spinWheelTemplates.v1';
  function defaultTemplate(){ return { name:'Default', terms:`By participating you agree:
• One spin per session.
• Prizes are non-transferable.
• Organizer reserves the right to modify terms.`, prizesText:'🎁 iPhone 15 Pro | 1 | #25c77a\n💰 RM 50 Credit | 2 | #E9FFF7\n🎉 Mystery Gift | 1 | #25c77a\n🧧 Angpao RM 10 | 2 | #E9FFF7\n🍀 Free Spin | 3 | #25c77a\n💎 Mega Gift Box | 0.5 | #E9FFF7', assets:{loadingScreen:null,bg:null,logo:null,gameLogo:null,spin:null,pointer:null,hub:null,rewardsBtn:null,infoBtn:null,soundUnmute:null,soundMute:null,rewardsModal:null,rewardsClose:null,infoModal:null,infoClose:null,wheel:null,canvasRewardsBtn:null,canvasInfoBtn:null,canvasSoundUnmute:null,canvasSoundMute:null,canvasSpinBtn:null,canvasRewardsModal:null,canvasRewardsClose:null,canvasInfoModal:null,canvasInfoClose:null,canvasCongratsModal:null,canvasCongratsClose:null}, colors:{pageBackground:{type:'color',style:'#0a2b22'},spinButton:{type:'gradient',style:'linear-gradient(to bottom, #24d58b, #0fb168)'},canvasBtnPrimary:'#17342c',canvasBtnHover:'#1b3e33',canvasBtnText:'#d9fff2',canvasRewardsBtnColor:'#17342c',canvasInfoBtnColor:'#17342c',canvasModalBg:'#0e1f1a',canvasModalBorder:'#204a3e',canvasModalText:'#e8fff5',canvasSpinBtn:'#24d58b',canvasSpinBtnHover:'#2be68b',canvasSpinBtnBorder:'#0fb168'}, settings:{claimAction:'modal',claimUrl:'',guaranteedPrize:''} }; }
  function loadTemplates(){ try{ const arr=JSON.parse(localStorage.getItem(LS_KEY)||'[]'); if(Array.isArray(arr)&&arr.length) return arr; }catch{} const seed=[defaultTemplate()]; localStorage.setItem(LS_KEY, JSON.stringify(seed)); return seed; }
  function saveTemplates(){ localStorage.setItem(LS_KEY, JSON.stringify(templates)); }
  let templates = loadTemplates(); let activeIndex=0; let active=templates[activeIndex];
  
  // Session management for microservice
  let gameSession = null;
  let remainingSpins = null;
  let sessionChecked = false; // Track if we've checked the session from backend
  
  async function getOrCreateSession(playerId = null) {
    // Get playerId from URL parameter if not provided
    if (!playerId) {
      const urlParams = new URLSearchParams(window.location.search);
      playerId = urlParams.get('playerId') || null;
    }
    
    if (!gameSession) {
      try {
        const response = await fetch(`${MICROSERVICE_GATEWAY}/api/gameplay/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: active.name,
            playerId: playerId // Pass playerId if available (from URewards/3rd party backend)
          })
        });
        if (response.ok) {
          gameSession = await response.json();
          if (gameSession && gameSession.id) {
            if (gameSession.maxSpins !== null && gameSession.maxSpins !== undefined) {
              const maxSpins = Number(gameSession.maxSpins);
              const spins = Number(gameSession.spins || 0);
              remainingSpins = (!isNaN(maxSpins) && !isNaN(spins)) 
                ? Math.max(0, maxSpins - spins) 
                : null;
            } else {
              remainingSpins = null;
            }
            sessionChecked = true; // Mark that we've checked the session
            console.log('Game session created:', gameSession.id, remainingSpins !== null ? `(${remainingSpins} spins remaining)` : '(unlimited)');
            updateSpinButtonState();
          } else {
            console.warn('Session created but missing ID:', gameSession);
          }
        } else {
          const errorText = await response.text();
          console.error('Failed to create session:', response.status, errorText);
          // Mark as checked even if failed - show unlimited spins
          sessionChecked = true;
          remainingSpins = null; // Unlimited when backend unavailable
        }
      } catch (err) {
        console.warn('Failed to create session, continuing without session tracking', err);
        // Mark as checked even if failed - show unlimited spins
        sessionChecked = true;
        remainingSpins = null; // Unlimited when backend unavailable
      }
    } else {
      // Refresh session info to get current spin count
      try {
        const response = await fetch(`${MICROSERVICE_GATEWAY}/api/gameplay/session/${gameSession.id}`);
        if (response.ok) {
          const session = await response.json();
          if (session.maxSpins !== null && session.maxSpins !== undefined) {
            const maxSpins = Number(session.maxSpins);
            const spins = Number(session.spins || 0);
            remainingSpins = (!isNaN(maxSpins) && !isNaN(spins)) 
              ? Math.max(0, maxSpins - spins) 
              : null;
          } else {
            remainingSpins = null;
          }
          sessionChecked = true; // Mark that we've checked the session
          updateSpinButtonState();
        } else if (response.status === 404) {
          // Session not found, reset it so it can be recreated
          console.warn('Session not found, will recreate on next spin');
          gameSession = null;
          sessionChecked = false;
        }
      } catch (err) {
        console.warn('Failed to refresh session:', err);
        // Mark as checked even if failed - show unlimited spins
        sessionChecked = true;
        remainingSpins = null; // Unlimited when backend unavailable
      }
    }
    return gameSession;
  }
  
  async function checkCanSpin() {
    if (!gameSession) {
      await getOrCreateSession();
    }
    if (!gameSession || !gameSession.id) {
      return true; // Allow if no session or session has no ID
    }
    
    if (remainingSpins !== null && remainingSpins <= 0) {
      return false;
    }
    
    // Check with backend
    try {
      const response = await fetch(`${MICROSERVICE_GATEWAY}/api/gameplay/session/${gameSession.id}/can-spin`);
      if (response.ok) {
        const data = await response.json();
        // Safely parse remainingSpins from API response
        if (data.remainingSpins !== null && data.remainingSpins !== undefined) {
          const parsed = Number(data.remainingSpins);
          remainingSpins = isNaN(parsed) ? null : parsed;
        } else {
          remainingSpins = null;
        }
        return data.canSpin;
      } else if (response.status === 404) {
        // Session not found, try to recreate it
        gameSession = null;
        await getOrCreateSession();
        if (gameSession && gameSession.id) {
          // Retry the check with new session
          const retryResponse = await fetch(`${MICROSERVICE_GATEWAY}/api/gameplay/session/${gameSession.id}/can-spin`);
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            // Safely parse remainingSpins from API response
            if (retryData.remainingSpins !== null && retryData.remainingSpins !== undefined) {
              const parsed = Number(retryData.remainingSpins);
              remainingSpins = isNaN(parsed) ? null : parsed;
            } else {
              remainingSpins = null;
            }
            return retryData.canSpin;
          }
        }
        return true; // Default to allowing if session recreation fails
      }
    } catch (err) {
      console.warn('Failed to check spin limit:', err);
    }
    
    return true; // Default to allowing if check fails
  }

  // ---- Prize parsing -------------------------------------------------------
  function normalizeColor(c){ if(typeof c==='number') return c; if(typeof c==='string'){ if(c.startsWith('#')) return parseInt(c.slice(1),16); if(/^0x/i.test(c)) return parseInt(c,16); return 0x25c77a; } return 0x25c77a; }
  function toId(label){ return label.toLowerCase().replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,''); }
  function parseFromText(txt){ const lines=txt.split(/\n+/).map(l=>l.trim()).filter(Boolean); if(lines.length<2) throw new Error('Please enter at least 2 prizes'); const arr=[]; for(const line of lines){ const parts=line.split('|').map(s=>s.trim()); const label=parts[0]||'Prize'; const weight=parseFloat(parts[1]??'1'); if(!Number.isFinite(weight)||weight<=0) throw new Error(`Invalid weight for "${label}"`); const color=parts[2]??'#25c77a'; arr.push({ id:toId(label), label, color, weight }); } const ids=new Set(arr.map(x=>x.id)); if(ids.size!==arr.length) throw new Error('Duplicate labels – make each unique'); return arr; }
  let SLICES = [];
  try { SLICES = parseFromText(active.prizesText); }
  catch(e){ console.warn('Prize parse failed, using defaults', e); SLICES = parseFromText(defaultTemplate().prizesText); }

  // ---- UI refs -------------------------------------------------------------
  const panel = document.getElementById('configPanel');
  const rewardsModal = document.getElementById('rewardsModal');
  const infoModal = document.getElementById('infoModal');
  const rewardsList = document.getElementById('rewardsList');
  const termsBody = document.getElementById('termsBody');
  const panelHeader = document.getElementById('configHeader');
  const btnMinMax = document.getElementById('btnMinMax');
  const activeTemplateName = document.getElementById('activeTemplateName');

  const templateSelect = document.getElementById('templateSelect');
  const templateName   = document.getElementById('templateName');
  const tplNew   = document.getElementById('tplNew');
  const tplSave  = document.getElementById('tplSave');
  const tplDup   = document.getElementById('tplDup');
  const tplDelete= document.getElementById('tplDelete');
  const tplExport= document.getElementById('tplExport');
  const tplImport= document.getElementById('tplImport');
  const tplImportBtn= document.getElementById('tplImportBtn');

  // Page Background elements
  const pageBgType = document.getElementById('pageBgType');
  const pageBgColor = document.getElementById('pageBgColor');
  const pageBgGradient1 = document.getElementById('pageBgGradient1');
  const pageBgGradient2 = document.getElementById('pageBgGradient2');
  const pageBgGradientDirection = document.getElementById('pageBgGradientDirection');
  const pageBgColorRow = document.getElementById('pageBgColorRow');
  const pageBgGradientRow = document.getElementById('pageBgGradientRow');
  const pageBgImageRow = document.getElementById('pageBgImageRow');
  const pageBgFile = document.getElementById('pageBgFile');
  const pageBgClear = document.getElementById('pageBgClear');

  // Logo elements
  const logoFile = document.getElementById('logoFile');
  const logoClear = document.getElementById('logoClear');



  // Wheel Image elements
  const wheelFile = document.getElementById('wheelFile');
  const wheelClear = document.getElementById('wheelClear');
  
  // Hub and Pointer elements
  const hubFile = document.getElementById('hubFile');
  const hubClear = document.getElementById('hubClear');
  const pointerFile = document.getElementById('pointerFile');
  const pointerClear = document.getElementById('pointerClear');
  
  // Button color elements (canvasBtnTextColor and canvasBtnHoverColor declared later with other canvas controls)
  const canvasRewardsBtnColor = document.getElementById('canvasRewardsBtnColor');
  const canvasInfoBtnColor = document.getElementById('canvasInfoBtnColor');

  
  // Reset button
  const resetToDefault = document.getElementById('resetToDefault');

  const termsText= document.getElementById('termsText');
  const configText= document.getElementById('configText');
  const applyBtn  = document.getElementById('applyBtn');
  const sampleBtn = document.getElementById('sampleBtn');
  const exportBtn = document.getElementById('exportBtn');
  const exportStandalone = document.getElementById('exportStandalone');
  const forceSelect = document.getElementById('forceSelect');
  const quickAdd  = document.getElementById('quickAdd');
  const addBtn    = document.getElementById('addBtn');
  const wheelSizeDisplay = document.getElementById('wheelSizeDisplay');
  const wheelDimensions = document.getElementById('wheelDimensions');
  document.getElementById('apiLabel').textContent = CONFIG.API_ENDPOINT;

  // Function to update wheel size display
  function updateWheelSizeDisplay() {
    const sizeMultiplier = parseFloat(sizeRange.value);
    const baseSize = 400; // Base wheel size in pixels
    const actualSize = Math.round(baseSize * sizeMultiplier);
    
    wheelSizeDisplay.textContent = `${sizeMultiplier.toFixed(2)}x`;
    wheelDimensions.textContent = `(${actualSize}×${actualSize}px)`;
  }

  function setActive(i){ activeIndex=i; active=templates[activeIndex]; SLICES=parseFromText(active.prizesText); refreshTemplateUI(); drawBackground(); drawWheel(true); drawLogo(); showToast('✅ Template loaded'); }

  tplNew.addEventListener('click', ()=>{ templates.push({ ...defaultTemplate(), name:'Untitled' }); saveTemplates(); setActive(templates.length-1); refreshTemplateUI(); });
  tplSave.addEventListener('click', ()=>{
  try {
    active.name = templateName.value.trim()||'Untitled';
    active.terms = termsText.value.trim();
    const next = parseFromText(configText.value);
    active.prizesText = configText.value;
    SLICES = next;
    saveTemplates();
    refreshTemplateUI();
    drawWheel(true);
    drawLogo();
    showToast('💾 Template saved & applied');
  } catch(err){
    showToast('❌ '+err.message);
  }
});
  tplDup.addEventListener('click', ()=>{ const copy=JSON.parse(JSON.stringify(active)); copy.name=(active.name||'Template')+' (copy)'; templates.splice(activeIndex+1,0,copy); saveTemplates(); setActive(activeIndex+1); refreshTemplateUI(); });
  tplDelete.addEventListener('click', ()=>{
  if(templates.length<=1){ showToast('⚠️ Keep at least one template'); return; }
  templates.splice(activeIndex,1);
  saveTemplates();
  setActive(Math.max(0, activeIndex-1));
  refreshTemplateUI();
  showToast('🗑️ Template deleted');
});
  templateSelect.addEventListener('change', (e)=> setActive(parseInt(e.target.value,10)) );

  // File helpers -------------------------------------------------------------
  async function fileToDataURL(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); }); }
  
  // Page Background handlers
  pageBgFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.bg=await fileToDataURL(f); saveTemplates(); drawBackground(); showToast('🖼️ Page background set'); document.getElementById('pageBgImageHint').style.display='block'; });
  pageBgClear.addEventListener('click', ()=>{ active.assets.bg=null; saveTemplates(); drawBackground(); document.getElementById('pageBgImageHint').style.display='none'; });
  
  // Show/hide page background hint based on type
  pageBgType.addEventListener('change', ()=>{ 
    const hint = document.getElementById('pageBgImageHint');
    if(pageBgType.value === 'image') {
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
  });
  
  // Loading screen handlers
  const loadingScreenFile = document.getElementById('loadingScreenFile');
  const loadingScreenClear = document.getElementById('loadingScreenClear');
  loadingScreenFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.loadingScreen=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Loading screen set'); });
  loadingScreenClear.addEventListener('click', ()=>{ active.assets.loadingScreen=null; saveTemplates(); hideLoadingScreen(); showToast('🗑️ Loading screen cleared'); });
  
  // Logo handlers
  logoFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.logo=await fileToDataURL(f); saveTemplates(); drawLogo(); drawGameLogo(); showToast('🖼️ Logo set'); });
  logoClear.addEventListener('click', ()=>{ active.assets.logo=null; saveTemplates(); drawLogo(); drawGameLogo(); });
  
  // Game Logo handlers
  const gameLogoFile = document.getElementById('gameLogoFile');
  const gameLogoClear = document.getElementById('gameLogoClear');
  gameLogoFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.gameLogo=await fileToDataURL(f); saveTemplates(); drawGameLogo(); showToast('🖼️ Game logo set'); });
  gameLogoClear.addEventListener('click', ()=>{ active.assets.gameLogo=null; saveTemplates(); drawGameLogo(); });
  
  

  // Wheel Image handlers
  wheelFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.wheel=await fileToDataURL(f); saveTemplates(); drawWheel(true); showToast('🖼️ Wheel image set - Prize weights still work!'); });
  wheelClear.addEventListener('click', ()=>{ active.assets.wheel=null; saveTemplates(); drawWheel(true); });
  
  // Hub (center button) handlers
  hubFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.hub=await fileToDataURL(f); active.assets.spin=active.assets.hub; saveTemplates(); drawWheel(true); showToast('🖼️ Hub/center image set'); });
  hubClear.addEventListener('click', ()=>{ active.assets.hub=null; active.assets.spin=null; saveTemplates(); drawWheel(true); });
  
  // Pointer (arrow) handlers
  pointerFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.pointer=await fileToDataURL(f); saveTemplates(); drawWheel(true); showToast('🖼️ Arrow pointer image set'); });
  pointerClear.addEventListener('click', ()=>{ active.assets.pointer=null; saveTemplates(); drawWheel(true); });
  
  // Button color handlers (canvasBtnTextColor and canvasBtnHoverColor handlers set up later)
  canvasRewardsBtnColor.addEventListener('change', (e)=>{ active.colors.canvasRewardsBtnColor=e.target.value; saveTemplates(); drawTopbar(); });
  canvasInfoBtnColor.addEventListener('change', (e)=>{ active.colors.canvasInfoBtnColor=e.target.value; saveTemplates(); drawTopbar(); });

  // Canvas UI Image handlers
  const canvasRewardsBtnFile = document.getElementById('canvasRewardsBtnFile');
  const canvasRewardsBtnClear = document.getElementById('canvasRewardsBtnClear');
  const canvasInfoBtnFile = document.getElementById('canvasInfoBtnFile');
  const canvasInfoBtnClear = document.getElementById('canvasInfoBtnClear');
  const canvasSoundUnmuteFile = document.getElementById('canvasSoundUnmuteFile');
  const canvasSoundUnmuteClear = document.getElementById('canvasSoundUnmuteClear');
  const canvasSoundMuteFile = document.getElementById('canvasSoundMuteFile');
  const canvasSoundMuteClear = document.getElementById('canvasSoundMuteClear');
  const canvasSpinBtnFile = document.getElementById('canvasSpinBtnFile');
  const canvasSpinBtnClear = document.getElementById('canvasSpinBtnClear');
  const canvasRewardsModalFile = document.getElementById('canvasRewardsModalFile');
  const canvasRewardsModalClear = document.getElementById('canvasRewardsModalClear');
  const canvasRewardsCloseFile = document.getElementById('canvasRewardsCloseFile');
  const canvasRewardsCloseClear = document.getElementById('canvasRewardsCloseClear');
  const canvasInfoModalFile = document.getElementById('canvasInfoModalFile');
  const canvasInfoModalClear = document.getElementById('canvasInfoModalClear');
  const canvasInfoCloseFile = document.getElementById('canvasInfoCloseFile');
  const canvasInfoCloseClear = document.getElementById('canvasInfoCloseClear');
  const canvasCongratsModalFile = document.getElementById('canvasCongratsModalFile');
  const canvasCongratsModalClear = document.getElementById('canvasCongratsModalClear');
  const canvasCongratsCloseFile = document.getElementById('canvasCongratsCloseFile');
  const canvasCongratsCloseClear = document.getElementById('canvasCongratsCloseClear');

  // Canvas color controls
  const canvasBtnPrimaryColor = document.getElementById('canvasBtnPrimaryColor');
  const canvasBtnHoverColor = document.getElementById('canvasBtnHoverColor');
  const canvasBtnTextColor = document.getElementById('canvasBtnTextColor');
  const canvasModalBgColor = document.getElementById('canvasModalBgColor');
  const canvasModalBorderColor = document.getElementById('canvasModalBorderColor');
  const canvasModalTextColor = document.getElementById('canvasModalTextColor');
  const canvasSpinBtnColor = document.getElementById('canvasSpinBtnColor');
  const canvasSpinBtnHoverColor = document.getElementById('canvasSpinBtnHoverColor');
  const canvasSpinBtnBorderColor = document.getElementById('canvasSpinBtnBorderColor');

  // Prize control
  const guaranteedPrize = document.getElementById('guaranteedPrize');
  const guaranteedPrizeEnabled = document.getElementById('guaranteedPrizeEnabled');
  const guaranteedSpinCount = document.getElementById('guaranteedSpinCount');
  const guaranteedSpinCountRow = document.getElementById('guaranteedSpinCountRow');
  const guaranteedPrizeSequenceRow = document.getElementById('guaranteedPrizeSequenceRow');
  const guaranteedPrizeSequence = document.getElementById('guaranteedPrizeSequence');
  
  // Track spin count for guaranteed prize feature
  let spinCount = 0;

  // Canvas UI Image event handlers
  canvasRewardsBtnFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasRewardsBtn=await fileToDataURL(f); saveTemplates(); drawTopbar(); showToast('🖼️ Canvas Rewards button image set'); });
  canvasRewardsBtnClear.addEventListener('click', ()=>{ active.assets.canvasRewardsBtn=null; saveTemplates(); drawTopbar(); });
  
  canvasInfoBtnFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasInfoBtn=await fileToDataURL(f); saveTemplates(); drawTopbar(); showToast('🖼️ Canvas Info button image set'); });
  canvasInfoBtnClear.addEventListener('click', ()=>{ active.assets.canvasInfoBtn=null; saveTemplates(); drawTopbar(); });
  
  canvasSoundUnmuteFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasSoundUnmute=await fileToDataURL(f); saveTemplates(); drawTopbar(); showToast('🖼️ Canvas Sound unmute button image set'); });
  canvasSoundUnmuteClear.addEventListener('click', ()=>{ active.assets.canvasSoundUnmute=null; saveTemplates(); drawTopbar(); });
  
  canvasSoundMuteFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasSoundMute=await fileToDataURL(f); saveTemplates(); drawTopbar(); showToast('🖼️ Canvas Sound mute button image set'); });
  canvasSoundMuteClear.addEventListener('click', ()=>{ active.assets.canvasSoundMute=null; saveTemplates(); drawTopbar(); });
  
  canvasSpinBtnFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasSpinBtn=await fileToDataURL(f); saveTemplates(); drawSpinButton(); showToast('🖼️ Canvas Spin button image set'); });
  canvasSpinBtnClear.addEventListener('click', ()=>{ active.assets.canvasSpinBtn=null; saveTemplates(); drawSpinButton(); });
  
  canvasRewardsModalFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasRewardsModal=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Canvas Rewards modal background set'); });
  canvasRewardsModalClear.addEventListener('click', ()=>{ active.assets.canvasRewardsModal=null; saveTemplates(); });
  canvasRewardsCloseFile?.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasRewardsClose=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Canvas Rewards close button set'); });
  canvasRewardsCloseClear?.addEventListener('click', ()=>{ active.assets.canvasRewardsClose=null; saveTemplates(); });
  
  canvasInfoModalFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasInfoModal=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Canvas Info modal background set'); });
  canvasInfoModalClear.addEventListener('click', ()=>{ active.assets.canvasInfoModal=null; saveTemplates(); });
  canvasInfoCloseFile?.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasInfoClose=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Canvas Info close button set'); });
  canvasInfoCloseClear?.addEventListener('click', ()=>{ active.assets.canvasInfoClose=null; saveTemplates(); });
  
  canvasCongratsModalFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasCongratsModal=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Canvas Congratulations modal background set'); });
  canvasCongratsModalClear.addEventListener('click', ()=>{ active.assets.canvasCongratsModal=null; saveTemplates(); });
  canvasCongratsCloseFile?.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.canvasCongratsClose=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Canvas Congratulations close button set'); });
  canvasCongratsCloseClear?.addEventListener('click', ()=>{ active.assets.canvasCongratsClose=null; saveTemplates(); });

  // Canvas color event handlers
  canvasBtnPrimaryColor.addEventListener('change', ()=>{ active.colors.canvasBtnPrimary=canvasBtnPrimaryColor.value; saveTemplates(); drawTopbar(); });
  canvasBtnHoverColor.addEventListener('change', ()=>{ active.colors.canvasBtnHover=canvasBtnHoverColor.value; saveTemplates(); drawTopbar(); });
  canvasBtnTextColor.addEventListener('change', ()=>{ active.colors.canvasBtnText=canvasBtnTextColor.value; saveTemplates(); drawTopbar(); });
  canvasModalBgColor.addEventListener('change', ()=>{ active.colors.canvasModalBg=canvasModalBgColor.value; saveTemplates(); });
  canvasModalBorderColor.addEventListener('change', ()=>{ active.colors.canvasModalBorder=canvasModalBorderColor.value; saveTemplates(); });
  canvasModalTextColor.addEventListener('change', ()=>{ active.colors.canvasModalText=canvasModalTextColor.value; saveTemplates(); });
  canvasSpinBtnColor.addEventListener('change', ()=>{ active.colors.canvasSpinBtn=canvasSpinBtnColor.value; saveTemplates(); drawSpinButton(); });
  canvasSpinBtnHoverColor.addEventListener('change', ()=>{ active.colors.canvasSpinBtnHover=canvasSpinBtnHoverColor.value; saveTemplates(); drawSpinButton(); });
  canvasSpinBtnBorderColor.addEventListener('change', ()=>{ active.colors.canvasSpinBtnBorder=canvasSpinBtnBorderColor.value; saveTemplates(); drawSpinButton(); });

  // Note: Max spins are now controlled by 3rd party backend (URewards)
  // Use API endpoint: POST /api/gameplay/player/:playerId/spins

  // Guaranteed prize event handler
  guaranteedPrize.addEventListener('change', ()=>{ 
    // Ensure settings object exists
    if (!active.settings) {
      active.settings = {};
    }
    // Normalize empty string to null/undefined for random mode
    const newGuaranteedPrize = guaranteedPrize.value && guaranteedPrize.value.trim() ? guaranteedPrize.value : null;
    
    // Clear any sequence selections that match the new guaranteed prize
    if (active.settings.guaranteedPrizeSequence && newGuaranteedPrize) {
      active.settings.guaranteedPrizeSequence = active.settings.guaranteedPrizeSequence.map(seqPrize => 
        seqPrize === newGuaranteedPrize ? null : seqPrize
      );
    }
    
    active.settings.guaranteedPrize = newGuaranteedPrize;
    
    // Enable/disable the "Enable Guaranteed Prize on Nth Spin" checkbox based on whether a prize is selected
    if (!newGuaranteedPrize) {
      // No guaranteed prize selected - disable and uncheck the checkbox
      guaranteedPrizeEnabled.disabled = true;
      guaranteedPrizeEnabled.checked = false;
      active.settings.guaranteedPrizeEnabled = false;
      guaranteedSpinCountRow.style.display = 'none';
      guaranteedPrizeSequenceRow.style.display = 'none';
    } else {
      // Guaranteed prize selected - enable the checkbox
      guaranteedPrizeEnabled.disabled = false;
    }
    
    // Regenerate prize sequence boxes if enabled (to update available options)
    if (guaranteedPrizeEnabled.checked && newGuaranteedPrize) {
      generatePrizeSequenceBoxes();
    }
    
    saveTemplates(); 
    if (active.settings.guaranteedPrize) {
      const prizeLabel = SLICES.find(s => s.id === active.settings.guaranteedPrize)?.label;
      showToast('🎯 Guaranteed prize set: ' + prizeLabel);
    } else {
      showToast('🎲 Random prizes enabled');
    }
  });

  // Enhanced guaranteed prize settings
  guaranteedPrizeEnabled.addEventListener('change', ()=>{ 
    if (!active.settings) {
      active.settings = {};
    }
    active.settings.guaranteedPrizeEnabled = guaranteedPrizeEnabled.checked;
    guaranteedSpinCountRow.style.display = guaranteedPrizeEnabled.checked ? 'flex' : 'none';
    
    // Generate prize sequence boxes when enabled
    if (guaranteedPrizeEnabled.checked) {
      generatePrizeSequenceBoxes();
      showToast('✅ Guaranteed prize on Nth spin enabled');
    } else {
      guaranteedPrizeSequenceRow.style.display = 'none';
      showToast('🎲 Guaranteed prize every spin (if set)');
    }
    saveTemplates();
  });

  guaranteedSpinCount.addEventListener('change', ()=>{ 
    if (!active.settings) {
      active.settings = {};
    }
    const maxSpins = SLICES.length; // Maximum is total number of prizes
    const count = parseInt(guaranteedSpinCount.value) || 5;
    // Enforce minimum of 2 and maximum of total prizes
    active.settings.guaranteedSpinCount = Math.max(2, Math.min(maxSpins, count));
    guaranteedSpinCount.value = active.settings.guaranteedSpinCount;
    
    // Update max attribute dynamically
    guaranteedSpinCount.max = maxSpins;
    
    // Generate prize sequence select boxes
    generatePrizeSequenceBoxes();
    saveTemplates();
  });

  // Function to generate prize sequence select boxes
  function generatePrizeSequenceBoxes() {
    if (!guaranteedPrizeEnabled.checked) {
      guaranteedPrizeSequenceRow.style.display = 'none';
      return;
    }

    const maxSpins = SLICES.length; // Maximum is total number of prizes
    const count = parseInt(guaranteedSpinCount.value) || 5;
    
    // Enforce limits: minimum 2, maximum total prizes
    const validCount = Math.max(2, Math.min(maxSpins, count));
    if (validCount !== count) {
      guaranteedSpinCount.value = validCount;
      if (active.settings) {
        active.settings.guaranteedSpinCount = validCount;
      }
    }
    
    // Update max attribute
    guaranteedSpinCount.max = maxSpins;
    
    guaranteedPrizeSequence.innerHTML = '';
    
    // Initialize sequence array if it doesn't exist or ensure it's the right length
    if (!active.settings) {
      active.settings = {};
    }
    if (!active.settings.guaranteedPrizeSequence) {
      active.settings.guaranteedPrizeSequence = [];
    }
    
    // Ensure array is the right length (validCount - 1)
    while (active.settings.guaranteedPrizeSequence.length < validCount - 1) {
      active.settings.guaranteedPrizeSequence.push(null);
    }
    // Trim array if it's too long
    if (active.settings.guaranteedPrizeSequence.length > validCount - 1) {
      active.settings.guaranteedPrizeSequence = active.settings.guaranteedPrizeSequence.slice(0, validCount - 1);
    }
    
    const finalCount = validCount;
    
    // Create select boxes for spins 1 to (finalCount-1)
    for (let i = 1; i < finalCount; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.marginBottom = '8px';
      
      const label = document.createElement('label');
      label.textContent = `Spin ${i}:`;
      label.style.minWidth = '80px';
      
      const select = document.createElement('select');
      select.id = `guaranteedPrizeSeq${i}`;
      
      // Filter out the guaranteed prize from the options
      const guaranteedPrizeId = active.settings?.guaranteedPrize;
      const availablePrizes = SLICES.filter(slice => 
        !guaranteedPrizeId || slice.id !== guaranteedPrizeId
      );
      
      select.innerHTML = '<option value="">Random Prize</option>' + 
        availablePrizes.map(slice => `<option value="${slice.id}">${slice.label}</option>`).join('');
      
      // Set saved value if exists
      if (active.settings.guaranteedPrizeSequence[i - 1]) {
        select.value = active.settings.guaranteedPrizeSequence[i - 1];
      }
      
      // Add change event listener
      select.addEventListener('change', () => {
        if (!active.settings) {
          active.settings = {};
        }
        if (!active.settings.guaranteedPrizeSequence) {
          active.settings.guaranteedPrizeSequence = [];
        }
        // Ensure array is long enough
        while (active.settings.guaranteedPrizeSequence.length < i) {
          active.settings.guaranteedPrizeSequence.push(null);
        }
        active.settings.guaranteedPrizeSequence[i - 1] = select.value && select.value.trim() ? select.value : null;
        saveTemplates();
        console.log('Prize sequence updated:', active.settings.guaranteedPrizeSequence);
      });
      
      row.appendChild(label);
      row.appendChild(select);
      guaranteedPrizeSequence.appendChild(row);
    }
    
    guaranteedPrizeSequenceRow.style.display = 'block';
  }


  // Prize area ---------------------------------------------------------------
  // Sync frontend prizes to backend
  async function syncPrizesToBackend() {
    try {
      const prizes = SLICES.map(s => ({ 
        id: s.id, 
        label: s.label, 
        weight: s.weight, 
        color: s.color 
      }));
      
      // Build designConfig (maxSpins removed - controlled by 3rd party backend)
      const designConfig = {
        assets: active.assets || {},
        colors: active.colors || {},
        wheelSize: parseFloat(sizeRange.value) || 1.6,
        ...(active.designConfig || {})
      };
      // Remove maxSpins from designConfig as it's now controlled by 3rd party
      delete designConfig.maxSpins;
      
      const config = {
        template: active.name,
        prizes: prizes,
        guaranteedPrize: active.settings?.guaranteedPrize || null,
        guaranteedPrizeEnabled: active.settings?.guaranteedPrizeEnabled || false,
        guaranteedSpinCount: active.settings?.guaranteedSpinCount || 5,
        guaranteedPrizeSequence: active.settings?.guaranteedPrizeSequence || [],
        designConfig: designConfig,
        termsAndConditions: active.terms || null
      };
      
      const response = await fetch(`${MICROSERVICE_GATEWAY}/api/gameplay/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        console.log('✅ Prizes synced to backend:', prizes.length, 'prizes');
        return true;
      } else {
        console.warn('⚠️ Failed to sync prizes to backend:', response.status);
        return false;
      }
    } catch (err) {
      console.warn('⚠️ Error syncing prizes to backend:', err);
      return false;
    }
  }

  applyBtn.addEventListener('click', async ()=>{
  try{
    const next=parseFromText(configText.value);
    SLICES=next; active.prizesText=configText.value; active.terms = termsText.value.trim(); saveTemplates();
    refreshTemplateUI();
    // Regenerate prize sequence boxes if enabled (to update with new prizes and max value)
    if (guaranteedPrizeEnabled.checked) {
      // Update max value based on new prize count
      const maxSpins = SLICES.length;
      const currentCount = parseInt(guaranteedSpinCount.value) || 5;
      const validCount = Math.max(2, Math.min(maxSpins, currentCount));
      if (validCount !== currentCount) {
        guaranteedSpinCount.value = validCount;
        if (active.settings) {
          active.settings.guaranteedSpinCount = validCount;
        }
      }
      guaranteedSpinCount.max = maxSpins;
      generatePrizeSequenceBoxes();
    }
    drawWheel(true);
    
    // Auto-sync prizes to backend so Postman can use them
    await syncPrizesToBackend();
    
    showToast('✅ Prizes applied and synced to backend');
  }catch(err){ showToast('❌ '+err.message); }
});
  addBtn.addEventListener('click', ()=>{ const v=(quickAdd.value||'').trim(); if(!v) return; configText.value=(configText.value.trim()+"\n"+v).trim(); quickAdd.value=''; applyBtn.click(); });
  sampleBtn.addEventListener('click', ()=>{ const N=200; const counts=Object.fromEntries(SLICES.map(s=>[s.label,0])); for(let i=0;i<N;i++){ const it=pickWeighted(SLICES); counts[it.label]++; } console.table(counts); showToast('🧪 Check console: 200-spin sample'); });
  exportBtn.addEventListener('click', ()=>{ const json=JSON.stringify(SLICES,null,2); navigator.clipboard?.writeText(json); showToast('📋 JSON copied'); });
  
  // Element type change handlers
  pageBgType.addEventListener('change', ()=>{
    const type = pageBgType.value;
    pageBgColorRow.style.display = type === 'color' ? 'flex' : 'none';
    pageBgGradientRow.style.display = type === 'gradient' ? 'flex' : 'none';
    pageBgImageRow.style.display = type === 'image' ? 'flex' : 'none';
    updatePageBackground();
  });
  
  
  
  
  
  
  // Color change handlers
  pageBgColor.addEventListener('input', updatePageBackground);
  pageBgGradient1.addEventListener('input', updatePageBackground);
  pageBgGradient2.addEventListener('input', updatePageBackground);
  pageBgGradientDirection.addEventListener('change', updatePageBackground);
  
  
  
  
  
  // Reset to default functionality
  resetToDefault.addEventListener('click', ()=>{
    if(confirm('Are you sure you want to reset to default settings? This will clear all customizations.')) {
      // Reset to default template
      const defaultTpl = defaultTemplate();
      active.name = defaultTpl.name;
      active.terms = defaultTpl.terms;
      active.prizesText = defaultTpl.prizesText;
      active.assets = defaultTpl.assets;
      active.colors = defaultTpl.colors;
      active.settings = defaultTpl.settings;
      // Persist immediately so UI reflects defaults
      saveTemplates();
      
      // Reset UI elements
      templateName.value = active.name;
      termsText.value = active.terms;
      configText.value = active.prizesText;
      
      // Reset color pickers
      bgType.value = 'color';
      bgColor.value = '#0a2b22';
      
      // Reset canvas color pickers
      canvasBtnPrimaryColor.value = '#17342c';
      canvasBtnHoverColor.value = '#1b3e33';
      canvasBtnTextColor.value = '#d9fff2';
      canvasModalBgColor.value = '#0e1f1a';
      canvasModalBorderColor.value = '#204a3e';
      canvasModalTextColor.value = '#e8fff5';
      canvasSpinBtnColor.value = '#24d58b';
      canvasSpinBtnHoverColor.value = '#2be68b';
      canvasSpinBtnBorderColor.value = '#0fb168';
      
      // Reset claim button settings
      claimAction.value = 'modal';
      claimUrl.value = '';
      claimUrlRow.style.display = 'none';
      
      // Reset guaranteed prize
      guaranteedPrize.value = '';
      guaranteedPrizeEnabled.disabled = true;
      guaranteedPrizeEnabled.checked = false;
      guaranteedSpinCount.value = 5;
      guaranteedSpinCountRow.style.display = 'none';
      guaranteedPrizeSequenceRow.style.display = 'none';
      if (active.settings) {
        active.settings.guaranteedPrize = ''; // Reset guaranteed prize to empty
        active.settings.guaranteedPrizeEnabled = false;
        active.settings.guaranteedSpinCount = 5;
        active.settings.guaranteedPrizeSequence = [];
      }
      
      // Clear all file inputs so re-uploading same file triggers change
      [
        pageBgFile,
        logoFile,
        wheelFile,
        canvasRewardsBtnFile,
        canvasInfoBtnFile,
        canvasSoundUnmuteFile,
        canvasSoundMuteFile,
        canvasSpinBtnFile,
        canvasRewardsModalFile,
        canvasRewardsCloseFile,
        canvasInfoModalFile,
        canvasInfoCloseFile,
        canvasCongratsModalFile,
        canvasCongratsCloseFile
      ].forEach((inp)=>{ if(inp) inp.value=''; });

      // Reset wheel size
      sizeRange.value = '1.6';
      sizeMultiplier = 1.6;
      
      // Reset spin count for guaranteed prize logic (important!)
      spinCount = 0;
      
      // Ensure guaranteed prize is fully reset (fix for broken logic after reset)
      // This must be done AFTER active.settings is set from defaultTpl
      if (active.settings) {
        active.settings.guaranteedPrize = '';
        active.settings.guaranteedPrizeEnabled = false;
        active.settings.guaranteedSpinCount = 5;
        active.settings.guaranteedPrizeSequence = [];
      }
      
      // Save and refresh
      saveTemplates();
      SLICES = parseFromText(active.prizesText);
      refreshTemplateUI();
      drawBackground();
      drawWheel(true);
      drawLogo();
      drawTopbar();
      updateSoundButton?.();
      drawSpinButton();
      updateBackground();
      updateButton();
      
      // Sync reset config to backend
      syncPrizesToBackend();
      
      showToast('🔄 Reset to default settings');
    }
  });
  
  function updatePageBackground() {
    const type = pageBgType.value;
    let bgStyle = '';
    
    if(type === 'color') {
      bgStyle = pageBgColor.value;
    } else if(type === 'gradient') {
      const direction = pageBgGradientDirection.value;
      const color1 = pageBgGradient1.value;
      const color2 = pageBgGradient2.value;
      
      if(direction === 'radial') {
        bgStyle = `radial-gradient(circle, ${color1}, ${color2})`;
      } else {
        bgStyle = `linear-gradient(${direction}, ${color1}, ${color2})`;
      }
    }
    
    if(bgStyle) {
      document.body.style.background = bgStyle;
      // Store in template for export and canvas
      if(!active.colors) active.colors = {};
      active.colors.pageBackground = { type, style: bgStyle };
      saveTemplates();
      // Redraw canvas background if using color
      drawBackground();
    }
  }
  
  function updateLogo() {
    // Logo is image-only, no styling needed
    saveTemplates();
  }
  
  
  

  // Export standalone HTML functionality
  exportStandalone.addEventListener('click', async ()=>{
    try {
      showToast('🔄 Generating standalone HTML...');
      
      // Get current template data
      const templateData = {
        name: active.name || 'Spin Wheel',
        prizesText: active.prizesText,
        terms: active.terms,
        assets: active.assets,
        colors: active.colors || {},
        wheelSize: parseFloat(sizeRange.value) || 1.3
      };
      
      // Generate standalone HTML
      const standaloneHTML = generateStandaloneHTML(templateData);
      
      // Create and download file
      const blob = new Blob([standaloneHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${templateData.name.replace(/[^a-zA-Z0-9]/g, '_')}_spin_wheel.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('✅ Standalone HTML exported!');
    } catch (err) {
      console.error('Export error:', err);
      showToast('❌ Export failed: ' + err.message);
    }
  });

  // Draw layers & sprites ----------------------------------------------------
  const bgSprite = new PIXI.Sprite(); bgLayer.addChild(bgSprite);
  const logoSprite = new PIXI.Sprite(); root.addChild(logoSprite);
  const gameLogoSprite = new PIXI.Sprite(); root.addChild(gameLogoSprite);
  const chanceCounterBg = new PIXI.Graphics(); root.addChild(chanceCounterBg);
  const chanceCounterText = new PIXI.Text('', { fill: 0xffffff, fontSize: 30, fontWeight: 'bold', fontFamily: 'Arial' }); root.addChild(chanceCounterText);
  const chanceCounterValue = new PIXI.Text('', { fill: 0xffffff, fontSize: 30, fontWeight: 'bold', fontFamily: 'Arial' }); root.addChild(chanceCounterValue);
  const base=new PIXI.Graphics(); const rim=new PIXI.Graphics(); const wheel=new PIXI.Container(); const hub=new PIXI.Graphics(); const goText=new PIXI.Text('GO', { fill:'#0e7b55', fontSize:36, fontWeight:'900', fontFamily:'Inter, Arial' }); const spinSprite=new PIXI.Sprite(); const pointer=new PIXI.Graphics(); const pointerSprite=new PIXI.Sprite(); const dots=new PIXI.Graphics(); const labels=[]; const wheelImageSprite=new PIXI.Sprite(); const hubLayer=new PIXI.Container();
  // draw order: base/rim (static), wheel (contains wheelImageSprite + slices), dots, hubLayer (static), pointer (static or sprite)
  wheelContainer.addChild(base, rim, wheel, dots, hubLayer, pointer, pointerSprite);
  let WHEEL_RADIUS = CONFIG.BASE_RADIUS;

  function drawBackground(){
    const vw=app.renderer.width, vh=app.renderer.height;
    // Default: clear
    bgSprite.tint = 0xFFFFFF;
    bgSprite.texture = PIXI.Texture.EMPTY;
    
    // If background image is set, use it
    if(active.assets.bg){
      bgSprite.texture = PIXI.Texture.from(active.assets.bg);
      if(bgSprite.texture.baseTexture.valid){
        const iw=bgSprite.texture.width, ih=bgSprite.texture.height;
        const s=Math.max(vw/iw, vh/ih);
        bgSprite.scale.set(s);
        bgSprite.x=(vw - iw*s)/2; bgSprite.y=(vh - ih*s)/2;
      }
      return;
    }
    
    // If a solid page background color is configured, paint it inside canvas
    const pg = active.colors?.pageBackground;
    if(pg && pg.type === 'color' && typeof pg.style === 'string'){
      // Parse hex like #RRGGBB
      const hex = pg.style.trim().startsWith('#') ? pg.style.trim().slice(1) : null;
      if(hex && /^([0-9a-fA-F]{6})$/.test(hex)){
        const color = parseInt(hex,16);
        bgSprite.texture = PIXI.Texture.WHITE;
        bgSprite.tint = color;
        bgSprite.width = vw; bgSprite.height = vh;
        bgSprite.x = 0; bgSprite.y = 0;
      }
    }
  }
  function drawLogo(){ 
    // Only draw if logo asset exists
    if(!active.assets.logo) {
      logoSprite.texture = PIXI.Texture.EMPTY;
      logoSprite.visible = false;
      return;
    }
    
    logoSprite.texture = PIXI.Texture.from(active.assets.logo);
    logoSprite.visible = true;
    logoSprite.anchor.set(0.5, 0.5); 
    
    // ===== LOGO SIZE =====
    // Mobile: smaller, Web: original size
    const mobile = isMobile();
    const sc = mobile ? 0.4 : 0.5;  // Mobile: 40%, Web: 50% (smaller for topbar)
    
    logoSprite.scale.set(sc, sc); 
    
    // Position logo at topbar middle right
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    const buttonSize = mobile ? 30 : 35;
    const gap = mobile ? 8 : 5;
    const rightMargin = mobile ? 8 : 0;
    
    // Calculate top margin (same as topbar)
    let topMargin;
    if (mobile) {
      const safeArea = getSafeAreaInsets();
      topMargin = Math.max(12, safeArea.top + 8);
    } else {
      topMargin = 16;
    }
    
    // Calculate button positions (same as in drawTopbar)
    const buttonsCount = 3; // Rewards, Info, Sound
    const rightmostButtonX = vw - rightMargin - (buttonSize + gap) * buttonsCount;
    const buttonCenterY = topMargin + buttonSize / 2;
    
    // Position logo horizontally aligned with spin wheel (same X as wheel)
    // Wheel is at DESIGN.w/2 in DESIGN coordinates
    // Convert wheel X position to screen coordinates
    const wheelXDesign = wheelContainer.x; // Wheel X in DESIGN coordinates
    const wheelXScreen = root.x + (wheelXDesign * root.scale.x);
    
    // Use wheel's X position for logo, but keep Y at topbar level
    const logoXScreen = wheelXScreen; // Same X as wheel
    const logoYScreen = buttonCenterY; // Aligned with button centers (middle of topbar)
    
    // Convert to DESIGN coordinates
    logoSprite.x = (logoXScreen - root.x) / root.scale.x;
    logoSprite.y = (logoYScreen - root.y) / root.scale.y;
  }
  
  function drawGameLogo(){ 
    gameLogoSprite.texture=PIXI.Texture.EMPTY; 
    if(active.assets.gameLogo){ 
      gameLogoSprite.texture=PIXI.Texture.from(active.assets.gameLogo); 
    } 
    gameLogoSprite.anchor.set?.(0.5,0.5); 
    
    // ===== GAME LOGO SIZE =====
    // Mobile: smaller, Web: original size
    const mobile = isMobile();
    const gameLogoSc = mobile ? 0.35 : 0.5;  // Mobile: 35%, Web: 50%
    
    gameLogoSprite.scale.set(gameLogoSc, gameLogoSc); 
    
    // Game logo horizontal position - centered by default
    gameLogoSprite.x = DESIGN.w/2;  // Change this to adjust horizontal position
    
    // Game logo vertical position - positioned below the main logo
    // Calculate position based on main logo position
    const gameLogoSpacing = mobile ? 15 : 20;  // Mobile: closer, Web: original spacing
    if(active.assets.logo && logoSprite.texture !== PIXI.Texture.EMPTY){
      // Position below main logo if it exists
      gameLogoSprite.y = logoSprite.y + (logoSprite.height * logoSprite.scale.y) / 2 + gameLogoSpacing;
    } else {
      // If no main logo, position at same location as main logo would be
      const logoSpacing = 100;
      gameLogoSprite.y = wheelContainer.y - WHEEL_RADIUS - logoSpacing;
    }
  }
  
  function drawChanceCounter() {
    // Don't show "∞" until we've actually checked the session
    let chanceText;
    let isUnlimited = false;
    if (!sessionChecked) {
      chanceText = '...'; // Show loading state
      } else {
        // Handle NaN case - if remainingSpins is NaN, treat as null (unlimited)
        if (remainingSpins !== null && remainingSpins !== undefined && !isNaN(remainingSpins)) {
          chanceText = remainingSpins;
        } else {
          chanceText = '∞';
          isUnlimited = true;
        }
      }
    
    // Set label text
    chanceCounterText.text = 'CHANCE: ';
    chanceCounterText.anchor.set(0, 0.5);
    
    // Set value text
    chanceCounterValue.text = chanceText;
    chanceCounterValue.anchor.set(0, 0.5);
    const mobile = isMobile();
    
    // Get viewport dimensions for auto-scaling
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    
    // Auto-scale font size based on screen size (make chance text bigger)
    let fontSize, valueFontSize;
    if (mobile) {
      // Mobile: Make font size bigger, scale with screen width
      // Base size: 28px for 375px width (larger base)
      const baseWidth = 375; // iPhone SE width
      const baseFontSize = 28; // Larger base font size
      const scaleFactor = Math.min(vw / baseWidth, 1.6); // Scale up to 1.6x for larger screens
      fontSize = Math.round(baseFontSize * scaleFactor);
      // Clamp between 24px (very small screens) and 48px (large tablets) - larger max
      fontSize = Math.max(24, Math.min(48, fontSize));
      
      // Value font size (especially for ∞) should be significantly larger
      if (remainingSpins === null) {
        valueFontSize = Math.round(fontSize * 1.8); // ∞ symbol 80% larger
      } else {
        valueFontSize = Math.round(fontSize * 1.3); // Numbers 30% larger than label
      }
    } else {
      fontSize = 30; // Web: larger size
      valueFontSize = remainingSpins === null ? 45 : 30; // Web: ∞ larger, numbers same
    }
    chanceCounterText.style.fontSize = fontSize;
    chanceCounterValue.style.fontSize = valueFontSize;
    
    // Position below wheel - Mobile: tighter spacing, Web: original spacing
    const chanceY = wheelContainer.y + WHEEL_RADIUS + (mobile ? 60 : 130);
    const centerX = DESIGN.w/2;
    
    // Calculate total width to center both texts together
    const labelWidth = chanceCounterText.width;
    const valueWidth = chanceCounterValue.width;
    const totalWidth = labelWidth + valueWidth;
    
    // Position label and value side by side, centered
    chanceCounterText.x = centerX - totalWidth / 2;
    chanceCounterText.y = chanceY;
    chanceCounterValue.x = centerX - totalWidth / 2 + labelWidth;
    chanceCounterValue.y = chanceY;
    
    // Hide background - no border, no background, just text
    chanceCounterBg.clear();
  }

  function drawWheel(resetRotation=false){
    // Mobile: Use directly calculated radius (no fixed scale)
    // Web: Use multiplier method
    if (calculatedWheelRadius !== null && isMobile()) {
      WHEEL_RADIUS = calculatedWheelRadius; // Use directly calculated size
    } else {
      WHEEL_RADIUS = CONFIG.BASE_RADIUS * sizeMultiplier * autoMultiplier; // Web: original method
    }
    if(resetRotation) wheel.rotation = 0;

    // clear
    base.clear(); rim.clear(); wheel.removeChildren(); labels.length = 0;
    dots.clear(); hub.clear(); pointer.clear(); hubLayer.removeChildren();
    
    // Update logo position when wheel is redrawn
    drawLogo();
    drawGameLogo();
    drawChanceCounter();

    // ensure the custom wheel sprite is inside the rotating 'wheel' container
    if(wheelImageSprite.parent !== wheel){ wheelImageSprite.parent?.removeChild(wheelImageSprite); wheel.addChildAt(wheelImageSprite, 0); }
    wheelImageSprite.texture = PIXI.Texture.EMPTY;

    // base + rim (static)
    base.beginFill(0x071a15).drawCircle(0,0,WHEEL_RADIUS+28).endFill(); base.alpha = 0.9;
    rim.beginFill(0x114b3c).drawCircle(0,0,WHEEL_RADIUS+12).endFill();

    // content: either custom wheel art or drawn slices + labels
    if(active.assets.wheel){
      wheelImageSprite.texture = PIXI.Texture.from(active.assets.wheel);
      wheelImageSprite.anchor.set(0.5);
      const iw = wheelImageSprite.texture.width, ih = wheelImageSprite.texture.height;
      const s = (WHEEL_RADIUS*2) / Math.max(iw, ih);
      wheelImageSprite.scale.set(s);
      wheelImageSprite.x = 0; wheelImageSprite.y = 0;
    } else {
      const sliceAngle = Math.PI * 2 / SLICES.length;
      for(let i=0;i<SLICES.length;i++){
        const {color,label} = SLICES[i];
        const g = new PIXI.Graphics();
        g.beginFill(normalizeColor(color)).moveTo(0,0)
          .arc(0,0,WHEEL_RADIUS,-Math.PI/2 + i*sliceAngle, -Math.PI/2 + (i+1)*sliceAngle)
          .lineTo(0,0).endFill();
        g.lineStyle(2,0xffffff,0.15)
          .arc(0,0,WHEEL_RADIUS,-Math.PI/2 + i*sliceAngle, -Math.PI/2 + (i+1)*sliceAngle);
        wheel.addChild(g);

        const t = new PIXI.Text(label, { fill:'#063e2f', fontSize: Math.max(18, WHEEL_RADIUS*0.06), fontWeight:'800', fontFamily:'Inter, Arial', align:'center', wordWrap:true, wordWrapWidth: Math.max(140, WHEEL_RADIUS*0.45) });
        t.anchor.set(0.5);
        const mid = -Math.PI/2 + (i+0.5)*sliceAngle; const r = WHEEL_RADIUS * 0.62;
        t.x = Math.cos(mid)*r; t.y = Math.sin(mid)*r; t.rotation = mid + Math.PI/2;
        labels.push(t); wheel.addChild(t);
      }
    }

    // hub (non-rotating)
    const HR = CONFIG.HUB_RADIUS * (WHEEL_RADIUS/CONFIG.BASE_RADIUS);
    if(active.assets.hub || active.assets.spin){
      const hubAsset = active.assets.hub || active.assets.spin;
      spinSprite.texture = PIXI.Texture.from(hubAsset);
      spinSprite.anchor.set(0.5);
      const iw = spinSprite.texture.width, ih = spinSprite.texture.height;
      const s = (HR*2) / Math.max(iw, ih);
      spinSprite.scale.set(s);
      spinSprite.x = 0; spinSprite.y = 0; hubLayer.addChild(spinSprite);
    } else {
      hub.beginFill(0xf9fffd).drawCircle(0,0,HR).endFill(); hub.lineStyle(6,0x1ab377,1).drawCircle(0,0,HR);
      goText.style.fontSize = Math.max(28, HR*0.55); goText.anchor.set(0.5); goText.rotation = 0;
      hubLayer.addChild(hub, goText);
    }

    // pointer (non-rotating) - use image if available, otherwise draw
    const baseY = -HR - 6; const tipY  = -HR - 34 * (WHEEL_RADIUS/CONFIG.BASE_RADIUS);
    if(active.assets.pointer){
      pointer.clear();
      pointerSprite.texture = PIXI.Texture.from(active.assets.pointer);
      pointerSprite.anchor.set(0.5, 1); // Anchor at bottom center
      const iw = pointerSprite.texture.width, ih = pointerSprite.texture.height;
      const scale = 1.0; // Adjust scale as needed
      pointerSprite.scale.set(scale);
      pointerSprite.x = 0;
      pointerSprite.y = tipY;
      pointerSprite.rotation = 0;
    } else {
      pointerSprite.texture = PIXI.Texture.EMPTY;
      pointer.clear();
    pointer.beginFill(0xffee66).drawPolygon([ -14, baseY, 14, baseY, 0, tipY ]).endFill();
    pointer.lineStyle(3,0x8a7a28,1).moveTo(-14, baseY).lineTo(14, baseY).lineTo(0, tipY).lineTo(-14, baseY);
    }

    // dots (decor)
    dots.beginFill(0xffffff,0.9);
    const N = 60; for(let i=0;i<N;i++){ const a=-Math.PI/2 + i*(Math.PI*2/N); dots.drawCircle(Math.cos(a)*(WHEEL_RADIUS+4), Math.sin(a)*(WHEEL_RADIUS+4), i%2?2.5:1.7);} dots.endFill();
  }

  // Picker + angles ----------------------------------------------------------
  const TWO_PI = Math.PI * 2;
  const globalSliceAngle = ()=> TWO_PI / SLICES.length;
  function pickWeighted(items, excludeId = null){ 
    const forceIdx=forceSelect.value!==''? parseInt(forceSelect.value,10):null; 
    if(Number.isInteger(forceIdx)&&items[forceIdx]) return items[forceIdx]; 
    
    // Filter out excluded prize if specified
    const filteredItems = excludeId ? items.filter(item => item.id !== excludeId) : items;
    if (filteredItems.length === 0) {
      // If all items are excluded, fallback to all items
      return items[items.length - 1];
    }
    
    const total=filteredItems.reduce((s,x)=>s+(x.weight??1),0); 
    let r=Math.random()*total; 
    for(const it of filteredItems){ 
      r-=(it.weight??1); 
      if(r<=0) return it; 
    } 
    return filteredItems[filteredItems.length-1]; 
  }
  function centerAngleForIndex(idx){
    // Angle that makes the pointer (fixed at the top) land at the *center* of slice idx
    // Derivation: rotate wheel by theta so local center angle α maps to -PI/2 (top).
    // With our slice layout, α_i = -PI/2 + (i+0.5)*slice.
    // Solve α_i + theta = -PI/2  =>  theta = -(i+0.5)*slice
    const slice = globalSliceAngle();
    return - (idx + 0.5) * slice;
  }
  function angleForSlice(idx){ return centerAngleForIndex(idx); }
  function normAngle(a){ a%=TWO_PI; if(a<0) a+=TWO_PI; return a; }
  function indexFromRotation(rot){
    // Inverse of centerAngleForIndex: given wheel.rotation, find the slice index at the pointer
    const slice = globalSliceAngle();
    const raw = -rot / slice - 0.5; // undo: theta = -(i+0.5)*slice
    let i = Math.round(raw);
    i = ((i % SLICES.length) + SLICES.length) % SLICES.length;
    return i;
  }

// Confetti + SFX -----------------------------------------------------------
  const confettiLayer=new PIXI.Container(); root.addChild(confettiLayer);
  const gravity=900; const confetti=[];
  function spawnConfetti(n=120){
    for(let i=0;i<n;i++){
      const g=new PIXI.Graphics();
      g.beginFill(Math.random()*0xFFFFFF).drawRect(-2,-5,4,10).endFill();
      g.x=app.renderer.width/2; g.y=app.renderer.height/2 - WHEEL_RADIUS - 60;
      g.rotation=Math.random()*Math.PI; confettiLayer.addChild(g);
      confetti.push({g, vx:(Math.random()*600-300), vy:(-Math.random()*600-200), vr:(Math.random()*4-2), life:2.2+Math.random()*0.8});
    }
  }
  const audioCtx=(window.AudioContext? new AudioContext(): null);
  let muted = false; // UI sound state
  function isSoundOn(){ return !muted; }
  function updateSoundButton(){ 
    // Update canvas sound button text or image
    if (soundButton) {
      if (active.assets?.canvasSoundUnmute || active.assets?.canvasSoundMute) {
        // Use images for sound button
        const imageAsset = isSoundOn() ? active.assets.canvasSoundUnmute : active.assets.canvasSoundMute;
        if (imageAsset) {
          soundButton.removeChildren();
          const sprite = new PIXI.Sprite(PIXI.Texture.from(imageAsset));
          sprite.width = 80;
          sprite.height = 35;
          soundButton.addChild(sprite);
        }
      } else {
        // Use text for sound button (just emoji, no text)
        if (soundButton.children[0]) {
          soundButton.children[0].text = (isSoundOn()? '🔊' : '🔇');
        }
      }
    }
  }
  function playTone(f=880,t=0.15,type='triangle',v=0.08){
    if(!audioCtx || !isSoundOn()) return;
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type=type; o.frequency.value=f; o.connect(g); g.connect(audioCtx.destination); g.gain.value=v;
    o.start(); setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.12); }, (t*1000)*0.7);
    setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, t*1000+120);
  }
  function sfxSpin(){ playTone(320,0.25,'sawtooth',0.05); setTimeout(()=>playTone(480,0.25,'sawtooth',0.05),120); }
  function sfxWin(){ [660,880,1320].forEach((f,i)=> setTimeout(()=>playTone(f,0.18,'triangle',0.08), i*140)); }

  // Animation loop -----------------------------------------------------------
  let spinning=false, rotStart=0, rotEnd=0, t=0, duration=3.8;
  function easeOutCubic(x){ return 1-Math.pow(1-x,3); }
  app.ticker.add((delta)=>{
    if(spinning){
      const dt=delta/60; t+=dt;
      const p=Math.min(1,t/duration);
      const k=easeOutCubic(p);
      wheel.rotation = rotStart + (rotEnd - rotStart) * k;

      if(!active.assets.wheel){
        labels.forEach((lbl)=>{
          const localTop = wheel.toLocal(new PIXI.Point(0,-WHEEL_RADIUS));
          const ang = Math.atan2(lbl.y-localTop.y,lbl.x-localTop.x);
          const n=1-Math.min(1,Math.abs(ang)/1.2);
          lbl.scale.set(1+n*0.05);
        });
      }

      if(p>=1){
        spinning=false;
        updateSpinButtonState(); // Re-enable button
        // Snap to the precomputed exact end angle of the chosen slice
        wheel.rotation = rotEnd;
        onSpinComplete();
      }
    }

    if(confetti.length){
      const dt=delta/60;
      for(let i=confetti.length-1;i>=0;i--){
        const c=confetti[i];
        c.vy+=gravity*dt; c.g.x+=c.vx*dt; c.g.y+=c.vy*dt; c.g.rotation+=c.vr*dt; c.life-=dt;
        if(c.life<=0 || c.g.y>app.renderer.height+200){
          confettiLayer.removeChild(c.g);
          confetti.splice(i,1);
        }
      }
    }
  });

  // Interactions -------------------------------------------------------------
  // DISABLED: Wheel click-to-spin on mobile - only spin button can trigger spin
  // app.view.addEventListener('pointerdown', (e)=>{ 
  //   // Only enable wheel click-to-spin on mobile (touch devices)
  //   const mobile = isMobile();
  //   if(mobile && e.pointerType !== 'mouse') {
  //     // Get click position in screen coordinates
  //     const rect = app.view.getBoundingClientRect();
  //     const screenX = e.clientX - rect.left;
  //     const screenY = e.clientY - rect.top;
  //     
  //     // Convert screen coordinates to canvas coordinates (accounting for scaling and positioning)
  //     const canvasX = (screenX - root.x) / root.scale.x;
  //     const canvasY = (screenY - root.y) / root.scale.y;
  //     
  //     // Get wheel center position in canvas coordinates
  //     const wheelCenterX = wheelContainer.x;
  //     const wheelCenterY = wheelContainer.y;
  //     
  //     // Calculate distance from click to wheel center
  //     const distance = Math.sqrt((canvasX - wheelCenterX) ** 2 + (canvasY - wheelCenterY) ** 2);
  //     
  //     // Only spin if click is within wheel radius (with some padding for easier tapping)
  //     const clickRadius = WHEEL_RADIUS + 20; // Add 20px padding for easier mobile tapping
  //     if(distance < clickRadius && !spinning) {
  //       spin();
  //     }
  //   }
  // });
  // Modal close handlers
  document.querySelectorAll('.modal-close').forEach(btn=> btn.addEventListener('click', (e)=> closeModal(e.target.getAttribute('data-close'))));

   async function spin(){
     if(spinning) return;
     
     // Clear previous spin result to prevent showing old prize modal
     spin._result = null;
     spin._animation = null;
     
     // Ensure any open modals are closed
     hideCanvasCongratsModal();
     
     // Quick local check: if we already know we can't spin, return immediately
     if (remainingSpins !== null && remainingSpins <= 0) {
       showToast('❌ You have reached your spin limit!');
       return;
     }
     
     // Set spinning state IMMEDIATELY for instant visual feedback
     spinning = true;
     updateSpinButtonState();
     
     if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
     
     // Start audio immediately for instant feedback
     sfxSpin();
     
     // Start prize calculation immediately (client-side) while checks run in parallel
     // This allows the animation to start without waiting for network calls
     let chosen;
     let useGuaranteedPrize = false;
     let useSequencePrize = null;
     
     // Increment spin count
     spinCount++;
     
     // Determine which prize to use this spin (client-side calculation)
     const hasGuaranteedPrize = active.settings?.guaranteedPrize && typeof active.settings.guaranteedPrize === 'string' && active.settings.guaranteedPrize.trim();
     
     if (hasGuaranteedPrize) {
       if (active.settings?.guaranteedPrizeEnabled) {
         // Enhanced mode: use sequence or guaranteed prize on Nth spin
         const targetSpin = active.settings.guaranteedSpinCount || 5;
         const positionInCycle = ((spinCount - 1) % targetSpin);
         
         // Check if we have a sequence defined with valid values
         const sequence = active.settings.guaranteedPrizeSequence;
         const hasSequence = sequence && 
                            Array.isArray(sequence) &&
                            sequence.length > 0 &&
                            sequence.some(v => v && typeof v === 'string' && v.trim());
         
         if (hasSequence) {
           // Use sequence prize for positions 0 to (targetSpin-2)
           if (positionInCycle < targetSpin - 1) {
             const sequencePrizeId = sequence[positionInCycle];
             if (sequencePrizeId && typeof sequencePrizeId === 'string' && sequencePrizeId.trim()) {
               useSequencePrize = sequencePrizeId;
             } else {
               useSequencePrize = null;
             }
           } else {
             // Last position in cycle: use guaranteed prize
             useGuaranteedPrize = true;
           }
         } else {
           // No sequence defined: use guaranteed prize only on Nth spin
           useGuaranteedPrize = (spinCount % targetSpin === 0);
         }
       } else {
         // Original mode: every spin
         useGuaranteedPrize = true;
       }
     }
     
     // Run async checks in parallel (non-blocking)
     const canSpinPromise = checkCanSpin().catch(err => {
       console.warn('Spin limit check failed:', err);
       return true; // Allow spin if check fails
     });
     
     const sessionPromise = getOrCreateSession().catch(err => {
       console.warn('Session creation failed:', err);
     });
     
     // Calculate prize immediately (client-side) - don't wait for network
     if (!CONFIG.USE_MICROSERVICE_FOR_SPIN) {
       // Client-side calculation (immediate)
       const guaranteedPrizeId = active.settings?.guaranteedPrize;
       if (useSequencePrize) {
         chosen = SLICES.find(slice => slice.id === useSequencePrize);
         if (!chosen) {
           chosen = pickWeighted(SLICES, guaranteedPrizeId);
         }
       } else if (useGuaranteedPrize) {
         chosen = SLICES.find(slice => slice.id === active.settings.guaranteedPrize);
         if (!chosen) {
           chosen = pickWeighted(SLICES);
         }
       } else {
         // Random selection - exclude guaranteed prize if in enhanced mode
         const excludeGuaranteed = active.settings?.guaranteedPrizeEnabled && guaranteedPrizeId;
         chosen = pickWeighted(SLICES, excludeGuaranteed ? guaranteedPrizeId : null);
       }
       spin._result = chosen;
       spin._animation = null;
       
       // Start animation immediately
       const idx = SLICES.indexOf(chosen);
       const targetCenter = centerAngleForIndex(idx);
       const fullSpins = (5 + Math.floor(Math.random()*3)) * TWO_PI;
       const animDuration = 4.25 + Math.random()*0.9;
       
       rotStart = wheel.rotation % TWO_PI;
       rotEnd   = targetCenter + fullSpins;
       duration = animDuration;
       t = 0;
       
       // Check spin limit in background - if it fails, we'll handle it after spin completes
       canSpinPromise.then(canSpin => {
         if (!canSpin) {
           // If limit reached, we'll show error after spin completes
           console.warn('Spin limit reached, but spin already started');
         }
       });
     } else {
       // Using microservice - need to wait for session and API call
       await sessionPromise;
       
       // Wait for spin limit check
       const canSpin = await canSpinPromise;
       if (!canSpin) {
         // Stop the spin if limit reached
         spinning = false;
         updateSpinButtonState();
         showToast('❌ You have reached your spin limit!');
         return;
       }
       
       // Now make the microservice call
       try {
         const guaranteedPrizeId = active.settings?.guaranteedPrize;
         const excludeGuaranteed = active.settings?.guaranteedPrizeEnabled && guaranteedPrizeId && !useSequencePrize && !useGuaranteedPrize;
         const prizesToSend = excludeGuaranteed 
           ? SLICES.filter(s => s.id !== guaranteedPrizeId).map(s => ({ id: s.id, label: s.label, weight: s.weight, color: s.color }))
           : SLICES.map(s => ({ id: s.id, label: s.label, weight: s.weight, color: s.color }));
         
         const response = await fetch(`${MICROSERVICE_GATEWAY}/api/gameplay/spin`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             sessionId: gameSession?.id,
             prizes: prizesToSend,
             guaranteedPrize: useSequencePrize ? useSequencePrize : (useGuaranteedPrize ? active.settings.guaranteedPrize : null)
           })
         });
         if (response.ok) {
           const result = await response.json();
           chosen = SLICES.find(s => s.id === result.prize.id) || result.prize;
           spin._result = chosen;
           spin._animation = result.animation;
         } else {
           throw new Error('Microservice spin failed');
         }
       } catch (err) {
         console.warn('Microservice spin failed, falling back to client-side', err);
        // Fallback to client-side calculation
        const guaranteedPrizeId = active.settings?.guaranteedPrize;
        if (useSequencePrize) {
          chosen = SLICES.find(slice => slice.id === useSequencePrize);
          if (!chosen) chosen = pickWeighted(SLICES, guaranteedPrizeId);
        } else if (useGuaranteedPrize) {
          chosen = SLICES.find(slice => slice.id === active.settings.guaranteedPrize);
          if (!chosen) chosen = pickWeighted(SLICES);
        } else {
        const excludeGuaranteed = active.settings?.guaranteedPrizeEnabled && guaranteedPrizeId;
        chosen = pickWeighted(SLICES, excludeGuaranteed ? guaranteedPrizeId : null);
      }
       spin._result = chosen;
       spin._animation = null;
     }
     
       // Start animation
     const idx = SLICES.indexOf(chosen);
     const targetCenter = centerAngleForIndex(idx);
     const animation = spin._animation;
     const fullSpins = animation ? (animation.fullSpins * TWO_PI) : ((5 + Math.floor(Math.random()*3)) * TWO_PI);
     const animDuration = animation ? animation.duration : (4.25 + Math.random()*0.9);
     
     rotStart = wheel.rotation % TWO_PI;
     rotEnd   = targetCenter + fullSpins;
     duration = animDuration;
       t = 0;
     }
     
   }
  async function onSpinComplete(){
    spinning = false; // Reset spinning state
    updateSpinButtonState(); // Update button state
    
    // Safety check: ensure we have a valid result and it wasn't cleared by a new spin
    if (!spin._result) {
      console.warn('Spin completed but no result available (may have been cleared by new spin)');
      return;
    }
    
    const res=spin._result;
    
    // Clear the result immediately to prevent it from being reused
    spin._result = null;
    
    addHistory({ ts: Date.now(), template: active.name, prize: res.label });
    
    // Celebration effects
    sfxWin(); 
    spawnConfetti(140);
    
    // Show congratulations modal IMMEDIATELY (don't wait for API calls)
    showCongratsModal(res);
    
    // API calls in background (non-blocking)
    (async () => {
      try{
        // Ensure session exists
        await getOrCreateSession();
        
        // Get playerId from URL parameter (if provided by URewards)
        const urlParams = new URLSearchParams(window.location.search);
        const playerId = urlParams.get('playerId') || null;
        
        console.log('📤 Sending claim to:', CONFIG.API_ENDPOINT);
        const response=await fetch(CONFIG.API_ENDPOINT,{
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ 
            id: res.id, 
            prize: res.label, 
            weight: res.weight, 
            ts: Date.now(), 
            template: active.name,
            sessionId: gameSession?.id,
            playerId: playerId,  // Pass playerId for spin limit tracking (from URewards)
            prizes: SLICES.map(s => ({ id: s.id, label: s.label, weight: s.weight })) // Send prizes array for probability calculation
          })
        });
        if(!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        console.log('✅ Prize claimed successfully:', result);
        
        // Update remaining spins from session or player info
        if (result.player) {
          // Use player spin info (from 3rd party backend)
          // Safely parse remainingSpins from API response
          if (result.player.remainingSpins !== null && result.player.remainingSpins !== undefined) {
            const parsed = Number(result.player.remainingSpins);
            remainingSpins = isNaN(parsed) ? null : parsed;
          } else {
            remainingSpins = null;
          }
          updateSpinButtonState();
          
          if (remainingSpins !== null && remainingSpins <= 0) {
            showToast('🎉 You\'ve used all your spins!');
          } else if (remainingSpins !== null) {
            showToast(`🎉 You won: ${res.label}! (${remainingSpins} spins remaining)`);
          } else {
            showToast(`🎉 You won: ${res.label}!`);
          }
        } else if (result.session) {
          // Fallback to session info
          // Safely parse remainingSpins from API response
          if (result.session.remainingSpins !== null && result.session.remainingSpins !== undefined) {
            const parsed = Number(result.session.remainingSpins);
            remainingSpins = isNaN(parsed) ? null : parsed;
          } else {
            remainingSpins = null;
          }
          updateSpinButtonState();
          
          if (remainingSpins !== null && remainingSpins <= 0) {
            showToast('🎉 You\'ve used all your spins!');
          } else if (remainingSpins !== null) {
            showToast(`🎉 You won: ${res.label}! (${remainingSpins} spins remaining)`);
          }
        }
      }catch(err){ 
        // Log API errors for debugging
        console.error('❌ API error when claiming prize:', err);
        console.error('   Endpoint:', CONFIG.API_ENDPOINT);
        console.error('   Error details:', err.message);
      }
    })();
  }
  function showToast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.style.display='block'; clearTimeout(showToast._t); showToast._t=setTimeout(()=> el.style.display='none', 2200); }

  // Size + sound controls ----------------------------------------------------
  const sizeRange=document.getElementById('sizeRange');
  sizeRange.addEventListener('input', ()=>{ sizeMultiplier=parseFloat(sizeRange.value); drawWheel(); updateWheelSizeDisplay(); });
  
  // Floating panel: collapse + drag + persist -------------------------------
  const fab = document.getElementById('fab');
  
  fab.addEventListener('click', ()=>{
    panel.classList.toggle('collapsed');
    localStorage.setItem(COLLAPSE_KEY, panel.classList.contains('collapsed')? '1':'0');
  });

  const POS_KEY='spinWheel.config.pos'; const COLLAPSE_KEY='spinWheel.config.collapsed';
  btnMinMax.addEventListener('click', ()=>{ panel.classList.toggle('collapsed'); localStorage.setItem(COLLAPSE_KEY, panel.classList.contains('collapsed')? '1':'0'); });
  (function initCollapse(){ 
    const saved=localStorage.getItem(COLLAPSE_KEY); 
    const isMobile = window.innerWidth <= 560;
    
    if(saved===null){ 
      // Default: collapsed on mobile, expanded on desktop
      if(isMobile) {
        panel.classList.add('collapsed'); 
      }
    } else { 
      if(saved==='1') panel.classList.add('collapsed'); 
      else panel.classList.remove('collapsed'); 
    } 
  })();
  (function restorePos(){ const s=localStorage.getItem(POS_KEY); if(!s) return; try{ const {x,y}=JSON.parse(s); const vw=window.innerWidth, vh=window.innerHeight; const nx = Math.min(vw-120, Math.max(8, x)); const ny = Math.min(vh-80, Math.max(8, y)); panel.style.left=nx+'px'; panel.style.top=ny+'px'; }catch{} })();
  
  // Handle mobile/desktop transitions
  window.addEventListener('resize', ()=>{
    const isMobile = window.innerWidth <= 560;
    const saved = localStorage.getItem(COLLAPSE_KEY);
    
    // If no saved preference, apply mobile default
    if(saved === null && isMobile) {
      panel.classList.add('collapsed');
    }
  });
  (function makeDraggable(){ let drag=false, dx=0, dy=0; function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
    function onDown(e){ drag=true; const rect=panel.getBoundingClientRect(); const cx=(e.touches? e.touches[0].clientX: e.clientX); const cy=(e.touches? e.touches[0].clientY: e.clientY); dx=cx-rect.left; dy=cy-rect.top; e.preventDefault(); }
    function onMove(e){ if(!drag) return; const cx=(e.touches? e.touches[0].clientX: e.clientX); const cy=(e.touches? e.touches[0].clientY: e.clientY); const vw=window.innerWidth, vh=window.innerHeight; const w=panel.offsetWidth, h=panel.offsetHeight; let nx=clamp(cx-dx, 8, vw - w - 8); let ny=clamp(cy-dy, 8, vh - 8); panel.style.left=nx+'px'; panel.style.top=ny+'px'; panel.style.right='auto'; localStorage.setItem(POS_KEY, JSON.stringify({x:nx,y:ny})); }
    function onUp(){ drag=false; }
    panelHeader.addEventListener('mousedown', onDown); panelHeader.addEventListener('touchstart', onDown, {passive:false});
    window.addEventListener('mousemove', onMove); window.addEventListener('touchmove', onMove, {passive:false});
    window.addEventListener('mouseup', onUp); window.addEventListener('touchend', onUp);
  })();

  // Rewards history + modals helpers ----------------------------------------
  const LS_HISTORY_KEY='spinWheel.history.v1';
  function loadHistory(){ try{ return JSON.parse(localStorage.getItem(LS_HISTORY_KEY)||'[]'); }catch{ return []; } }
  function saveHistory(arr){ localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(arr.slice(-100))); }
  function addHistory(item){ const arr=loadHistory(); arr.push(item); saveHistory(arr); }
  function formatTs(ts){ const d=new Date(ts); return d.toLocaleString(); }
  function openModal(id){ const el=document.querySelector(id); if(el) el.classList.add('show'); }
  function closeModal(id){ const el=document.querySelector(id); if(el) el.classList.remove('show'); }
  function openRewards(){ 
    const arr=loadHistory().slice().reverse(); 
    
    // Add sample data if no history exists
    if(arr.length === 0) {
      const sampleRewards = [
        { prize: '+1 Credit', ts: Date.now() - 1000 * 60 * 30, icon: '💎' },
        { prize: 'Thank You For Playing', ts: Date.now() - 1000 * 60 * 60 * 2, icon: '🎁' },
        { prize: '+1 Credit', ts: Date.now() - 1000 * 60 * 60 * 24 * 7, icon: '💎' },
        { prize: '+2 Credits', ts: Date.now() - 1000 * 60 * 60 * 24 * 30, icon: '💎💎' },
        { prize: '+1 Credit', ts: Date.now() - 1000 * 60 * 60 * 24 * 45, icon: '💎' }
      ];
      rewardsList.innerHTML = sampleRewards.map(r=>`
        <li>
          <div class="prize-icon">${r.icon}</div>
          <div class="prize-details">
            <div class="prize-date">${formatTs(r.ts)}</div>
            <div class="prize-name">${r.prize}</div>
          </div>
        </li>
      `).join('');
    } else {
      rewardsList.innerHTML = arr.map(r=>`
        <li>
          <div class="prize-icon">💎</div>
          <div class="prize-details">
            <div class="prize-date">${formatTs(r.ts)}</div>
            <div class="prize-name">${r.prize}</div>
          </div>
        </li>
      `).join('');
    }
    
    openModal('#rewardsModal'); 
  }
  function openInfo(){ termsBody.textContent = (active.terms||''); openModal('#infoModal'); }
  
  // Congratulations modal functionality
  const claimAction = document.getElementById('claimAction');
  const claimUrl = document.getElementById('claimUrl');
  const claimUrlRow = document.getElementById('claimUrlRow');
  
  function showCongratsModal(prize) {
    // Show canvas congratulations modal
    showCanvasCongratsModal(prize);
  }
  
  function showCanvasCongratsModal(prize) {
    // Clear any existing congratulations modal
    modalLayer.removeChildren();
    
    // Create congratulations modal background
    const modalBg = new PIXI.Graphics();
    modalBg.beginFill(0x000000, 0.8);
    modalBg.drawRect(0, 0, app.screen.width, app.screen.height);
    modalBg.endFill();
    modalBg.interactive = true;
    modalBg.cursor = 'pointer';
    modalBg.on('pointerdown', () => hideCanvasCongratsModal());
    modalLayer.addChild(modalBg);
    
    // Create congratulations card with responsive sizing and margins
    const mobile = isMobile();
    let cardWidth, cardHeight;
    if (mobile) {
      // Mobile: use 85% of screen width with left/right margins (ensures 7.5% margin on each side)
      const margin = app.screen.width * 0.075; // 7.5% margin on each side
      cardWidth = app.screen.width - (margin * 2);
      cardHeight = 300;
    } else {
      // Web: fixed size
      cardWidth = 400;
      cardHeight = 300;
    }
    const cardX = (app.screen.width - cardWidth) / 2;
    const cardY = (app.screen.height - cardHeight) / 2;
    
    // Card container
    const card = new PIXI.Container();
    
    // Background: use uploaded image if present, else solid color
    if (active.assets?.canvasCongratsModal) {
      const bgSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasCongratsModal));
      bgSprite.width = cardWidth;
      bgSprite.height = cardHeight;
      bgSprite.x = 0;
      bgSprite.y = 0;
      card.addChild(bgSprite);
    } else {
      const cardBg = new PIXI.Graphics();
      cardBg.beginFill(0x1a1a1a);
      cardBg.drawRoundedRect(0, 0, cardWidth, cardHeight, 20);
      cardBg.endFill();
      card.addChild(cardBg);
    }
    
    // Border overlay
    const border = new PIXI.Graphics();
    border.lineStyle(3, 0x8B5CF6);
    border.drawRoundedRect(0, 0, cardWidth, cardHeight, 20);
    card.addChild(border);
    
    card.x = cardX;
    card.y = cardY;
    modalLayer.addChild(card);
    
    // Add ribbon decoration
    const ribbon = new PIXI.Text('🎀', {
      fontFamily: 'Arial',
      fontSize: 32,
      fill: 0xEC4899
    });
    ribbon.anchor.set(0.5);
    ribbon.x = cardWidth / 2;
    ribbon.y = 30;
    card.addChild(ribbon);
    
    // Close button (image if provided)
    const closeContainer = new PIXI.Container();
    closeContainer.x = cardWidth - 30;
    closeContainer.y = 30;
    closeContainer.interactive = true;
    closeContainer.cursor = 'pointer';
    closeContainer.on('pointerdown', () => hideCanvasCongratsModal());
    if (active.assets?.canvasCongratsClose) {
      const closeSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasCongratsClose));
      closeSprite.anchor.set(0.5);
      closeSprite.width = 24; closeSprite.height = 24;
      closeContainer.addChild(closeSprite);
    } else {
      const closeBtn = new PIXI.Graphics();
      closeBtn.beginFill(0x333333);
      closeBtn.drawCircle(0, 0, 20);
      closeBtn.endFill();
      closeContainer.addChild(closeBtn);
      const closeText = new PIXI.Text('×', { fontFamily: 'Arial', fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
      closeText.anchor.set(0.5);
      closeContainer.addChild(closeText);
    }
    card.addChild(closeContainer);
    
    // Congratulations title
    const title = new PIXI.Text('CONGRATULATIONS!', {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0x8B5CF6,
      fontWeight: 'bold'
    });
    title.anchor.set(0.5);
    title.x = cardWidth / 2;
    title.y = 80;
    card.addChild(title);
    
    // Subtitle
    const subtitle = new PIXI.Text('You receive', {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0xffffff
    });
    subtitle.anchor.set(0.5);
    subtitle.x = cardWidth / 2;
    subtitle.y = 120;
    card.addChild(subtitle);
    
    // Prize display
    const prizeText = new PIXI.Text(prize.label, {
      fontFamily: 'Arial',
      fontSize: 28,
      fill: 0xEC4899,
      fontWeight: 'bold'
    });
    prizeText.anchor.set(0.5);
    prizeText.x = cardWidth / 2;
    prizeText.y = 160;
    card.addChild(prizeText);
    
    // Generate diamonds based on prize
    const diamondCount = Math.min(5, Math.max(1, Math.floor(Math.random() * 3) + 1));
    const diamonds = new PIXI.Text('💎'.repeat(diamondCount), {
      fontFamily: 'Arial',
      fontSize: 24
    });
    diamonds.anchor.set(0.5);
    diamonds.x = cardWidth / 2;
    diamonds.y = 190;
    card.addChild(diamonds);
    
    // Claim button - make it larger and more prominent
    const claimBtn = new PIXI.Graphics();
    claimBtn.beginFill(0xEC4899);
    claimBtn.drawRoundedRect(0, 0, 150, 50, 10);
    claimBtn.endFill();
    claimBtn.x = (cardWidth - 150) / 2;
    claimBtn.y = 220;
    claimBtn.interactive = true;
    claimBtn.cursor = 'pointer';
    claimBtn.buttonMode = true;
    
    // Try multiple event types
    claimBtn.on('pointerdown', (event) => {
      event.stopPropagation();
      
      // Handle claim action
      if (active.settings && active.settings.claimAction === 'redirect' && active.settings.claimUrl) {
        window.open(active.settings.claimUrl, '_blank');
      } else {
        // Default: directly call the rewards modal function
        hideCanvasCongratsModal();
        // Add a small delay to ensure the congratulations modal is fully closed
        setTimeout(() => {
          showModal('rewards');
        }, 100);
      }
    });
    
    claimBtn.on('click', (event) => {
      event.stopPropagation();
      
      // Handle claim action
      if (active.settings && active.settings.claimAction === 'redirect' && active.settings.claimUrl) {
        window.open(active.settings.claimUrl, '_blank');
      } else {
        // Default: directly call the rewards modal function
        hideCanvasCongratsModal();
        // Add a small delay to ensure the congratulations modal is fully closed
        setTimeout(() => {
          showModal('rewards');
        }, 100);
      }
    });
    
    claimBtn.on('tap', (event) => {
      event.stopPropagation();
      
      // Handle claim action
      if (active.settings && active.settings.claimAction === 'redirect' && active.settings.claimUrl) {
        window.open(active.settings.claimUrl, '_blank');
      } else {
        // Default: directly call the rewards modal function
        hideCanvasCongratsModal();
        // Add a small delay to ensure the congratulations modal is fully closed
        setTimeout(() => {
          showModal('rewards');
        }, 100);
      }
    });
    
    // Add hover effects
    claimBtn.on('pointerover', () => {
      claimBtn.alpha = 0.8;
    });
    
    claimBtn.on('pointerout', () => {
      claimBtn.alpha = 1.0;
    });
    
    const claimText = new PIXI.Text('CLAIM', {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: 0xffffff,
      fontWeight: 'bold'
    });
    claimText.anchor.set(0.5);
    claimText.x = 75; // Center within larger button
    claimText.y = 25; // Center within larger button
    claimBtn.addChild(claimText);
    
    card.addChild(claimBtn);
  }
  
  function hideCanvasCongratsModal() {
    modalLayer.removeChildren();
  }
  
  // Claim action dropdown functionality
  claimAction.addEventListener('change', () => {
    if (claimAction.value === 'redirect') {
      claimUrlRow.style.display = 'block';
    } else {
      claimUrlRow.style.display = 'none';
    }
    
    // Save settings
    if (!active.settings) active.settings = {};
    active.settings.claimAction = claimAction.value;
    saveTemplates();
  });

  // Claim URL input functionality
  claimUrl.addEventListener('input', () => {
    if (!active.settings) active.settings = {};
    active.settings.claimUrl = claimUrl.value;
    saveTemplates();
  });

  // Canvas-based topbar and modals
  let topbarButtons = [];
  let currentModal = null;
  let soundButton = null; // Store reference to sound button for updates
  
  function drawTopbar() {
    topbarLayer.removeChildren();
    topbarButtons = [];
    
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    const mobile = isMobile();
    const buttonSize = mobile ? 30 : 35; // Mobile: smaller buttons, Web: original size
    const gap = mobile ? 8 : 5; // Mobile: smaller gap, Web: original gap
    const rightMargin = mobile ? 8 : 0; // Mobile: closer to right edge, Web: closer to right edge
    
    // Calculate top margin with safe area insets for iPhone notch/Dynamic Island
    let topMargin;
    if (mobile) {
      const safeArea = getSafeAreaInsets();
      // Base margin + safe area top (for notch/Dynamic Island)
      // Add extra padding to ensure buttons are below the status bar
      topMargin = Math.max(12, safeArea.top + 8); // At least 8px below safe area
    } else {
      topMargin = 16; // Web: original margin
    }
    
    // Get colors from settings
    const hoverColor = parseInt(active.colors?.canvasBtnHover?.replace('#', '') || '1b3e33', 16);
    const textColor = parseInt(active.colors?.canvasBtnText?.replace('#', '') || 'd9fff2', 16);
    const borderColor = parseInt('23493d', 16);
    
    // Create buttons with optional images and per-button colors (always as strings)
    const buttons = [
      { 
        id: 'btnRewards', 
        text: '🏆 Rewards', 
        action: 'rewards', 
        image: active.assets?.canvasRewardsBtn,
        color: active.colors?.canvasRewardsBtnColor || active.colors?.canvasBtnPrimary || '#17342c'
      },
      { 
        id: 'btnInfo', 
        text: 'ℹ️ Info', 
        action: 'info', 
        image: active.assets?.canvasInfoBtn,
        color: active.colors?.canvasInfoBtnColor || active.colors?.canvasBtnPrimary || '#17342c'
      },
      { 
        id: 'btnSound', 
        text: '🔊', 
        action: 'sound', 
        image: active.assets?.canvasSoundUnmute,
        color: active.colors?.canvasBtnPrimary || '#17342c' // Sound button uses default color (as string)
      }
    ];
    
    buttons.forEach((btn, index) => {
      const button = new PIXI.Graphics();
      const x = vw - rightMargin - (buttonSize + gap) * (buttons.length - index);
      const y = topMargin;
      
      let text;
      if (btn.image) {
        const sprite = new PIXI.Sprite(PIXI.Texture.from(btn.image));
        sprite.width = buttonSize;
        sprite.height = buttonSize;
        sprite.anchor.set(0.5);
        sprite.x = buttonSize / 2;
        sprite.y = buttonSize / 2;
        button.addChild(sprite);
      } else {
        // Draw circular button with per-button color
        let btnColor;
        if (typeof btn.color === 'string') {
          btnColor = parseInt(btn.color.replace('#', '') || '17342c', 16);
        } else if (typeof btn.color === 'number') {
          btnColor = btn.color;
        } else {
          btnColor = parseInt('17342c', 16); // Default color
        }
        const goldBorder = parseInt('ffd700', 16); // Gold border like in image
        button.beginFill(btnColor);
        button.drawCircle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
        button.endFill();
        button.lineStyle(2, goldBorder);
        button.drawCircle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
        // Icon/Text label (smaller for circular button)
        // For sound button, just show emoji, for others show first part
        const buttonText = btn.id === 'btnSound' ? btn.text.split(' ')[0] : (btn.text.includes(' ') ? btn.text.split(' ')[0] : btn.text);
        text = new PIXI.Text(buttonText, {
          fontFamily: 'Arial',
          fontSize: 18,
          fill: textColor,
          fontWeight: 'bold'
        });
        text.anchor.set(0.5);
        text.x = buttonSize / 2;
        text.y = buttonSize / 2;
        button.addChild(text);
      }
      
      button.x = x;
      button.y = y;
      button.interactive = true;
      button.buttonMode = true;
      button.cursor = 'pointer';
      
      // Hover effects only for non-image buttons
      if (!btn.image) {
        button.on('pointerover', () => {
          button.clear();
          button.beginFill(hoverColor);
          const goldBorder = parseInt('ffd700', 16);
          button.drawCircle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
          button.endFill();
          button.lineStyle(2, goldBorder);
          button.drawCircle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
          if (text) button.addChild(text);
        });
        
        button.on('pointerout', () => {
          button.clear();
          let btnColor;
          if (typeof btn.color === 'string') {
            btnColor = parseInt(btn.color.replace('#', '') || '17342c', 16);
          } else if (typeof btn.color === 'number') {
            btnColor = btn.color;
          } else {
            btnColor = parseInt('17342c', 16); // Default color
          }
          const goldBorder = parseInt('ffd700', 16);
          button.beginFill(btnColor);
          button.drawCircle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
          button.endFill();
          button.lineStyle(2, goldBorder);
          button.drawCircle(buttonSize / 2, buttonSize / 2, buttonSize / 2);
          if (text) button.addChild(text);
        });
      }
      
      // Click handler
      button.on('pointerdown', () => {
        if (btn.action === 'rewards') {
          showModal('rewards');
        } else if (btn.action === 'info') {
          showModal('info');
        } else if (btn.action === 'sound') {
          muted = !muted;
          updateSoundButton();
        }
      });
      
      topbarLayer.addChild(button);
      topbarButtons.push(button);
      
      if (btn.action === 'sound') {
        soundButton = button;
      }
    });
    // Ensure sound button reflects current mute state when using images
    updateSoundButton?.();
  }
  
  function showModal(type) {
    modalLayer.removeChildren();
    currentModal = type;
    
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    
    // Modal background
    const modalBg = new PIXI.Graphics();
    modalBg.beginFill(0x000000, 0.55);
    modalBg.drawRect(0, 0, vw, vh);
    modalBg.endFill();
    modalBg.interactive = true;
    modalBg.on('pointerdown', () => hideModal());
    modalLayer.addChild(modalBg);
    
    // Modal card
    const cardWidth = Math.min(vw * 0.9, 720);
    const cardHeight = Math.min(vh * 0.8, 600);
    const cardX = (vw - cardWidth) / 2;
    const cardY = (vh - cardHeight) / 2;
    
    // Get colors from settings
    const modalBgColor = parseInt(active.colors?.canvasModalBg?.replace('#', '') || '0e1f1a', 16);
    const modalBorderColor = parseInt(active.colors?.canvasModalBorder?.replace('#', '') || '204a3e', 16);
    const modalTextColor = parseInt(active.colors?.canvasModalText?.replace('#', '') || 'e8fff5', 16);
    
    const card = new PIXI.Graphics();
    
    // Use background image if available, otherwise use solid color
    if (type === 'rewards' && active.assets?.canvasRewardsModal) {
      // Use rewards modal background image
      const bgSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasRewardsModal));
      bgSprite.width = cardWidth;
      bgSprite.height = cardHeight;
      bgSprite.x = 0;
      bgSprite.y = 0;
      card.addChild(bgSprite);
    } else if (type === 'info' && active.assets?.canvasInfoModal) {
      // Use info modal background image
      const bgSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasInfoModal));
      bgSprite.width = cardWidth;
      bgSprite.height = cardHeight;
      bgSprite.x = 0;
      bgSprite.y = 0;
      card.addChild(bgSprite);
    } else {
      // Use solid color background
      card.beginFill(modalBgColor);
      card.lineStyle(1, modalBorderColor);
      card.drawRoundedRect(0, 0, cardWidth, cardHeight, 14);
      card.endFill();
    }
    
    card.x = cardX;
    card.y = cardY;
    modalLayer.addChild(card);
    
    // Close button (positioned like congratulations modal)
    const closeContainer = new PIXI.Container();
    closeContainer.x = cardWidth - 30;
    closeContainer.y = 30;
    closeContainer.interactive = true;
    closeContainer.cursor = 'pointer';
    closeContainer.on('pointerdown', () => hideModal());
    
    const closeAsset = type === 'rewards' ? active.assets?.canvasRewardsClose : active.assets?.canvasInfoClose;
    if (closeAsset) {
      const sprite = new PIXI.Sprite(PIXI.Texture.from(closeAsset));
      sprite.anchor.set(0.5);
      sprite.width = 24; 
      sprite.height = 24;
      closeContainer.addChild(sprite);
    } else {
      const closeBtn = new PIXI.Graphics();
      closeBtn.beginFill(0x333333);
      closeBtn.drawCircle(0, 0, 20);
      closeBtn.endFill();
      closeContainer.addChild(closeBtn);
      const closeText = new PIXI.Text('×', { fontFamily: 'Arial', fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
      closeText.anchor.set(0.5);
      closeContainer.addChild(closeText);
    }
    card.addChild(closeContainer);
    
    // Modal content (no header, start from top)
    const contentY = 20;
    const contentHeight = cardHeight - 40;
    
    // Add title at the top of content
    const titleText = new PIXI.Text(
      type === 'rewards' ? 'REWARDS HISTORY' : 'TERMS & CONDITIONS',
      {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: modalTextColor,
        fontWeight: 'bold'
      }
    );
    titleText.x = 20;
    titleText.y = contentY;
    card.addChild(titleText);
    
    // Adjust content start position
    const actualContentY = contentY + 40;
    const actualContentHeight = contentHeight - 40;
    
    if (type === 'rewards') {
      // Get rewards history from actual data
      const rewardsHistory = loadHistory().slice().reverse();
        if (rewardsHistory.length === 0) {
          // Empty state
          const emptyText = new PIXI.Text('No prizes won yet. Spin the wheel to win prizes!', {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: modalTextColor,
            wordWrap: true,
            wordWrapWidth: cardWidth - 40
          });
          emptyText.x = 20;
          emptyText.y = actualContentY;
          card.addChild(emptyText);
        } else {
          // Create grid layout for rewards
          const itemHeight = 60;
          const itemWidth = cardWidth - 40;
          const startY = actualContentY;
        
        rewardsHistory.slice(0, 6).forEach((reward, index) => {
          const itemY = startY + (index * (itemHeight + 12));
          
          // Create reward item background with gradient effect
          const itemBg = new PIXI.Graphics();
          itemBg.beginFill(0x8B5CF6); // Purple gradient start
          itemBg.drawRoundedRect(0, 0, itemWidth, itemHeight, 12);
          itemBg.endFill();
          
          // Add gradient effect (simulated)
          const gradientOverlay = new PIXI.Graphics();
          gradientOverlay.beginFill(0xEC4899, 0.3); // Pink gradient end
          gradientOverlay.drawRoundedRect(0, 0, itemWidth, itemHeight, 12);
          gradientOverlay.endFill();
          itemBg.addChild(gradientOverlay);
          
          itemBg.x = 20;
          itemBg.y = itemY;
          card.addChild(itemBg);
          
          // Prize icon (diamond)
          const iconBg = new PIXI.Graphics();
          iconBg.beginFill(0xffffff);
          iconBg.drawRoundedRect(0, 0, 48, 48, 8);
          iconBg.endFill();
          iconBg.x = 20;
          iconBg.y = itemY + 6;
          card.addChild(iconBg);
          
          const iconText = new PIXI.Text('💎', {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0x000000
          });
          iconText.anchor.set(0.5);
          iconText.x = 20 + 24;
          iconText.y = itemY + 30;
          card.addChild(iconText);
          
          // Prize details
          const date = new Date(reward.ts);
          const dateTime = date.toLocaleDateString('en-US') + ', ' + date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
          const dateText = new PIXI.Text(dateTime, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xffffff,
            fontWeight: 'normal'
          });
          dateText.x = 80;
          dateText.y = itemY + 10;
          card.addChild(dateText);
          
          const prizeText = new PIXI.Text(reward.prize, {
            fontFamily: 'Arial',
            fontSize: 14,
            fill: 0xffffff,
            fontWeight: 'bold'
          });
          prizeText.x = 80;
          prizeText.y = itemY + 30;
          card.addChild(prizeText);
        });
      }
      } else if (type === 'info') {
        // Terms content
        const contentText = new PIXI.Text(active.terms || 'No terms specified.', {
          fontFamily: 'Arial',
          fontSize: 14,
          fill: modalTextColor,
          wordWrap: true,
          wordWrapWidth: cardWidth - 40
        });
        contentText.x = 20;
        contentText.y = actualContentY;
        card.addChild(contentText);
      }
  }
  
  function hideModal() {
    modalLayer.removeChildren();
    currentModal = null;
  }

  // Canvas-based SPIN button
  let spinButton = null;
  
  function updateSpinButtonState() {
    if (spinButton) {
      if (spinning) {
        spinButton.alpha = 0.5;
        spinButton.interactive = false;
      } else {
        // Check if spins are exhausted
        const canSpin = remainingSpins === null || remainingSpins > 0;
        spinButton.alpha = canSpin ? 1 : 0.5;
        spinButton.interactive = canSpin;
      }
    }
    // Update chance counter
    drawChanceCounter();
  }
  
  function drawSpinButton() {
    // Remove existing spin button
    if (spinButton) {
      uiLayer.removeChild(spinButton);
    }
    
    const vw = app.renderer.width;
    const vh = app.renderer.height;
    const dpr = window.devicePixelRatio || 1;
    
    // Detect mobile device
    const mobile = isMobile();
    
    // ===== SPIN BUTTON SIZE =====
    // Auto-scale button size based on screen size
    let buttonWidth, buttonHeight;
    if (mobile) {
      // Mobile: Make button smaller
      // Base size: 70px width, 22px height for 375px width (reduced from 100x30)
      const baseWidth = 375;
      const baseButtonWidth = 70; // Reduced base width
      const baseButtonHeight = 22; // Reduced base height
      const scaleFactor = Math.min(vw / baseWidth, 1.03); // Scale up to only 1.03x (minimal increase)
      
      buttonWidth = Math.round(baseButtonWidth * scaleFactor);
      buttonHeight = Math.round(baseButtonHeight * scaleFactor);
      
      // Clamp sizes: min 65x20, max 90x28 (reduced max size)
      buttonWidth = Math.max(65, Math.min(90, buttonWidth));
      buttonHeight = Math.max(20, Math.min(28, buttonHeight));
      
      // Apply device pixel ratio for high-DPI screens
      buttonWidth *= dpr;
      buttonHeight *= dpr;
    } else {
      // Web button size (fixed)
      buttonWidth = 150 * dpr;
      buttonHeight = 40 * dpr;
    }
    const buttonX = (vw - buttonWidth) / 2;
    // Position below chance counter (in screen coordinates)
    const chanceY = (wheelContainer.y + WHEEL_RADIUS + (mobile ? 80 : 130)) * root.scale.y + root.y;
    
    // Mobile: Reduce spacing to minimize space below button
    // Web: Original spacing
    let buttonY;
    if (mobile) {
      // Position button with spacing that scales with screen size
      // Base spacing: 40px for 375px width, scales proportionally
      const baseWidth = 375;
      const baseSpacing = 40;
      const spacingScale = Math.min(vw / baseWidth, 1.5);
      const spacing = Math.round(baseSpacing * spacingScale);
      const bottomPadding = Math.max(20, getSafeAreaInsets().bottom + 10);
      buttonY = Math.min(chanceY + spacing, vh - buttonHeight - bottomPadding);
    } else {
      buttonY = chanceY + 100; // Web: original spacing
    }
    
    // Get colors from settings
    const primaryColor = parseInt(active.colors?.canvasSpinBtn?.replace('#', '') || '24d58b', 16);
    const hoverColor = parseInt(active.colors?.canvasSpinBtnHover?.replace('#', '') || '2be68b', 16);
    const borderColor = parseInt(active.colors?.canvasSpinBtnBorder?.replace('#', '') || '0fb168', 16);
    
    // Create button graphics
    spinButton = new PIXI.Graphics();
    
    // Store text reference for hover handlers
    let buttonText = null;
    
    // Use image if available, otherwise use colors
    if (active.assets?.canvasSpinBtn) {
      const sprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasSpinBtn));
      sprite.width = buttonWidth;
      sprite.height = buttonHeight;
      spinButton.addChild(sprite);
    } else {
      // Button background with gradient effect
      spinButton.beginFill(primaryColor);
      spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
      spinButton.endFill();
      
      // Button border
      spinButton.lineStyle(2 * dpr, borderColor);
      spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
      
      // Button shadow effect
      spinButton.beginFill(0x000000, 0.2);
      spinButton.drawRoundedRect(2 * dpr, 2 * dpr, buttonWidth, buttonHeight, 14 * dpr);
      spinButton.endFill();
      
      // Button text (only if no image)
      // Auto-scale font size based on button size
      let textFontSize;
      if (mobile) {
        // Scale font size proportionally with button size (smaller text)
        // Base: 12px for 35px button height (reduced from 16px)
        const baseButtonHeight = 35;
        const baseFontSize = 12; // Smaller base font size
        const fontSizeScale = (buttonHeight / dpr) / baseButtonHeight;
        textFontSize = Math.round(baseFontSize * fontSizeScale);
        // Clamp between 10px and 18px (reduced from 14-24px)
        textFontSize = Math.max(10, Math.min(18, textFontSize));
        textFontSize *= dpr; // Apply DPR
      } else {
        textFontSize = 20 * dpr; // Web: original size
      }
      buttonText = new PIXI.Text('SPIN', {
        fontFamily: 'Arial, sans-serif',
        fontSize: textFontSize,
        fill: 0xffffff,
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 1 * dpr
      });
      buttonText.anchor.set(0.5);
      buttonText.x = buttonWidth / 2;
      buttonText.y = buttonHeight / 2;
      spinButton.addChild(buttonText);
    }
    
    spinButton.x = buttonX;
    spinButton.y = buttonY;
    spinButton.interactive = true;
    spinButton.buttonMode = true;
    spinButton.cursor = 'pointer';
    
    // Set canvas cursor to pointer when hovering over button
    const canvas = app.view;
    
    // Hover effects (only if no image)
    if (!active.assets?.canvasSpinBtn && buttonText) {
      spinButton.on('pointerover', () => {
        // Set cursor to pointer
        if (canvas && canvas.style) {
          canvas.style.cursor = 'pointer';
        }
        // Visual hover effect
        spinButton.clear();
        spinButton.beginFill(hoverColor);
        spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.endFill();
        spinButton.lineStyle(2 * dpr, borderColor);
        spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.beginFill(0x000000, 0.2);
        spinButton.drawRoundedRect(2 * dpr, 2 * dpr, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.endFill();
        // Re-add text after clearing
        spinButton.addChild(buttonText);
      });
      
      spinButton.on('pointerout', () => {
        // Reset cursor
        if (canvas && canvas.style) {
          canvas.style.cursor = 'default';
        }
        // Visual reset
        spinButton.clear();
        spinButton.beginFill(primaryColor);
        spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.endFill();
        spinButton.lineStyle(2 * dpr, borderColor);
        spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.beginFill(0x000000, 0.2);
        spinButton.drawRoundedRect(2 * dpr, 2 * dpr, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.endFill();
        // Re-add text after clearing
        spinButton.addChild(buttonText);
      });
    } else {
      // If using image, just set cursor (no visual hover effect)
      spinButton.on('pointerover', () => {
        if (canvas && canvas.style) {
          canvas.style.cursor = 'pointer';
        }
      });
      
      spinButton.on('pointerout', () => {
        if (canvas && canvas.style) {
          canvas.style.cursor = 'default';
        }
      });
    }
    
    // Click handler - call the same spin function
    spinButton.on('pointerdown', () => {
      if (!spinning) {
        spin();
      }
    });
    
    // Update button state based on spinning
    if (spinning) {
      spinButton.alpha = 0.5;
      spinButton.interactive = false;
    } else {
      spinButton.alpha = 1;
      spinButton.interactive = true;
    }
    
    uiLayer.addChild(spinButton);
  }

  // Claim button functionality

  // Init ---------------------------------------------------------------------
  function refreshTemplateUI(){
    templateSelect.innerHTML = templates.map((t,i)=>`<option value="${i}">${t.name||('Template '+(i+1))}</option>`).join('');
    templateSelect.value = String(activeIndex);
    templateName.value = active.name || '';
    activeTemplateName.textContent = active.name || 'Template';

    configText.value = active.prizesText || '';
    termsText.value = active.terms || '';
    termsBody.textContent = active.terms || '';

    // Claim button settings
    if (active.settings) {
      claimAction.value = active.settings.claimAction || 'modal';
      claimUrl.value = active.settings.claimUrl || '';
      claimUrlRow.style.display = claimAction.value === 'redirect' ? 'block' : 'none';
    } else {
      claimAction.value = 'modal';
      claimUrl.value = '';
      claimUrlRow.style.display = 'none';
    }

    // Canvas color settings
    if (active.colors) {
      canvasBtnPrimaryColor.value = active.colors.canvasBtnPrimary || '#17342c';
      canvasBtnHoverColor.value = active.colors.canvasBtnHover || '#1b3e33';
      canvasBtnTextColor.value = active.colors.canvasBtnText || '#d9fff2';
      
      // Per-button colors
      if (canvasRewardsBtnColor) canvasRewardsBtnColor.value = active.colors.canvasRewardsBtnColor || '#17342c';
      if (canvasInfoBtnColor) canvasInfoBtnColor.value = active.colors.canvasInfoBtnColor || '#17342c';
      canvasModalBgColor.value = active.colors.canvasModalBg || '#0e1f1a';
      canvasModalBorderColor.value = active.colors.canvasModalBorder || '#204a3e';
      canvasModalTextColor.value = active.colors.canvasModalText || '#e8fff5';
      canvasSpinBtnColor.value = active.colors.canvasSpinBtn || '#24d58b';
      canvasSpinBtnHoverColor.value = active.colors.canvasSpinBtnHover || '#2be68b';
      canvasSpinBtnBorderColor.value = active.colors.canvasSpinBtnBorder || '#0fb168';
    }

    // Populate guaranteed prize dropdown first
    guaranteedPrize.innerHTML = '<option value="">Random Prize (Normal)</option>' + 
      SLICES.map(slice => `<option value="${slice.id}">${slice.label}</option>`).join('');
    
    // Guaranteed prize settings
    if (active.settings && active.settings.guaranteedPrize) {
      guaranteedPrize.value = active.settings.guaranteedPrize;
    } else {
      guaranteedPrize.value = '';
    }
    
    // Enable/disable the checkbox based on whether a guaranteed prize is selected
    const hasGuaranteedPrize = guaranteedPrize.value && guaranteedPrize.value.trim();
    guaranteedPrizeEnabled.disabled = !hasGuaranteedPrize;
    
    // Enhanced guaranteed prize settings
    if (active.settings) {
      // Only allow enabled if a guaranteed prize is set
      if (hasGuaranteedPrize) {
        guaranteedPrizeEnabled.checked = active.settings.guaranteedPrizeEnabled || false;
      } else {
        guaranteedPrizeEnabled.checked = false;
        active.settings.guaranteedPrizeEnabled = false;
      }
      // Set spin count with validation
      const maxSpins = SLICES.length; // Maximum is total number of prizes
      const savedCount = active.settings.guaranteedSpinCount || 5;
      const validCount = Math.max(2, Math.min(maxSpins, savedCount));
      guaranteedSpinCount.value = validCount;
      guaranteedSpinCount.min = 2; // Minimum is always 2
      guaranteedSpinCount.max = maxSpins; // Maximum is total prizes
      
      // Update saved value if it was invalid
      if (savedCount !== validCount) {
        active.settings.guaranteedSpinCount = validCount;
      }
      guaranteedSpinCountRow.style.display = (guaranteedPrizeEnabled.checked && hasGuaranteedPrize) ? 'flex' : 'none';
      
      // Regenerate prize sequence boxes if enabled
      if (guaranteedPrizeEnabled.checked && hasGuaranteedPrize) {
        generatePrizeSequenceBoxes();
      } else {
        guaranteedPrizeSequenceRow.style.display = 'none';
      }
    } else {
      guaranteedPrizeEnabled.checked = false;
      const maxSpins = SLICES.length;
      guaranteedSpinCount.value = Math.max(2, Math.min(5, maxSpins));
      guaranteedSpinCount.min = 2;
      guaranteedSpinCount.max = maxSpins;
      guaranteedSpinCountRow.style.display = 'none';
      guaranteedPrizeSequenceRow.style.display = 'none';
    }

    forceSelect.innerHTML = '<option value="">Force Prize (QA)</option>' + SLICES.map((s,i)=>`<option value="${i}">${s.label}</option>`).join('');
    
    // Update wheel size display
    updateWheelSizeDisplay();
    
    updateSoundButton();
    
    // Reset session when template changes
    gameSession = null;
    remainingSpins = null;
    sessionChecked = false;
    updateSpinButtonState();
    
    // Update loading screen
    if (active.assets?.loadingScreen) {
      showLoadingScreen();
    } else {
      hideLoadingScreen();
    }
  }

  refreshTemplateUI();
    layout();
    
    // Initialize session on page load to get actual remaining spins
    (async () => {
      try {
        await getOrCreateSession();
        // Update chance counter after session is loaded
        drawChanceCounter();
        updateSpinButtonState();
      } catch (err) {
        console.warn('Failed to initialize session on load:', err);
      }
    })();
    
    // Show loading screen after everything is initialized
    if (active?.assets?.loadingScreen) {
      showLoadingScreen();
      setTimeout(() => {
        hideLoadingScreen();
      }, 800);
    }
  } catch(err){
    console.error('[Init Error]', err);
    const el=document.getElementById('toast');
    el.textContent='⚠️ Init error: '+(err?.message||err); el.style.display='block';
  }
})();

// Function to generate standalone HTML
function generateStandaloneHTML(templateData) {
  const { name, prizesText, terms, assets, colors, wheelSize } = templateData;
  
  // Parse prizes
  const parseFromText = (txt) => {
    const lines = txt.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('Please enter at least 2 prizes');
    const arr = [];
    for (const line of lines) {
      const parts = line.split('|').map(s => s.trim());
      const label = parts[0] || 'Prize';
      const weight = parseFloat(parts[1] ?? '1');
      if (!Number.isFinite(weight) || weight <= 0) throw new Error(`Invalid weight for "${label}"`);
      const color = parts[2] ?? '#25c77a';
      arr.push({ id: label.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, ''), label, color, weight });
    }
    return arr;
  };
  
  const slices = parseFromText(prizesText);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>${name} - Spin Wheel</title>
  <style>
     html, body { 
       height: 100%; 
       width: 100%;
       margin: 0; 
       padding: 0;
       background: ${colors.background?.style || '#0a2b22'}; 
       font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; 
       overflow: hidden;
       position: fixed;
       top: 0;
       left: 0;
     }
    #game { 
      width: 100vw; 
      height: 100vh; 
      display:grid; 
      place-items:center; 
      position: fixed;
      top: 0;
      left: 0;
      overflow: hidden;
    }
    .ui { 
      position:fixed; 
      inset:0; 
      display:grid; 
      grid-template-rows: 1fr auto; 
      pointer-events:none; 
    }
    .controls { 
      pointer-events:auto; 
      display:flex; 
      gap:14px; 
      align-items:center; 
      justify-content:center; 
      padding:12px 16px; 
    }
     .btn { 
       pointer-events:auto; 
       margin: 8px 0 24px; 
       padding: 14px 28px; 
       font-size: 20px; 
       border-radius: 14px; 
       border:0; 
       background: ${colors.button?.style || 'linear-gradient(#24d58b,#0fb168)'}; 
       color:#fff; 
       box-shadow:0 8px 24px rgba(0,0,0,.35); 
       cursor:pointer; 
     }
    .btn[disabled]{ 
      opacity:.55; 
      filter:grayscale(1); 
      cursor:not-allowed; 
    }
    .toast { 
      position: fixed; 
      top: 18px; 
      left: 50%; 
      transform: translateX(-50%); 
      background: #101a17; 
      color: #d0ffe9; 
      padding: 10px 14px; 
      border-radius: 10px; 
      font-weight: 600; 
      letter-spacing: .3px; 
      box-shadow: 0 6px 20px rgba(0,0,0,.35); 
      z-index:1100; 
    }
    .modal{position:fixed; inset:0; background:rgba(0,0,0,.55); display:none; align-items:center; justify-content:center; z-index:1300}
    .modal.show{display:flex}
    .modal-card{width:min(92vw,720px); max-height:80vh; overflow:auto; background:#0e1f1a; color:#c9ffe9; border:1px solid #204a3e; border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,.5)}
    .modal-card header{display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid #204a3e}
    .modal-card header h4{margin:0; font-size:14px; color:#a3ffe0}
    .modal-card .body{padding:20px 24px; font-size:14px; line-height:1.6; text-align:left; color:#e8fff5;}
    .modal-close{background:#17342c; border:0; color:#c9ffe9; border-radius:8px; padding:6px 10px; cursor:pointer}
    .topbar{position:fixed; right:16px; top:16px; display:flex; gap:10px; z-index:1200}
    .topbtn{pointer-events:auto; padding:10px 12px; border-radius:10px; background:#17342c; color:#d9fff2; border:1px solid #23493d; cursor:pointer; font-weight:700; font-size:12px; box-shadow:0 6px 18px rgba(0,0,0,.35)}
    .topbtn:hover{background:#1b3e33}
  </style>
  <script src="https://unpkg.com/pixi.js@7.4.0/dist/pixi.min.js"></script>
</head>
<body>
  <div id="game"></div>
  <div class="topbar">
    <button id="btnInfo" class="topbtn">ℹ️ Info</button>
    <button id="btnSound" class="topbtn" title="Mute/Unmute">🔊 Sound</button>
  </div>
  <div class="ui">
    <div></div>
    <div class="controls"><button id="spinBtn" class="btn">SPIN</button></div>
  </div>
  <div id="toast" class="toast" style="display:none"></div>
  <div id="infoModal" class="modal">
    <div class="modal-card">
      <header><h4>Terms & Conditions</h4><button class="modal-close" data-close="#infoModal">Close</button></header>
      <div id="termsBody" class="body">${terms || 'No terms specified.'}</div>
    </div>
  </div>

<script>
(async function(){
  try{
    const CONFIG = { API_ENDPOINT: '/api/claim', ENABLE_SFX: true, BASE_RADIUS: 400, HUB_RADIUS: 80 };
  const app = new PIXI.Application({ resizeTo: document.getElementById('game'), backgroundAlpha: 0, antialias: true, autoDensity: true, powerPreference: 'high-performance' });
  document.getElementById('game').appendChild(app.view);
  const DESIGN = { w: 1080, h: 1920 };
  
  const root = new PIXI.Container();
  const bgLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  const topbarLayer = new PIXI.Container();
  const modalLayer = new PIXI.Container();
  app.stage.addChild(bgLayer); 
  app.stage.addChild(root); 
  app.stage.addChild(uiLayer);
  app.stage.addChild(topbarLayer);
  app.stage.addChild(modalLayer);
  const wheelContainer = new PIXI.Container();
  root.addChild(wheelContainer);
    
    let sizeMultiplier = ${wheelSize}; let autoMultiplier = 1;
    function computeAutoMultiplier(){ const vw=app.renderer.width, vh=app.renderer.height; const minEdge=Math.min(vw,vh); const targetDiameter=minEdge*0.8; autoMultiplier = targetDiameter/(CONFIG.BASE_RADIUS*2); autoMultiplier=Math.max(0.6, Math.min(1.6, autoMultiplier)); }
    function layout(){ const vw=app.renderer.width, vh=app.renderer.height; const scale=Math.min(vw/DESIGN.w, vh/DESIGN.h); root.scale.set(scale); root.x=vw/2-(DESIGN.w*scale)/2; root.y=vh/2-(DESIGN.h*scale)/2; wheelContainer.x=DESIGN.w/2; wheelContainer.y=(vw>vh)? DESIGN.h/2-40 : DESIGN.h/2-80; drawBackground(); computeAutoMultiplier(); drawWheel(); drawLogo(); drawTopbar(); drawSpinButton(); }
    app.renderer.on('resize', layout);
    
    const SLICES = ${JSON.stringify(slices)};
    const assets = ${JSON.stringify(assets)};
    
    function normalizeColor(c){ if(typeof c==='number') return c; if(typeof c==='string'){ if(c.startsWith('#')) return parseInt(c.slice(1),16); if(/^0x/i.test(c)) return parseInt(c,16); return 0x25c77a; } return 0x25c77a; }
    
    const bgSprite = new PIXI.Sprite(); bgLayer.addChild(bgSprite);
    const logoSprite = new PIXI.Sprite(); root.addChild(logoSprite);
    const base=new PIXI.Graphics(); const rim=new PIXI.Graphics(); const wheel=new PIXI.Container(); const hub=new PIXI.Graphics(); const goText=new PIXI.Text('GO', { fill:'#0e7b55', fontSize:36, fontWeight:'900', fontFamily:'Inter, Arial' }); const spinSprite=new PIXI.Sprite(); const pointer=new PIXI.Graphics(); const dots=new PIXI.Graphics(); const labels=[]; const wheelImageSprite=new PIXI.Sprite(); const hubLayer=new PIXI.Container();
    wheelContainer.addChild(base, rim, wheel, dots, hubLayer, pointer);
    let WHEEL_RADIUS = CONFIG.BASE_RADIUS;
    
    function drawBackground(){ bgSprite.texture=PIXI.Texture.EMPTY; if(assets.bg){ bgSprite.texture=PIXI.Texture.from(assets.bg); } const vw=app.renderer.width, vh=app.renderer.height; if(bgSprite.texture.baseTexture.valid){ const iw=bgSprite.texture.width, ih=bgSprite.texture.height; const s=Math.max(vw/iw, vh/ih); bgSprite.scale.set(s); bgSprite.x=(vw - iw*s)/2; bgSprite.y=(vh - ih*s)/2; } }
    function drawLogo(){ 
      logoSprite.texture=PIXI.Texture.EMPTY; 
      if(assets.logo){ 
        logoSprite.texture=PIXI.Texture.from(assets.logo); 
      } 
      logoSprite.anchor.set?.(0.5,0.5); 
      const sc=0.4;
      logoSprite.scale.set(sc, sc); 
      // Position logo above the wheel, outside the wheel container
      const logoSpacing = 100; // Space between logo and top of wheel
      logoSprite.x = DESIGN.w/2; // Center horizontally
      logoSprite.y = wheelContainer.y - WHEEL_RADIUS - logoSpacing;
    }
    
    function drawWheel(resetRotation=false){
      WHEEL_RADIUS = CONFIG.BASE_RADIUS * sizeMultiplier * autoMultiplier;
      if(resetRotation) wheel.rotation = 0;
      base.clear(); rim.clear(); wheel.removeChildren(); labels.length = 0;
      dots.clear(); hub.clear(); pointer.clear(); hubLayer.removeChildren();
      
      // Update logo position when wheel is redrawn
      drawLogo();
      
      if(wheelImageSprite.parent !== wheel){ wheelImageSprite.parent?.removeChild(wheelImageSprite); wheel.addChildAt(wheelImageSprite, 0); }
      wheelImageSprite.texture = PIXI.Texture.EMPTY;
      base.beginFill(0x071a15).drawCircle(0,0,WHEEL_RADIUS+28).endFill(); base.alpha = 0.9;
      rim.beginFill(0x114b3c).drawCircle(0,0,WHEEL_RADIUS+12).endFill();
      if(assets.wheel){
        wheelImageSprite.texture = PIXI.Texture.from(assets.wheel);
        wheelImageSprite.anchor.set(0.5);
        const iw = wheelImageSprite.texture.width, ih = wheelImageSprite.texture.height;
        const s = (WHEEL_RADIUS*2) / Math.max(iw, ih);
        wheelImageSprite.scale.set(s);
        wheelImageSprite.x = 0; wheelImageSprite.y = 0;
      } else {
        const sliceAngle = Math.PI * 2 / SLICES.length;
        for(let i=0;i<SLICES.length;i++){
          const {color,label} = SLICES[i];
          const g = new PIXI.Graphics();
          g.beginFill(normalizeColor(color)).moveTo(0,0)
            .arc(0,0,WHEEL_RADIUS,-Math.PI/2 + i*sliceAngle, -Math.PI/2 + (i+1)*sliceAngle)
            .lineTo(0,0).endFill();
          g.lineStyle(2,0xffffff,0.15)
            .arc(0,0,WHEEL_RADIUS,-Math.PI/2 + i*sliceAngle, -Math.PI/2 + (i+1)*sliceAngle);
          wheel.addChild(g);
          const t = new PIXI.Text(label, { fill:'#063e2f', fontSize: Math.max(18, WHEEL_RADIUS*0.06), fontWeight:'800', fontFamily:'Inter, Arial', align:'center', wordWrap:true, wordWrapWidth: Math.max(140, WHEEL_RADIUS*0.45) });
          t.anchor.set(0.5);
          const mid = -Math.PI/2 + (i+0.5)*sliceAngle; const r = WHEEL_RADIUS * 0.62;
          t.x = Math.cos(mid)*r; t.y = Math.sin(mid)*r; t.rotation = mid + Math.PI/2;
          labels.push(t); wheel.addChild(t);
        }
      }
      const HR = CONFIG.HUB_RADIUS * (WHEEL_RADIUS/CONFIG.BASE_RADIUS);
      if(assets.spin){
        spinSprite.texture = PIXI.Texture.from(assets.spin);
        spinSprite.anchor.set(0.5);
        const iw = spinSprite.texture.width, ih = spinSprite.texture.height;
        const s = (HR*2) / Math.max(iw, ih);
        spinSprite.scale.set(s);
        spinSprite.x = 0; spinSprite.y = 0; hubLayer.addChild(spinSprite);
      } else {
        hub.beginFill(0xf9fffd).drawCircle(0,0,HR).endFill(); hub.lineStyle(6,0x1ab377,1).drawCircle(0,0,HR);
        goText.style.fontSize = Math.max(28, HR*0.55); goText.anchor.set(0.5); goText.rotation = 0;
        hubLayer.addChild(hub, goText);
      }
      const baseY = -HR - 6; const tipY  = -HR - 34 * (WHEEL_RADIUS/CONFIG.BASE_RADIUS);
      pointer.beginFill(0xffee66).drawPolygon([ -14, baseY, 14, baseY, 0, tipY ]).endFill();
      pointer.lineStyle(3,0x8a7a28,1).moveTo(-14, baseY).lineTo(14, baseY).lineTo(0, tipY).lineTo(-14, baseY);
      dots.beginFill(0xffffff,0.9);
      const N = 60; for(let i=0;i<N;i++){ const a=-Math.PI/2 + i*(Math.PI*2/N); dots.drawCircle(Math.cos(a)*(WHEEL_RADIUS+4), Math.sin(a)*(WHEEL_RADIUS+4), i%2?2.5:1.7);} dots.endFill();
    }
    
    const TWO_PI = Math.PI * 2;
    const globalSliceAngle = ()=> TWO_PI / SLICES.length;
    function pickWeighted(items, excludeId = null){ 
      const filteredItems = excludeId ? items.filter(item => item.id !== excludeId) : items;
      if (filteredItems.length === 0) {
        return items[items.length - 1];
      }
      const total=filteredItems.reduce((s,x)=>s+(x.weight??1),0); 
      let r=Math.random()*total; 
      for(const it of filteredItems){ 
        r-=(it.weight??1); 
        if(r<=0) return it; 
      } 
      return filteredItems[filteredItems.length-1]; 
    }
    function centerAngleForIndex(idx){ const slice = globalSliceAngle(); return - (idx + 0.5) * slice; }
    
    const confettiLayer=new PIXI.Container(); root.addChild(confettiLayer);
    const gravity=900; const confetti=[];
    function spawnConfetti(n=120){
      for(let i=0;i<n;i++){
        const g=new PIXI.Graphics();
        g.beginFill(Math.random()*0xFFFFFF).drawRect(-2,-5,4,10).endFill();
        g.x=app.renderer.width/2; g.y=app.renderer.height/2 - WHEEL_RADIUS - 60;
        g.rotation=Math.random()*Math.PI; confettiLayer.addChild(g);
        confetti.push({g, vx:(Math.random()*600-300), vy:(-Math.random()*600-200), vr:(Math.random()*4-2), life:2.2+Math.random()*0.8});
      }
    }
    const audioCtx=(window.AudioContext? new AudioContext(): null);
    let muted = false;
    function isSoundOn(){ return !muted; }
    function updateSoundButton(){ 
      // Update canvas sound button text or image
      if (soundButton) {
        if (active.assets?.canvasSoundUnmute || active.assets?.canvasSoundMute) {
          // Use images for sound button
          const imageAsset = isSoundOn() ? active.assets.canvasSoundUnmute : active.assets.canvasSoundMute;
          if (imageAsset) {
            soundButton.removeChildren();
            const sprite = new PIXI.Sprite(PIXI.Texture.from(imageAsset));
            sprite.width = 80;
            sprite.height = 35;
            soundButton.addChild(sprite);
          }
        } else {
          // Use text for sound button
          if (soundButton.children[0]) {
            soundButton.children[0].text = (isSoundOn()? '🔊 Sound' : '🔇 Sound');
          }
        }
      }
    }
    function playTone(f=880,t=0.15,type='triangle',v=0.08){
      if(!audioCtx || !isSoundOn()) return;
      const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
      o.type=type; o.frequency.value=f; o.connect(g); g.connect(audioCtx.destination); g.gain.value=v;
      o.start(); setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.12); }, (t*1000)*0.7);
      setTimeout(()=>{ o.stop(); o.disconnect(); g.disconnect(); }, t*1000+120);
    }
    function sfxSpin(){ playTone(320,0.25,'sawtooth',0.05); setTimeout(()=>playTone(480,0.25,'sawtooth',0.05),120); }
    function sfxWin(){ [660,880,1320].forEach((f,i)=> setTimeout(()=>playTone(f,0.18,'triangle',0.08), i*140)); }
    
    let spinning=false, rotStart=0, rotEnd=0, t=0, duration=3.8;
    function easeOutCubic(x){ return 1-Math.pow(1-x,3); }
    app.ticker.add((delta)=>{
      if(spinning){
        const dt=delta/60; t+=dt;
        const p=Math.min(1,t/duration);
        const k=easeOutCubic(p);
        wheel.rotation = rotStart + (rotEnd - rotStart) * k;
        if(!assets.wheel){
          labels.forEach((lbl)=>{
            const localTop = wheel.toLocal(new PIXI.Point(0,-WHEEL_RADIUS));
            const ang = Math.atan2(lbl.y-localTop.y,lbl.x-localTop.x);
            const n=1-Math.min(1,Math.abs(ang)/1.2);
            lbl.scale.set(1+n*0.05);
          });
        }
        if(p>=1){
          spinning=false;
          wheel.rotation = rotEnd;
          onSpinComplete();
        }
      }
      if(confetti.length){
        const dt=delta/60;
        for(let i=confetti.length-1;i>=0;i--){
          const c=confetti[i];
          c.vy+=gravity*dt; c.g.x+=c.vx*dt; c.g.y+=c.vy*dt; c.g.rotation+=c.vr*dt; c.life-=dt;
          if(c.life<=0 || c.g.y>app.renderer.height+200){
            confettiLayer.removeChild(c.g);
            confetti.splice(i,1);
          }
        }
      }
    });
    
    const spinBtn=document.getElementById('spinBtn');
    spinBtn.addEventListener('click', spin);
    // Only allow touch spin on the wheel area, not the entire canvas
    app.view.addEventListener('pointerdown', (e)=>{ 
      if(e.pointerType!=='mouse') {
        // Check if click is within wheel area (approximate center area)
        const rect = app.view.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // Only spin if click is within wheel radius (approximate 320px radius for 1.6x scale)
        if(distance < 320) {
          spin();
        }
      }
    });
    document.getElementById('btnInfo').addEventListener('click', ()=> document.getElementById('infoModal').classList.add('show'));
    document.getElementById('btnSound').addEventListener('click', ()=>{ muted = !muted; updateSoundButton(); });
    document.querySelectorAll('.modal-close').forEach(btn=> btn.addEventListener('click', (e)=> document.querySelector(e.target.getAttribute('data-close')).classList.remove('show')));
    
    async function onSpinComplete(){
      spinning = false; // Reset spinning state
      updateSpinButtonState(); // Update button state
      const res=spin._result;
      addHistory({ ts: Date.now(), template: active.name, prize: res.label });
      sfxWin(); spawnConfetti(140);
      
      // Show congratulations modal for prize announcement
      showCanvasCongratsModal(res);
    }
    function showToast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.style.display='block'; clearTimeout(showToast._t); showToast._t=setTimeout(()=> el.style.display='none', 2200); }
    
    // Canvas-based topbar and modals
    let topbarButtons = [];
    let currentModal = null;
    let soundButton = null; // Store reference to sound button for updates
    
    function drawTopbar() {
      topbarLayer.removeChildren();
      topbarButtons = [];
      
      const vw = app.renderer.width;
      const vh = app.renderer.height;
      const buttonWidth = 80;
      const buttonHeight = 35;
      const gap = 10;
      const rightMargin = 16;
      const topMargin = 16;
      
      // Get colors from settings
      const primaryColor = parseInt(active.colors?.canvasBtnPrimary?.replace('#', '') || '17342c', 16);
      const hoverColor = parseInt(active.colors?.canvasBtnHover?.replace('#', '') || '1b3e33', 16);
      const textColor = parseInt(active.colors?.canvasBtnText?.replace('#', '') || 'd9fff2', 16);
      const borderColor = parseInt('23493d', 16);
      
      // Create buttons
      const buttons = [
        { id: 'btnRewards', text: '🏆 Rewards', action: 'rewards', image: active.assets?.canvasRewardsBtn },
        { id: 'btnInfo', text: 'ℹ️ Info', action: 'info', image: active.assets?.canvasInfoBtn },
        { id: 'btnSound', text: '🔊 Sound', action: 'sound', image: active.assets?.canvasSoundUnmute }
      ];
      
      buttons.forEach((btn, index) => {
        const button = new PIXI.Graphics();
        const x = vw - rightMargin - (buttonWidth + gap) * (buttons.length - index);
        const y = topMargin;
        
        // Use image if available, otherwise use colors
        if (btn.image) {
          const sprite = new PIXI.Sprite(PIXI.Texture.from(btn.image));
          sprite.width = buttonWidth;
          sprite.height = buttonHeight;
          button.addChild(sprite);
        } else {
          // Button background
          button.beginFill(primaryColor);
          button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
          button.endFill();
          
          // Button border
          button.lineStyle(1, borderColor);
          button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
        }
        
        // Button text (only if no image)
        if (!btn.image) {
          const text = new PIXI.Text(btn.text, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: textColor,
            fontWeight: 'bold'
          });
          text.anchor.set(0.5);
          text.x = buttonWidth / 2;
          text.y = buttonHeight / 2;
          button.addChild(text);
        }
        
        button.x = x;
        button.y = y;
        button.interactive = true;
        button.buttonMode = true;
        
        // Hover effects (only if no image)
        if (!btn.image) {
          button.on('pointerover', () => {
            button.clear();
            button.beginFill(hoverColor);
            button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            button.endFill();
            button.lineStyle(1, borderColor);
            button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            button.addChild(text);
          });
          
          button.on('pointerout', () => {
            button.clear();
            button.beginFill(primaryColor);
            button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            button.endFill();
            button.lineStyle(1, borderColor);
            button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            button.addChild(text);
          });
        }
        
        // Click handler
        button.on('pointerdown', () => {
          if (btn.action === 'rewards') {
            showModal('rewards');
          } else if (btn.action === 'info') {
            showModal('info');
          } else if (btn.action === 'sound') {
            // Toggle sound
            muted = !muted;
            updateSoundButton();
          }
        });
        
        topbarLayer.addChild(button);
        topbarButtons.push(button);
        
        // Store reference to sound button for updates
        if (btn.action === 'sound') {
          soundButton = button;
        }
      });
    }
    
    function showModal(type) {
      modalLayer.removeChildren();
      currentModal = type;
      
      const vw = app.renderer.width;
      const vh = app.renderer.height;
      
      // Modal background
      const modalBg = new PIXI.Graphics();
      modalBg.beginFill(0x000000, 0.55);
      modalBg.drawRect(0, 0, vw, vh);
      modalBg.endFill();
      modalBg.interactive = true;
      modalBg.on('pointerdown', () => hideModal());
      modalLayer.addChild(modalBg);
      
      // Modal card
      const cardWidth = Math.min(vw * 0.9, 720);
      const cardHeight = Math.min(vh * 0.8, 600);
      const cardX = (vw - cardWidth) / 2;
      const cardY = (vh - cardHeight) / 2;
      
      // Get colors from settings
      const modalBgColor = parseInt(active.colors?.canvasModalBg?.replace('#', '') || '0e1f1a', 16);
      const modalBorderColor = parseInt(active.colors?.canvasModalBorder?.replace('#', '') || '204a3e', 16);
      const modalTextColor = parseInt(active.colors?.canvasModalText?.replace('#', '') || 'e8fff5', 16);
      
      const card = new PIXI.Graphics();
      
      // Use background image if available, otherwise use solid color
      if (type === 'rewards' && active.assets?.canvasRewardsModal) {
        // Use rewards modal background image - covers entire modal including header
        const bgSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasRewardsModal));
        bgSprite.width = cardWidth;
        bgSprite.height = cardHeight;
        bgSprite.x = 0;
        bgSprite.y = 0;
        card.addChild(bgSprite);
      } else if (type === 'info' && active.assets?.canvasInfoModal) {
        // Use info modal background image - covers entire modal including header
        const bgSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasInfoModal));
        bgSprite.width = cardWidth;
        bgSprite.height = cardHeight;
        bgSprite.x = 0;
        bgSprite.y = 0;
        card.addChild(bgSprite);
      } else {
        // Use solid color background
        card.beginFill(modalBgColor);
        card.lineStyle(1, modalBorderColor);
        card.drawRoundedRect(0, 0, cardWidth, cardHeight, 14);
        card.endFill();
      }
      
      card.x = cardX;
      card.y = cardY;
      modalLayer.addChild(card);
      
      // Close button (positioned like congratulations modal)
      const closeContainer = new PIXI.Container();
      closeContainer.x = cardWidth - 30;
      closeContainer.y = 30;
      closeContainer.interactive = true;
      closeContainer.cursor = 'pointer';
      closeContainer.on('pointerdown', () => hideModal());
      
      const closeAsset = type === 'rewards' ? active.assets?.canvasRewardsClose : active.assets?.canvasInfoClose;
      if (closeAsset) {
        const sprite = new PIXI.Sprite(PIXI.Texture.from(closeAsset));
        sprite.anchor.set(0.5);
        sprite.width = 24; 
        sprite.height = 24;
        closeContainer.addChild(sprite);
      } else {
        const closeBtn = new PIXI.Graphics();
        closeBtn.beginFill(0x333333);
        closeBtn.drawCircle(0, 0, 20);
        closeBtn.endFill();
        closeContainer.addChild(closeBtn);
        const closeText = new PIXI.Text('×', { fontFamily: 'Arial', fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
        closeText.anchor.set(0.5);
        closeContainer.addChild(closeText);
      }
      card.addChild(closeContainer);
      
      // Modal content (no header, start from top)
      const contentY = 20;
      const contentHeight = cardHeight - 40;
      
      // Add title at the top of content
      const titleText = new PIXI.Text(
        type === 'rewards' ? 'REWARDS HISTORY' : 'TERMS & CONDITIONS',
        {
          fontFamily: 'Arial',
          fontSize: 18,
          fill: modalTextColor,
          fontWeight: 'bold'
        }
      );
      titleText.x = 20;
      titleText.y = contentY;
      card.addChild(titleText);
      
      // Adjust content start position
      const actualContentY = contentY + 40;
      const actualContentHeight = contentHeight - 40;
      
      if (type === 'rewards') {
        // Get rewards history from actual data
        const rewardsHistory = loadHistory().slice().reverse();
        if (rewardsHistory.length === 0) {
          // Empty state
          const emptyText = new PIXI.Text('No prizes won yet. Spin the wheel to win prizes!', {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: modalTextColor,
            wordWrap: true,
            wordWrapWidth: cardWidth - 40
          });
          emptyText.x = 20;
          emptyText.y = actualContentY;
          card.addChild(emptyText);
        } else {
          // Create grid layout for rewards
          const itemHeight = 60;
          const itemWidth = cardWidth - 40;
          const startY = actualContentY;
          
          rewardsHistory.slice(0, 6).forEach((reward, index) => {
            const itemY = startY + (index * (itemHeight + 12));
            
            // Create reward item background with gradient effect
            const itemBg = new PIXI.Graphics();
            itemBg.beginFill(0x8B5CF6); // Purple gradient start
            itemBg.drawRoundedRect(0, 0, itemWidth, itemHeight, 12);
            itemBg.endFill();
            
            // Add gradient effect (simulated)
            const gradientOverlay = new PIXI.Graphics();
            gradientOverlay.beginFill(0xEC4899, 0.3); // Pink gradient end
            gradientOverlay.drawRoundedRect(0, 0, itemWidth, itemHeight, 12);
            gradientOverlay.endFill();
            itemBg.addChild(gradientOverlay);
            
            itemBg.x = 20;
            itemBg.y = itemY;
            card.addChild(itemBg);
            
            // Prize icon (diamond)
            const iconBg = new PIXI.Graphics();
            iconBg.beginFill(0xffffff);
            iconBg.drawRoundedRect(0, 0, 48, 48, 8);
            iconBg.endFill();
            iconBg.x = 20;
            iconBg.y = itemY + 6;
            card.addChild(iconBg);
            
            const iconText = new PIXI.Text('💎', {
              fontFamily: 'Arial',
              fontSize: 24,
              fill: 0x000000
            });
            iconText.anchor.set(0.5);
            iconText.x = 20 + 24;
            iconText.y = itemY + 30;
            card.addChild(iconText);
            
            // Prize details
            const date = new Date(reward.ts);
            const dateTime = date.toLocaleDateString('en-US') + ', ' + date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
            const dateText = new PIXI.Text(dateTime, {
              fontFamily: 'Arial',
              fontSize: 12,
              fill: 0xffffff,
              fontWeight: 'normal'
            });
            dateText.x = 80;
            dateText.y = itemY + 10;
            card.addChild(dateText);
            
            const prizeText = new PIXI.Text(reward.prize, {
              fontFamily: 'Arial',
              fontSize: 14,
              fill: 0xffffff,
              fontWeight: 'bold'
            });
            prizeText.x = 80;
            prizeText.y = itemY + 30;
            card.addChild(prizeText);
          });
        }
      } else if (type === 'info') {
        // Terms content
        const contentText = new PIXI.Text('${terms || 'No terms specified.'}', {
          fontFamily: 'Arial',
          fontSize: 14,
          fill: modalTextColor,
          wordWrap: true,
          wordWrapWidth: cardWidth - 40
        });
        contentText.x = 20;
        contentText.y = contentY;
        card.addChild(contentText);
      }
    }
    
    function hideModal() {
      modalLayer.removeChildren();
      currentModal = null;
    }
    
    // Canvas congratulations modal
    function showCanvasCongratsModal(prize) {
      // Clear any existing congratulations modal
      modalLayer.removeChildren();
      
      // Create congratulations modal background
      const modalBg = new PIXI.Graphics();
      modalBg.beginFill(0x000000, 0.8);
      modalBg.drawRect(0, 0, app.screen.width, app.screen.height);
      modalBg.endFill();
      modalBg.interactive = true;
      modalBg.cursor = 'pointer';
      modalBg.on('pointerdown', () => hideCanvasCongratsModal());
      modalLayer.addChild(modalBg);
      
      // Create congratulations card
      const cardWidth = 400;
      const cardHeight = 300;
      const cardX = (app.screen.width - cardWidth) / 2;
      const cardY = (app.screen.height - cardHeight) / 2;
      
      const card = new PIXI.Graphics();
      
      // Use congratulations modal background image if available, otherwise use solid color
      if (active.assets?.canvasCongratsModal) {
        // Use congratulations modal background image
        const bgSprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasCongratsModal));
        bgSprite.width = cardWidth;
        bgSprite.height = cardHeight;
        bgSprite.x = 0;
        bgSprite.y = 0;
        card.addChild(bgSprite);
      } else {
        // Use solid color background
        card.beginFill(0x1a1a1a);
        card.drawRoundedRect(0, 0, cardWidth, cardHeight, 20);
        card.endFill();
        
        // Add gradient border effect
        const border = new PIXI.Graphics();
        border.lineStyle(3, 0x8B5CF6);
        border.drawRoundedRect(0, 0, cardWidth, cardHeight, 20);
        card.addChild(border);
      }
      
      card.x = cardX;
      card.y = cardY;
      modalLayer.addChild(card);
      
      // Add ribbon decoration
      const ribbon = new PIXI.Text('🎀', {
        fontFamily: 'Arial',
        fontSize: 32,
        fill: 0xEC4899
      });
      ribbon.anchor.set(0.5);
      ribbon.x = cardWidth / 2;
      ribbon.y = 30;
      card.addChild(ribbon);
      
      // Close button
      const closeBtn = new PIXI.Graphics();
      closeBtn.beginFill(0x333333);
      closeBtn.drawCircle(0, 0, 20);
      closeBtn.endFill();
      closeBtn.x = cardWidth - 30;
      closeBtn.y = 30;
      closeBtn.interactive = true;
      closeBtn.cursor = 'pointer';
      closeBtn.on('pointerdown', () => hideCanvasCongratsModal());
      card.addChild(closeBtn);
      
      const closeText = new PIXI.Text('×', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xffffff,
        fontWeight: 'bold'
      });
      closeText.anchor.set(0.5);
      closeText.x = cardWidth - 30;
      closeText.y = 30;
      card.addChild(closeText);
      
      // Congratulations title
      const title = new PIXI.Text('CONGRATULATIONS!', {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0x8B5CF6,
        fontWeight: 'bold'
      });
      title.anchor.set(0.5);
      title.x = cardWidth / 2;
      title.y = 80;
      card.addChild(title);
      
      // Subtitle
      const subtitle = new PIXI.Text('You receive', {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0xffffff
      });
      subtitle.anchor.set(0.5);
      subtitle.x = cardWidth / 2;
      subtitle.y = 120;
      card.addChild(subtitle);
      
      // Prize display
      const prizeText = new PIXI.Text(prize.label, {
        fontFamily: 'Arial',
        fontSize: 28,
        fill: 0xEC4899,
        fontWeight: 'bold'
      });
      prizeText.anchor.set(0.5);
      prizeText.x = cardWidth / 2;
      prizeText.y = 160;
      card.addChild(prizeText);
      
      // Generate diamonds based on prize
      const diamondCount = Math.min(5, Math.max(1, Math.floor(Math.random() * 3) + 1));
      const diamonds = new PIXI.Text('💎'.repeat(diamondCount), {
        fontFamily: 'Arial',
        fontSize: 24
      });
      diamonds.anchor.set(0.5);
      diamonds.x = cardWidth / 2;
      diamonds.y = 190;
      card.addChild(diamonds);
      
      // Claim button - make it larger and more prominent
      const claimBtn = new PIXI.Graphics();
      claimBtn.beginFill(0xEC4899);
      claimBtn.drawRoundedRect(0, 0, 150, 50, 10);
      claimBtn.endFill();
      claimBtn.x = (cardWidth - 150) / 2;
      claimBtn.y = 220;
      claimBtn.interactive = true;
      claimBtn.cursor = 'pointer';
      claimBtn.buttonMode = true;
      
      // Try multiple event types
      claimBtn.on('pointerdown', (event) => {
        event.stopPropagation();
        
        // Default: directly call the rewards modal function
        showModal('rewards');
        hideCanvasCongratsModal();
      });
      
      claimBtn.on('click', (event) => {
        event.stopPropagation();
        
        // Default: directly call the rewards modal function
        showModal('rewards');
        hideCanvasCongratsModal();
      });
      
      claimBtn.on('tap', (event) => {
        event.stopPropagation();
        
        // Default: directly call the rewards modal function
        showModal('rewards');
        hideCanvasCongratsModal();
      });
      
      // Add hover effects
      claimBtn.on('pointerover', () => {
        claimBtn.alpha = 0.8;
      });
      
      claimBtn.on('pointerout', () => {
        claimBtn.alpha = 1.0;
      });
      
      const claimText = new PIXI.Text('CLAIM', {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xffffff,
        fontWeight: 'bold'
      });
      claimText.anchor.set(0.5);
      claimText.x = 75; // Center within larger button
      claimText.y = 25; // Center within larger button
      claimBtn.addChild(claimText);
      
      card.addChild(claimBtn);
    }
    
    function hideCanvasCongratsModal() {
      modalLayer.removeChildren();
    }

    // Canvas-based SPIN button
    let spinButton = null;
    
    function drawSpinButton() {
      // Remove existing spin button
      if (spinButton) {
        uiLayer.removeChild(spinButton);
      }
      
      const vw = app.renderer.width;
      const vh = app.renderer.height;
      const dpr = window.devicePixelRatio || 1;
      
      // Button dimensions
      const buttonWidth = 140 * dpr;
      const buttonHeight = 50 * dpr;
      const buttonX = (vw - buttonWidth) / 2;
      const buttonY = vh - 150 * dpr; // More space at bottom
      
      // Get colors from settings
      const primaryColor = parseInt(active.colors?.canvasSpinBtn?.replace('#', '') || '24d58b', 16);
      const hoverColor = parseInt(active.colors?.canvasSpinBtnHover?.replace('#', '') || '2be68b', 16);
      const borderColor = parseInt(active.colors?.canvasSpinBtnBorder?.replace('#', '') || '0fb168', 16);
      
      // Create button graphics
      spinButton = new PIXI.Graphics();
      
      // Use image if available, otherwise use colors
      if (active.assets?.canvasSpinBtn) {
        const sprite = new PIXI.Sprite(PIXI.Texture.from(active.assets.canvasSpinBtn));
        sprite.width = buttonWidth;
        sprite.height = buttonHeight;
        spinButton.addChild(sprite);
      } else {
        // Button background with gradient effect
        spinButton.beginFill(primaryColor);
        spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.endFill();
        
        // Button border
        spinButton.lineStyle(2 * dpr, borderColor);
        spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
        
        // Button shadow effect
        spinButton.beginFill(0x000000, 0.2);
        spinButton.drawRoundedRect(2 * dpr, 2 * dpr, buttonWidth, buttonHeight, 14 * dpr);
        spinButton.endFill();
        
        // Button text (only if no image)
        const text = new PIXI.Text('SPIN', {
          fontFamily: 'Arial, sans-serif',
          fontSize: 20 * dpr,
          fill: 0xffffff,
          fontWeight: 'bold',
          stroke: 0x000000,
          strokeThickness: 1 * dpr
        });
        text.anchor.set(0.5);
        text.x = buttonWidth / 2;
        text.y = buttonHeight / 2;
        spinButton.addChild(text);
      }
      
      spinButton.x = buttonX;
      spinButton.y = buttonY;
      spinButton.interactive = true;
      spinButton.buttonMode = true;
      spinButton.cursor = 'pointer';
      
      // Hover effects (only if no image)
      if (!active.assets?.canvasSpinBtn) {
        spinButton.on('pointerover', () => {
          spinButton.clear();
          spinButton.beginFill(hoverColor);
          spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
          spinButton.endFill();
          spinButton.lineStyle(2 * dpr, borderColor);
          spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
          spinButton.beginFill(0x000000, 0.2);
          spinButton.drawRoundedRect(2 * dpr, 2 * dpr, buttonWidth, buttonHeight, 14 * dpr);
          spinButton.endFill();
          spinButton.addChild(text);
        });
        
        spinButton.on('pointerout', () => {
          spinButton.clear();
          spinButton.beginFill(primaryColor);
          spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
          spinButton.endFill();
          spinButton.lineStyle(2 * dpr, borderColor);
          spinButton.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 14 * dpr);
          spinButton.beginFill(0x000000, 0.2);
          spinButton.drawRoundedRect(2 * dpr, 2 * dpr, buttonWidth, buttonHeight, 14 * dpr);
          spinButton.endFill();
          spinButton.addChild(text);
        });
      }
      
      // Click handler - call the same spin function
      spinButton.on('pointerdown', () => {
        if (!spinning) {
          spin();
        }
      });
      
      // Update button state based on spinning
      if (spinning) {
        spinButton.alpha = 0.5;
        spinButton.interactive = false;
      } else {
        spinButton.alpha = 1;
        spinButton.interactive = true;
      }
      
      uiLayer.addChild(spinButton);
    }
    
    updateSoundButton();
    layout();
  } catch(err){
    console.error('[Init Error]', err);
    const el=document.getElementById('toast');
    el.textContent='⚠️ Init error: '+(err?.message||err); el.style.display='block';
  }
})();
</script>
</body>
</html>`;
}
