(async function(){
  try{
  // ---- Config ---------------------------------------------------------------
  const CONFIG = { API_ENDPOINT: '/api/claim', ENABLE_SFX: true, BASE_RADIUS: 360, HUB_RADIUS: 70 };

  // ---- Pixi app ------------------------------------------------------------
  const app = new PIXI.Application({ resizeTo: document.getElementById('game'), backgroundAlpha: 0, antialias: true, autoDensity: true, powerPreference: 'high-performance' });
  document.getElementById('game').appendChild(app.view);
  const DESIGN = { w: 900, h: 1400 };

  // Root & layers ------------------------------------------------------------
  const root = new PIXI.Container();
  const bgLayer = new PIXI.Container();
  const uiLayer = new PIXI.Container();
  app.stage.addChild(bgLayer); app.stage.addChild(root); app.stage.addChild(uiLayer);

  const wheelContainer = new PIXI.Container();
  root.addChild(wheelContainer);

  // Responsive ---------------------------------------------------------------
  let sizeMultiplier = 1.3; let autoMultiplier = 1;
  function computeAutoMultiplier(){ const vw=app.renderer.width, vh=app.renderer.height; const minEdge=Math.min(vw,vh); const targetDiameter=minEdge*0.8; autoMultiplier = targetDiameter/(CONFIG.BASE_RADIUS*2); autoMultiplier=Math.max(0.6, Math.min(1.6, autoMultiplier)); }
  function layout(){ const vw=app.renderer.width, vh=app.renderer.height; const scale=Math.min(vw/DESIGN.w, vh/DESIGN.h); root.scale.set(scale); root.x=vw/2-(DESIGN.w*scale)/2; root.y=vh/2-(DESIGN.h*scale)/2; wheelContainer.x=DESIGN.w/2; wheelContainer.y=(vw>vh)? DESIGN.h/2-20 : DESIGN.h/2-120; drawBackground(); computeAutoMultiplier(); drawWheel(); drawLogo(); }
  app.renderer.on('resize', layout);

  // ---- Templates -----------------------------------------------------------
  const LS_KEY = 'spinWheelTemplates.v1';
  function defaultTemplate(){ return { name:'Default', terms:`By participating you agree:
• One spin per session.
• Prizes are non-transferable.
• Organizer reserves the right to modify terms.`, prizesText:'🎁 iPhone 15 Pro | 1 | #25c77a\n💰 RM 50 Credit | 2 | #E9FFF7\n🎉 Mystery Gift | 1 | #25c77a\n🧧 Angpao RM 10 | 2 | #E9FFF7\n🍀 Free Spin | 3 | #25c77a\n💎 Mega Gift Box | 0.5 | #E9FFF7', assets:{bg:null,logo:null,spin:null,rewardsBtn:null,infoBtn:null,soundUnmute:null,soundMute:null,rewardsModal:null,rewardsClose:null,infoModal:null,infoClose:null,wheel:null}, colors:{pageBackground:{type:'color',style:'#0a2b22'},spinButton:{type:'gradient',style:'linear-gradient(to bottom, #24d58b, #0fb168)'}} }; }
  function loadTemplates(){ try{ const arr=JSON.parse(localStorage.getItem(LS_KEY)||'[]'); if(Array.isArray(arr)&&arr.length) return arr; }catch{} const seed=[defaultTemplate()]; localStorage.setItem(LS_KEY, JSON.stringify(seed)); return seed; }
  function saveTemplates(){ localStorage.setItem(LS_KEY, JSON.stringify(templates)); }
  let templates = loadTemplates(); let activeIndex=0; let active=templates[activeIndex];

  // ---- Prize parsing -------------------------------------------------------
  function normalizeColor(c){ if(typeof c==='number') return c; if(typeof c==='string'){ if(c.startsWith('#')) return parseInt(c.slice(1),16); if(/^0x/i.test(c)) return parseInt(c,16); return 0x25c77a; } return 0x25c77a; }
  function toId(label){ return label.toLowerCase().replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,''); }
  function parseFromText(txt){ const lines=txt.split(/\n+/).map(l=>l.trim()).filter(Boolean); if(lines.length<2) throw new Error('Please enter at least 2 prizes'); const arr=[]; for(const line of lines){ const parts=line.split('|').map(s=>s.trim()); const label=parts[0]||'Prize'; const weight=parseFloat(parts[1]??'1'); if(!Number.isFinite(weight)||weight<=0) throw new Error(`Invalid weight for "${label}"`); const color=parts[2]??'#25c77a'; arr.push({ id:toId(label), label, color, weight }); } const ids=new Set(arr.map(x=>x.id)); if(ids.size!==arr.length) throw new Error('Duplicate labels – make each unique'); return arr; }
  let SLICES = [];
  try { SLICES = parseFromText(active.prizesText); }
  catch(e){ console.warn('Prize parse failed, using defaults', e); SLICES = parseFromText(defaultTemplate().prizesText); }

  // ---- UI refs -------------------------------------------------------------
  const panel = document.getElementById('configPanel');
  const btnRewards = document.getElementById('btnRewards');
  const btnInfo = document.getElementById('btnInfo');
  const btnSound = document.getElementById('btnSound');
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

  // Spin Button elements
  const spinBtnType = document.getElementById('spinBtnType');
  const spinBtnColor = document.getElementById('spinBtnColor');
  const spinBtnGradient1 = document.getElementById('spinBtnGradient1');
  const spinBtnGradient2 = document.getElementById('spinBtnGradient2');
  const spinBtnGradientDirection = document.getElementById('spinBtnGradientDirection');
  const spinBtnColorRow = document.getElementById('spinBtnColorRow');
  const spinBtnGradientRow = document.getElementById('spinBtnGradientRow');
  const spinBtnImageRow = document.getElementById('spinBtnImageRow');
  const spinBtnFile = document.getElementById('spinBtnFile');
  const spinBtnClear = document.getElementById('spinBtnClear');

  // Rewards Button elements
  const rewardsBtnFile = document.getElementById('rewardsBtnFile');
  const rewardsBtnClear = document.getElementById('rewardsBtnClear');

  // Info Button elements
  const infoBtnFile = document.getElementById('infoBtnFile');
  const infoBtnClear = document.getElementById('infoBtnClear');

  // Sound Button elements
  const soundUnmuteFile = document.getElementById('soundUnmuteFile');
  const soundUnmuteClear = document.getElementById('soundUnmuteClear');
  const soundMuteFile = document.getElementById('soundMuteFile');
  const soundMuteClear = document.getElementById('soundMuteClear');

  // Wheel Image elements
  const wheelFile = document.getElementById('wheelFile');
  const wheelClear = document.getElementById('wheelClear');

  // Modal Background elements
  const rewardsModalFile = document.getElementById('rewardsModalFile');
  const rewardsModalClear = document.getElementById('rewardsModalClear');
  const rewardsCloseFile = document.getElementById('rewardsCloseFile');
  const rewardsCloseClear = document.getElementById('rewardsCloseClear');
  const infoModalFile = document.getElementById('infoModalFile');
  const infoModalClear = document.getElementById('infoModalClear');
  const infoCloseFile = document.getElementById('infoCloseFile');
  const infoCloseClear = document.getElementById('infoCloseClear');
  
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

  function refreshTemplateUI(){
    templateSelect.innerHTML = templates.map((t,i)=>`<option value="${i}">${t.name||('Template '+(i+1))}</option>`).join('');
    templateSelect.value = String(activeIndex);
    templateName.value = active.name || '';
    activeTemplateName.textContent = active.name || 'Template';

    configText.value = active.prizesText || '';
    termsText.value = active.terms || '';
    termsBody.textContent = active.terms || '';

    forceSelect.innerHTML = '<option value="">Force Prize (QA)</option>' + SLICES.map((s,i)=>`<option value="${i}">${s.label}</option>`).join('');
    
    // Load color settings
    if(active.colors) {
      if(active.colors.background) {
        bgType.value = active.colors.background.type;
        if(active.colors.background.type === 'color') {
          bgColor.value = active.colors.background.style;
        } else if(active.colors.background.type === 'gradient') {
          // Parse gradient colors (simplified)
          const match = active.colors.background.style.match(/linear-gradient\([^,]+, ([^,]+), ([^)]+)\)/);
          if(match) {
            bgGradient1.value = match[1].trim();
            bgGradient2.value = match[2].trim();
          }
        }
        updateBackground();
      }
      
      if(active.colors.button) {
        btnType.value = active.colors.button.type;
        if(active.colors.button.type === 'color') {
          btnColor.value = active.colors.button.style;
        } else if(active.colors.button.type === 'gradient') {
          const match = active.colors.button.style.match(/linear-gradient\([^,]+, ([^,]+), ([^)]+)\)/);
          if(match) {
            btnGradient1.value = match[1].trim();
            btnGradient2.value = match[2].trim();
          }
        }
        updateButton();
      }
    }
    
    // Load modal background images
    if(active.assets.rewardsModal) {
      // Modal background would be applied when opening rewards modal
    }
    if(active.assets.infoModal) {
      // Modal background would be applied when opening info modal
    }
    
    // Wheel image is automatically handled by the drawWheel function
    
    // Update wheel size display
    updateWheelSizeDisplay();
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
  pageBgFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.bg=await fileToDataURL(f); saveTemplates(); drawBackground(); showToast('🖼️ Page background set'); });
  pageBgClear.addEventListener('click', ()=>{ active.assets.bg=null; saveTemplates(); drawBackground(); });
  
  // Logo handlers
  logoFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.logo=await fileToDataURL(f); saveTemplates(); drawLogo(); showToast('🖼️ Logo set'); });
  logoClear.addEventListener('click', ()=>{ active.assets.logo=null; saveTemplates(); drawLogo(); });
  
  // Spin Button handlers
  spinBtnFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.spin=await fileToDataURL(f); saveTemplates(); drawWheel(true); showToast('🖼️ Spin button image set'); });
  spinBtnClear.addEventListener('click', ()=>{ active.assets.spin=null; saveTemplates(); drawWheel(true); });
  
  // Rewards Button handlers
  rewardsBtnFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.rewardsBtn=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Rewards button image set'); });
  rewardsBtnClear.addEventListener('click', ()=>{ active.assets.rewardsBtn=null; saveTemplates(); });
  
  // Info Button handlers
  infoBtnFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.infoBtn=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Info button image set'); });
  infoBtnClear.addEventListener('click', ()=>{ active.assets.infoBtn=null; saveTemplates(); });
  
  // Sound Button handlers
  soundUnmuteFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.soundUnmute=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Unmute button image set'); });
  soundUnmuteClear.addEventListener('click', ()=>{ active.assets.soundUnmute=null; saveTemplates(); });
  
  soundMuteFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.soundMute=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Mute button image set'); });
  soundMuteClear.addEventListener('click', ()=>{ active.assets.soundMute=null; saveTemplates(); });

  // Wheel Image handlers
  wheelFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.wheel=await fileToDataURL(f); saveTemplates(); drawWheel(true); showToast('🖼️ Wheel image set - Prize weights still work!'); });
  wheelClear.addEventListener('click', ()=>{ active.assets.wheel=null; saveTemplates(); drawWheel(true); });

  // Modal Background handlers
  rewardsModalFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.rewardsModal=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Rewards modal background set'); });
  rewardsModalClear.addEventListener('click', ()=>{ active.assets.rewardsModal=null; saveTemplates(); });
  
  rewardsCloseFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.rewardsClose=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Rewards close button set'); });
  rewardsCloseClear.addEventListener('click', ()=>{ active.assets.rewardsClose=null; saveTemplates(); });
  
  infoModalFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.infoModal=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Info modal background set'); });
  infoModalClear.addEventListener('click', ()=>{ active.assets.infoModal=null; saveTemplates(); });
  
  infoCloseFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.infoClose=await fileToDataURL(f); saveTemplates(); showToast('🖼️ Info close button set'); });
  infoCloseClear.addEventListener('click', ()=>{ active.assets.infoClose=null; saveTemplates(); });

  // Prize area ---------------------------------------------------------------
  applyBtn.addEventListener('click', ()=>{
  try{
    const next=parseFromText(configText.value);
    SLICES=next; active.prizesText=configText.value; active.terms = termsText.value.trim(); saveTemplates();
    refreshTemplateUI();
    drawWheel(true);
    showToast('✅ Prizes applied');
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
  
  
  spinBtnType.addEventListener('change', ()=>{
    const type = spinBtnType.value;
    spinBtnColorRow.style.display = type === 'color' ? 'flex' : 'none';
    spinBtnGradientRow.style.display = type === 'gradient' ? 'flex' : 'none';
    spinBtnImageRow.style.display = type === 'image' ? 'flex' : 'none';
    updateSpinButton();
  });
  
  
  
  
  // Color change handlers
  pageBgColor.addEventListener('input', updatePageBackground);
  pageBgGradient1.addEventListener('input', updatePageBackground);
  pageBgGradient2.addEventListener('input', updatePageBackground);
  pageBgGradientDirection.addEventListener('change', updatePageBackground);
  
  
  spinBtnColor.addEventListener('input', updateSpinButton);
  spinBtnGradient1.addEventListener('input', updateSpinButton);
  spinBtnGradient2.addEventListener('input', updateSpinButton);
  spinBtnGradientDirection.addEventListener('change', updateSpinButton);
  
  
  
  // Reset to default functionality
  resetToDefault.addEventListener('click', ()=>{
    if(confirm('Are you sure you want to reset to default settings? This will clear all customizations.')) {
      // Reset to default template
      const defaultTpl = defaultTemplate();
      active.name = defaultTpl.name;
      active.terms = defaultTpl.terms;
      active.prizesText = defaultTpl.prizesText;
      active.assets = {bg:null,logo:null,wheel:null,spin:null};
      active.colors = defaultTpl.colors;
      
      // Reset UI elements
      templateName.value = active.name;
      termsText.value = active.terms;
      configText.value = active.prizesText;
      
      // Reset color pickers
      bgType.value = 'color';
      bgColor.value = '#0a2b22';
      btnType.value = 'gradient';
      btnColor.value = '#24d58b';
      btnGradient1.value = '#24d58b';
      btnGradient2.value = '#0fb168';
      btnGradientDirection.value = 'to bottom';
      
      // Reset wheel size
      sizeRange.value = '1.3';
      sizeMultiplier = 1.3;
      
      // Clear file inputs
      bgFile.value = '';
      logoFile.value = '';
      wheelFile.value = '';
      spinFile.value = '';
      
      // Save and refresh
      saveTemplates();
      SLICES = parseFromText(active.prizesText);
      refreshTemplateUI();
      drawBackground();
      drawWheel(true);
      drawLogo();
      updateBackground();
      updateButton();
      
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
      // Store in template for export
      if(!active.colors) active.colors = {};
      active.colors.pageBackground = { type, style: bgStyle };
      saveTemplates();
    }
  }
  
  function updateLogo() {
    // Logo is image-only, no styling needed
    saveTemplates();
  }
  
  function updateSpinButton() {
    const type = spinBtnType.value;
    let btnStyle = '';
    
    if(type === 'color') {
      btnStyle = spinBtnColor.value;
    } else if(type === 'gradient') {
      const direction = spinBtnGradientDirection.value;
      const color1 = spinBtnGradient1.value;
      const color2 = spinBtnGradient2.value;
      
      if(direction === 'radial') {
        btnStyle = `radial-gradient(circle, ${color1}, ${color2})`;
      } else {
        btnStyle = `linear-gradient(${direction}, ${color1}, ${color2})`;
      }
    }
    
    if(btnStyle) {
      const spinBtn = document.getElementById('spinBtn');
      if(type === 'color') {
        spinBtn.style.background = btnStyle;
        spinBtn.style.backgroundImage = 'none';
      } else {
        spinBtn.style.background = btnStyle;
      }
      
      // Store in template for export
      if(!active.colors) active.colors = {};
      active.colors.spinButton = { type, style: btnStyle };
      saveTemplates();
    }
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
  const base=new PIXI.Graphics(); const rim=new PIXI.Graphics(); const wheel=new PIXI.Container(); const hub=new PIXI.Graphics(); const goText=new PIXI.Text('GO', { fill:'#0e7b55', fontSize:36, fontWeight:'900', fontFamily:'Inter, Arial' }); const spinSprite=new PIXI.Sprite(); const pointer=new PIXI.Graphics(); const dots=new PIXI.Graphics(); const labels=[]; const wheelImageSprite=new PIXI.Sprite(); const hubLayer=new PIXI.Container();
  // draw order: base/rim (static), wheel (contains wheelImageSprite + slices), dots, hubLayer (static), pointer (static)
  wheelContainer.addChild(base, rim, wheel, dots, hubLayer, pointer);
  let WHEEL_RADIUS = CONFIG.BASE_RADIUS;

  function drawBackground(){ bgSprite.texture=PIXI.Texture.EMPTY; if(active.assets.bg){ bgSprite.texture=PIXI.Texture.from(active.assets.bg); } const vw=app.renderer.width, vh=app.renderer.height; if(bgSprite.texture.baseTexture.valid){ const iw=bgSprite.texture.width, ih=bgSprite.texture.height; const s=Math.max(vw/iw, vh/ih); bgSprite.scale.set(s); bgSprite.x=(vw - iw*s)/2; bgSprite.y=(vh - ih*s)/2; } }
  function drawLogo(){ logoSprite.texture=PIXI.Texture.EMPTY; if(active.assets.logo){ logoSprite.texture=PIXI.Texture.from(active.assets.logo); } logoSprite.anchor.set?.(0.5,0.5); const sc=0.5; logoSprite.scale.set(sc, sc); logoSprite.x = root.x + root.scale.x*(DESIGN.w/2); logoSprite.y = root.y + root.scale.y*(DESIGN.h/2 - 420); }

  function drawWheel(resetRotation=false){
    WHEEL_RADIUS = CONFIG.BASE_RADIUS * sizeMultiplier * autoMultiplier;
    if(resetRotation) wheel.rotation = 0;

    // clear
    base.clear(); rim.clear(); wheel.removeChildren(); labels.length = 0;
    dots.clear(); hub.clear(); pointer.clear(); hubLayer.removeChildren();

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
    if(active.assets.spin){
      spinSprite.texture = PIXI.Texture.from(active.assets.spin);
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

    // pointer (non-rotating)
    const baseY = -HR - 6; const tipY  = -HR - 34 * (WHEEL_RADIUS/CONFIG.BASE_RADIUS);
    pointer.beginFill(0xffee66).drawPolygon([ -14, baseY, 14, baseY, 0, tipY ]).endFill();
    pointer.lineStyle(3,0x8a7a28,1).moveTo(-14, baseY).lineTo(14, baseY).lineTo(0, tipY).lineTo(-14, baseY);

    // dots (decor)
    dots.beginFill(0xffffff,0.9);
    const N = 60; for(let i=0;i<N;i++){ const a=-Math.PI/2 + i*(Math.PI*2/N); dots.drawCircle(Math.cos(a)*(WHEEL_RADIUS+4), Math.sin(a)*(WHEEL_RADIUS+4), i%2?2.5:1.7);} dots.endFill();
  }

  // Picker + angles ----------------------------------------------------------
  const TWO_PI = Math.PI * 2;
  const globalSliceAngle = ()=> TWO_PI / SLICES.length;
  function pickWeighted(items){ const forceIdx=forceSelect.value!==''? parseInt(forceSelect.value,10):null; if(Number.isInteger(forceIdx)&&items[forceIdx]) return items[forceIdx]; const total=items.reduce((s,x)=>s+(x.weight??1),0); let r=Math.random()*total; for(const it of items){ r-=(it.weight??1); if(r<=0) return it; } return items[items.length-1]; }
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
  function updateSoundButton(){ btnSound.textContent = (isSoundOn()? '🔊 Sound' : '🔇 Sound'); }
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
  const spinBtn=document.getElementById('spinBtn');
  spinBtn.addEventListener('click', spin);
  app.view.addEventListener('pointerdown', (e)=>{ if(e.pointerType!=='mouse') spin(); });
  // Top bar actions
  btnRewards.addEventListener('click', ()=> openRewards());
  btnInfo.addEventListener('click', ()=> openInfo());
  btnSound.addEventListener('click', ()=>{ muted = !muted; updateSoundButton(); });
  document.querySelectorAll('.modal-close').forEach(btn=> btn.addEventListener('click', (e)=> closeModal(e.target.getAttribute('data-close'))));

  function spin(){
    if(spinning) return;
    if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
    const chosen = pickWeighted(SLICES);
    const idx = SLICES.indexOf(chosen);
    // Land exactly at the slice center
    const targetCenter = centerAngleForIndex(idx);
    const fullSpins = (5 + Math.floor(Math.random()*3)) * TWO_PI; // 5-7 full spins
    rotStart = wheel.rotation % TWO_PI;
    rotEnd   = targetCenter + fullSpins;
    duration = 4.25 + Math.random()*0.9;
    t = 0; spinning = true; spinBtn.disabled = true;
    showToast('Spinning for your gift...'); sfxSpin();
    spin._result = chosen;
  }
  async function onSpinComplete(){
    spinBtn.disabled=false;
    const res=spin._result;
    addHistory({ ts: Date.now(), template: active.name, prize: res.label });
    showToast('🎊 You won: '+res.label); sfxWin(); spawnConfetti(140);
    try{
      const response=await fetch(CONFIG.API_ENDPOINT,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:res.id, prize:res.label, weight:res.weight, ts: Date.now(), template: active.name })
      });
      if(!response.ok) throw new Error('HTTP '+response.status);
      await response.json().catch(()=>({ok:true}));
      showToast('✅ Saved to server');
    }catch(err){ 
      // Silently handle API errors without showing user notification
      console.warn('API error', err); 
    }
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
  function openRewards(){ const arr=loadHistory().slice().reverse(); rewardsList.innerHTML = arr.length? arr.map(r=>`<li><span>${r.prize}</span><small>${formatTs(r.ts)} • ${r.template||''}</small></li>`).join('') : '<li>No spins yet.</li>'; openModal('#rewardsModal'); }
  function openInfo(){ termsBody.textContent = (active.terms||''); openModal('#infoModal'); }

  // Init ---------------------------------------------------------------------
  function refreshTemplateUI(){
    templateSelect.innerHTML = templates.map((t,i)=>`<option value="${i}">${t.name||('Template '+(i+1))}</option>`).join('');
    templateSelect.value = String(activeIndex);
    templateName.value = active.name || '';
    activeTemplateName.textContent = active.name || 'Template';

    configText.value = active.prizesText || '';
    termsText.value = active.terms || '';
    termsBody.textContent = active.terms || '';

    forceSelect.innerHTML = '<option value="">Force Prize (QA)</option>' + SLICES.map((s,i)=>`<option value="${i}">${s.label}</option>`).join('');
    updateSoundButton();
  }

  refreshTemplateUI();
    layout();
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
    const CONFIG = { API_ENDPOINT: '/api/claim', ENABLE_SFX: true, BASE_RADIUS: 360, HUB_RADIUS: 70 };
    const app = new PIXI.Application({ resizeTo: document.getElementById('game'), backgroundAlpha: 0, antialias: true, autoDensity: true, powerPreference: 'high-performance' });
    document.getElementById('game').appendChild(app.view);
    const DESIGN = { w: 900, h: 1400 };
    
    const root = new PIXI.Container();
    const bgLayer = new PIXI.Container();
    const uiLayer = new PIXI.Container();
    app.stage.addChild(bgLayer); app.stage.addChild(root); app.stage.addChild(uiLayer);
    const wheelContainer = new PIXI.Container();
    root.addChild(wheelContainer);
    
    let sizeMultiplier = ${wheelSize}; let autoMultiplier = 1;
    function computeAutoMultiplier(){ const vw=app.renderer.width, vh=app.renderer.height; const minEdge=Math.min(vw,vh); const targetDiameter=minEdge*0.8; autoMultiplier = targetDiameter/(CONFIG.BASE_RADIUS*2); autoMultiplier=Math.max(0.6, Math.min(1.6, autoMultiplier)); }
    function layout(){ const vw=app.renderer.width, vh=app.renderer.height; const scale=Math.min(vw/DESIGN.w, vh/DESIGN.h); root.scale.set(scale); root.x=vw/2-(DESIGN.w*scale)/2; root.y=vh/2-(DESIGN.h*scale)/2; wheelContainer.x=DESIGN.w/2; wheelContainer.y=(vw>vh)? DESIGN.h/2-20 : DESIGN.h/2-120; drawBackground(); computeAutoMultiplier(); drawWheel(); drawLogo(); }
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
    function drawLogo(){ logoSprite.texture=PIXI.Texture.EMPTY; if(assets.logo){ logoSprite.texture=PIXI.Texture.from(assets.logo); } logoSprite.anchor.set?.(0.5,0.5); const sc=0.5; logoSprite.scale.set(sc, sc); logoSprite.x = root.x + root.scale.x*(DESIGN.w/2); logoSprite.y = root.y + root.scale.y*(DESIGN.h/2 - 420); }
    
    function drawWheel(resetRotation=false){
      WHEEL_RADIUS = CONFIG.BASE_RADIUS * sizeMultiplier * autoMultiplier;
      if(resetRotation) wheel.rotation = 0;
      base.clear(); rim.clear(); wheel.removeChildren(); labels.length = 0;
      dots.clear(); hub.clear(); pointer.clear(); hubLayer.removeChildren();
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
    function pickWeighted(items){ const total=items.reduce((s,x)=>s+(x.weight??1),0); let r=Math.random()*total; for(const it of items){ r-=(it.weight??1); if(r<=0) return it; } return items[items.length-1]; }
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
    function updateSoundButton(){ document.getElementById('btnSound').textContent = (isSoundOn()? '🔊 Sound' : '🔇 Sound'); }
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
    app.view.addEventListener('pointerdown', (e)=>{ if(e.pointerType!=='mouse') spin(); });
    document.getElementById('btnInfo').addEventListener('click', ()=> document.getElementById('infoModal').classList.add('show'));
    document.getElementById('btnSound').addEventListener('click', ()=>{ muted = !muted; updateSoundButton(); });
    document.querySelectorAll('.modal-close').forEach(btn=> btn.addEventListener('click', (e)=> document.querySelector(e.target.getAttribute('data-close')).classList.remove('show')));
    
    function spin(){
      if(spinning) return;
      if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
      
      // Always use weighted selection - prize weights are ALWAYS respected
      const chosen = pickWeighted(SLICES);
      const idx = SLICES.indexOf(chosen);
      const targetCenter = centerAngleForIndex(idx);
      
      const fullSpins = (5 + Math.floor(Math.random()*3)) * TWO_PI;
      rotStart = wheel.rotation % TWO_PI;
      rotEnd   = targetCenter + fullSpins;
      duration = 4.25 + Math.random()*0.9;
      t = 0; spinning = true; spinBtn.disabled = true;
      showToast('Spinning for your gift...'); sfxSpin();
      spin._result = chosen;
    }
    async function onSpinComplete(){
      spinBtn.disabled=false;
      const res=spin._result;
      showToast('🎊 You won: '+res.label); sfxWin(); spawnConfetti(140);
    }
    function showToast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.style.display='block'; clearTimeout(showToast._t); showToast._t=setTimeout(()=> el.style.display='none', 2200); }
    
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
