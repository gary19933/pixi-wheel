(async function(){
  try{
  // ---- Config ---------------------------------------------------------------
  const CONFIG = { API_ENDPOINT: '/api/claim', ENABLE_SFX: true, BASE_RADIUS: 400, HUB_RADIUS: 80 };

  // ---- Pixi app ------------------------------------------------------------
  const app = new PIXI.Application({ resizeTo: document.getElementById('game'), backgroundAlpha: 0, antialias: true, autoDensity: true, powerPreference: 'high-performance' });
  document.getElementById('game').appendChild(app.view);
  const DESIGN = { w: 900, h: 1400 };

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
  function computeAutoMultiplier(){ const vw=app.renderer.width, vh=app.renderer.height; const minEdge=Math.min(vw,vh); const targetDiameter=minEdge*0.8; autoMultiplier = targetDiameter/(CONFIG.BASE_RADIUS*2); autoMultiplier=Math.max(0.6, Math.min(1.6, autoMultiplier)); }
  function layout(){ const vw=app.renderer.width, vh=app.renderer.height; const scale=Math.min(vw/DESIGN.w, vh/DESIGN.h); root.scale.set(scale); root.x=vw/2-(DESIGN.w*scale)/2; root.y=vh/2-(DESIGN.h*scale)/2; wheelContainer.x=DESIGN.w/2; wheelContainer.y=(vw>vh)? DESIGN.h/2-40 : DESIGN.h/2-80; drawBackground(); computeAutoMultiplier(); drawWheel(); drawLogo(); drawTopbar(); drawSpinButton(); }
  app.renderer.on('resize', layout);

  // ---- Templates -----------------------------------------------------------
  const LS_KEY = 'spinWheelTemplates.v1';
  function defaultTemplate(){ return { name:'Default', terms:`By participating you agree:
• One spin per session.
• Prizes are non-transferable.
• Organizer reserves the right to modify terms.`, prizesText:'🎁 iPhone 15 Pro | 1 | #25c77a\n💰 RM 50 Credit | 2 | #E9FFF7\n🎉 Mystery Gift | 1 | #25c77a\n🧧 Angpao RM 10 | 2 | #E9FFF7\n🍀 Free Spin | 3 | #25c77a\n💎 Mega Gift Box | 0.5 | #E9FFF7', assets:{bg:null,logo:null,spin:null,rewardsBtn:null,infoBtn:null,soundUnmute:null,soundMute:null,rewardsModal:null,rewardsClose:null,infoModal:null,infoClose:null,wheel:null,canvasRewardsBtn:null,canvasInfoBtn:null,canvasSoundUnmute:null,canvasSoundMute:null,canvasSpinBtn:null,canvasRewardsModal:null,canvasRewardsClose:null,canvasInfoModal:null,canvasInfoClose:null,canvasCongratsModal:null,canvasCongratsClose:null}, colors:{pageBackground:{type:'color',style:'#0a2b22'},spinButton:{type:'gradient',style:'linear-gradient(to bottom, #24d58b, #0fb168)'},canvasBtnPrimary:'#17342c',canvasBtnHover:'#1b3e33',canvasBtnText:'#d9fff2',canvasModalBg:'#0e1f1a',canvasModalBorder:'#204a3e',canvasModalText:'#e8fff5',canvasSpinBtn:'#24d58b',canvasSpinBtnHover:'#2be68b',canvasSpinBtnBorder:'#0fb168'}, settings:{claimAction:'modal',claimUrl:'',guaranteedPrize:''} }; }
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
  
  

  // Wheel Image handlers
  wheelFile.addEventListener('change', async (e)=>{ const f=e.target.files[0]; if(!f) return; active.assets.wheel=await fileToDataURL(f); saveTemplates(); drawWheel(true); showToast('🖼️ Wheel image set - Prize weights still work!'); });
  wheelClear.addEventListener('click', ()=>{ active.assets.wheel=null; saveTemplates(); drawWheel(true); });

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

  // Guaranteed prize event handler
  guaranteedPrize.addEventListener('change', ()=>{ 
    // Ensure settings object exists
    if (!active.settings) {
      active.settings = {};
    }
    active.settings.guaranteedPrize = guaranteedPrize.value; 
    saveTemplates(); 
    if (guaranteedPrize.value) {
      const prizeLabel = SLICES.find(s => s.id === guaranteedPrize.value)?.label;
      showToast('🎯 Guaranteed prize set: ' + prizeLabel);
    } else {
      showToast('🎲 Random prizes enabled');
    }
  });


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

      // Refresh
      refreshTemplateUI();
      drawBackground();
      drawWheel(true);
      drawTopbar();
      updateSoundButton?.();
      drawSpinButton();
      showToast('🔄 Reset to default settings');
      
      // Reset wheel size
      sizeRange.value = '1.6';
      sizeMultiplier = 1.6;
      
      // Reset claim button settings
      active.settings = defaultTpl.settings;
      claimAction.value = 'modal';
      claimUrl.value = '';
      claimUrlRow.style.display = 'none';
      
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
  const base=new PIXI.Graphics(); const rim=new PIXI.Graphics(); const wheel=new PIXI.Container(); const hub=new PIXI.Graphics(); const goText=new PIXI.Text('GO', { fill:'#0e7b55', fontSize:36, fontWeight:'900', fontFamily:'Inter, Arial' }); const spinSprite=new PIXI.Sprite(); const pointer=new PIXI.Graphics(); const dots=new PIXI.Graphics(); const labels=[]; const wheelImageSprite=new PIXI.Sprite(); const hubLayer=new PIXI.Container();
  // draw order: base/rim (static), wheel (contains wheelImageSprite + slices), dots, hubLayer (static), pointer (static)
  wheelContainer.addChild(base, rim, wheel, dots, hubLayer, pointer);
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
    logoSprite.texture=PIXI.Texture.EMPTY; 
    if(active.assets.logo){ 
      logoSprite.texture=PIXI.Texture.from(active.assets.logo); 
    } 
    logoSprite.anchor.set?.(0.5,0.5); 
    const sc=0.4; // Slightly larger scale for better visibility
    logoSprite.scale.set(sc, sc); 
    // Position logo with more space above the wheel
    logoSprite.x = wheelContainer.x; // Center horizontally with wheel
    logoSprite.y = wheelContainer.y - WHEEL_RADIUS - 140; // More space above the wheel
  }

  function drawWheel(resetRotation=false){
    WHEEL_RADIUS = CONFIG.BASE_RADIUS * sizeMultiplier * autoMultiplier;
    if(resetRotation) wheel.rotation = 0;

    // clear
    base.clear(); rim.clear(); wheel.removeChildren(); labels.length = 0;
    dots.clear(); hub.clear(); pointer.clear(); hubLayer.removeChildren();
    
    // Update logo position when wheel is redrawn
    drawLogo();

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
  // Modal close handlers
  document.querySelectorAll('.modal-close').forEach(btn=> btn.addEventListener('click', (e)=> closeModal(e.target.getAttribute('data-close'))));

   function spin(){
     if(spinning) return;
     if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
     
     // Check for guaranteed prize first
     let chosen;
     if (active.settings && active.settings.guaranteedPrize) {
       // Use guaranteed prize
       chosen = SLICES.find(slice => slice.id === active.settings.guaranteedPrize);
       if (!chosen) {
         // Fallback to random if guaranteed prize not found
         chosen = pickWeighted(SLICES);
       }
     } else {
       // Use weighted selection - prize weights are ALWAYS respected
       chosen = pickWeighted(SLICES);
     }
     
     const idx = SLICES.indexOf(chosen);
     const targetCenter = centerAngleForIndex(idx);
     const fullSpins = (5 + Math.floor(Math.random()*3)) * TWO_PI; // 5-7 full spins
     rotStart = wheel.rotation % TWO_PI;
     rotEnd   = targetCenter + fullSpins;
     duration = 4.25 + Math.random()*0.9;
     t = 0; spinning = true;
     updateSpinButtonState(); // Update button state
     sfxSpin();
     spin._result = chosen;
   }
  async function onSpinComplete(){
    spinning = false; // Reset spinning state
    updateSpinButtonState(); // Update button state
    const res=spin._result;
    addHistory({ ts: Date.now(), template: active.name, prize: res.label });
    
    // Celebration effects
    sfxWin(); 
    spawnConfetti(140);
    
    try{
      const response=await fetch(CONFIG.API_ENDPOINT,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:res.id, prize:res.label, weight:res.weight, ts: Date.now(), template: active.name })
      });
      if(!response.ok) throw new Error('HTTP '+response.status);
      await response.json().catch(()=>({ok:true}));
    }catch(err){ 
      // Silently handle API errors without showing user notification
      console.warn('API error', err); 
    }
    
    // Show congratulations modal for prize announcement
    showCongratsModal(res);
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
    
    // Create congratulations card
    const cardWidth = 400;
    const cardHeight = 300;
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
    
    // Create buttons with optional images
    const buttons = [
      { id: 'btnRewards', text: '🏆 Rewards', action: 'rewards', image: active.assets?.canvasRewardsBtn },
      { id: 'btnInfo', text: 'ℹ️ Info', action: 'info', image: active.assets?.canvasInfoBtn },
      { id: 'btnSound', text: '🔊 Sound', action: 'sound', image: active.assets?.canvasSoundUnmute }
    ];
    
    buttons.forEach((btn, index) => {
      const button = new PIXI.Graphics();
      const x = vw - rightMargin - (buttonWidth + gap) * (buttons.length - index);
      const y = topMargin;
      
      let text;
      if (btn.image) {
        const sprite = new PIXI.Sprite(PIXI.Texture.from(btn.image));
        sprite.width = buttonWidth;
        sprite.height = buttonHeight;
        button.addChild(sprite);
      } else {
        // Draw colored button
        button.beginFill(primaryColor);
        button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
        button.endFill();
        button.lineStyle(1, borderColor);
        button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
        // Text label
        text = new PIXI.Text(btn.text, {
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
      button.cursor = 'pointer';
      
      // Hover effects only for non-image buttons
      if (!btn.image) {
        button.on('pointerover', () => {
          button.clear();
          button.beginFill(hoverColor);
          button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
          button.endFill();
          button.lineStyle(1, borderColor);
          button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
          if (text) button.addChild(text);
        });
        
        button.on('pointerout', () => {
          button.clear();
          button.beginFill(primaryColor);
          button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
          button.endFill();
          button.lineStyle(1, borderColor);
          button.drawRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
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
        spinButton.alpha = 1;
        spinButton.interactive = true;
      }
    }
  }
  
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
      canvasModalBgColor.value = active.colors.canvasModalBg || '#0e1f1a';
      canvasModalBorderColor.value = active.colors.canvasModalBorder || '#204a3e';
      canvasModalTextColor.value = active.colors.canvasModalText || '#e8fff5';
      canvasSpinBtnColor.value = active.colors.canvasSpinBtn || '#24d58b';
      canvasSpinBtnHoverColor.value = active.colors.canvasSpinBtnHover || '#2be68b';
      canvasSpinBtnBorderColor.value = active.colors.canvasSpinBtnBorder || '#0fb168';
    }

    // Guaranteed prize settings
    if (active.settings) {
      guaranteedPrize.value = active.settings.guaranteedPrize || '';
    } else {
      guaranteedPrize.value = '';
    }
    
    // Populate guaranteed prize dropdown
    guaranteedPrize.innerHTML = '<option value="">Random Prize (Normal)</option>' + 
      SLICES.map(slice => `<option value="${slice.id}">${slice.label}</option>`).join('');

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
    const CONFIG = { API_ENDPOINT: '/api/claim', ENABLE_SFX: true, BASE_RADIUS: 400, HUB_RADIUS: 80 };
  const app = new PIXI.Application({ resizeTo: document.getElementById('game'), backgroundAlpha: 0, antialias: true, autoDensity: true, powerPreference: 'high-performance' });
  document.getElementById('game').appendChild(app.view);
  const DESIGN = { w: 900, h: 1400 };
  
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
      const sc=0.4; // Slightly larger scale for better visibility
      logoSprite.scale.set(sc, sc); 
      // Position logo with more space above the wheel
      logoSprite.x = wheelContainer.x; // Center horizontally with wheel
      logoSprite.y = wheelContainer.y - WHEEL_RADIUS - 140; // More space above the wheel
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
