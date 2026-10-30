// Reference presentation layer: telemetry and protection remain authoritative.
document.documentElement.dataset.theme='dark';
document.title='Anuraksana · Motor intelligence';
document.querySelector('.eyebrow').textContent='ANURAKSANA / MOTOR INTELLIGENCE';
workspacePages.overview='Fleet Overview';
workspaceRail.querySelector('[data-page="overview"]').textContent='Fleet Overview';
const referenceIcons={overview:'▦',machines:'⚙︎',twin:'◇',trends:'⌁',alerts:'△',reports:'▤',settings:'☷'};
for(const button of workspaceRail.querySelectorAll('[data-page]')){const icon=document.createElement('span');icon.className='nav-symbol';icon.setAttribute('aria-hidden','true');icon.textContent=referenceIcons[button.dataset.page];button.prepend(icon);}
document.querySelector('.workspace-brand').innerHTML='<span class="brand-mark" aria-hidden="true">ϟ</span><strong>Anuraksana</strong>';
document.querySelector('.workspace-project:not(.mode-note)').hidden=true;
workspaceRail.querySelector(':scope > small').textContent='OPERATIONS';
workspaceRail.querySelector('[data-page="twin"]').insertAdjacentHTML('beforebegin','<small class="nav-section">DIGITAL TWIN MOTORS</small>');
workspaceRail.querySelector('[data-page="alerts"]').insertAdjacentHTML('beforebegin','<small class="nav-section">DIAGNOSTICS</small>');
workspaceRail.querySelector('[data-page="settings"]').insertAdjacentHTML('beforebegin','<small class="nav-section">SYSTEM</small>');
$('workspaceBell').insertAdjacentHTML('beforebegin','<span id="fleetStatus" class="fleet-status" role="status">● WAITING FOR TELEMETRY</span><time id="referenceClock"></time>');
function referenceClock(){const now=new Date();$('referenceClock').dateTime=now.toISOString();$('referenceClock').textContent=now.toLocaleString(undefined,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Kolkata'});}
referenceClock();setInterval(referenceClock,1000);
workspaceMain.insertAdjacentHTML('beforeend',`<section id="referenceOverview" class="reference-overview"><section class="reference-breakdown"><div class="panel-heading"><h2>Fleet Service Breakdown</h2><span title="Recorded commanded run time, not predicted motor health">ⓘ</span></div><div class="breakdown-total"><small>Average service allowance remaining</small><div><strong id="referenceAverage">—</strong><span id="referenceAverageUnit"> / 100%</span></div><small>Based on the configured run-time budget</small></div><div id="referenceMotors"></div><p class="breakdown-note">Service allowance · Not a failure-life prediction</p></section><section class="reference-trend"><div class="panel-heading"><h2>Temperature Trend</h2><span class="live-dot" aria-hidden="true"></span></div><p class="trend-caption">Both motors — °C <span>Live session</span></p><div class="reference-legend"><span>━ Motor 1</span><span>━ Motor 2</span></div><div class="reference-chart"><canvas id="referenceTemperature" role="img" aria-label="Live temperature history for both motors"></canvas></div><p class="trend-footnote">Dashed lines mark warning and critical limits.</p></section></section>`);
$('referenceMotors').append($('fleetPicker'));
$('fleetKPIs').before(document.querySelector('.toolbar'));
const connectionControls=document.querySelector('.toolbar > div');connectionControls.hidden=false;
$('address').placeholder='ESP32 IP address';
$('connect').textContent=window.DEMO?'Open hardware dashboard':'Open device';
$('fleetPicker').querySelector('h3').hidden=true;
for(const n of [1,2]){$('pickMotor'+n).insertAdjacentHTML('beforeend',`<div class="reference-motor-meta"><span id="referenceState${n}">Waiting for telemetry</span><span>Open digital twin ↗</span></div><div class="reference-bar"><span id="referenceBar${n}"></span></div>`);}
const referenceShow=showWorkspace;
showWorkspace=function(page){referenceShow(page);workspaceMain.dataset.page=workspacePage;$('referenceOverview').hidden=workspacePage!=='overview';if(workspacePage==='overview'){$('trends').hidden=true;lifeSection.hidden=true;protectionSection.hidden=true;$('fleetPicker').hidden=false;}else if(['machines','twin','reports'].includes(workspacePage)){commonHeader.after($('fleetPicker'));}if(workspacePage==='overview')$('referenceMotors').append($('fleetPicker'));document.querySelector('.toolbar').hidden=workspacePage!=='overview'&&workspacePage!=='settings';requestAnimationFrame(()=>{drawReferenceTrend();});};
tempSeries[0].color='#e8e9e8';tempSeries[1].color='#8d5aff';
$('trends').querySelector('.chart-legend').innerHTML='<span style="color:#e8e9e8">━ Motor 1</span> · <span style="color:#8d5aff">━ Motor 2</span> · Temperature °C · Dashed: warning / critical';
const readingGuide=$('rangeInfo').parentElement.querySelector('p');if(readingGuide&&readingGuide.textContent.includes('How to read'))readingGuide.textContent='White = Motor 1 · Violet = Motor 2. Dashed lines mark warning and critical limits. Gaps indicate unavailable readings.';
function drawReferenceTrend(){if(!$('referenceOverview').hidden)chart($('referenceTemperature'),selectedRows(),tempSeries,'°C',tempLimits());}
const referenceDraw=drawTrends;drawTrends=function(){referenceDraw();drawReferenceTrend();};
const referenceRender=render;render=function(){referenceRender();const remaining=[];for(const n of [1,2]){const runtime=data?.['runtime'+n+'_hours'],budget=data?.service_budget_hours,valid=online&&Number.isFinite(runtime)&&Number.isFinite(budget)&&budget>0;const percent=valid?Math.max(0,Math.min(100,(1-runtime/budget)*100)):null;if(valid)remaining.push(percent);$('referenceBar'+n).style.width=(percent??0)+'%';const strong=$('pickMotor'+n).querySelector('strong');strong.textContent=valid?Math.round(percent)+'%':'—';$('pickMotor'+n).querySelector('small').textContent='Motor 0'+n;$('referenceState'+n).textContent=online?(window.DEMO?'Simulated · ':'Live · ')+motorState(data,n)[0].toLowerCase():'Telemetry unavailable';} $('referenceAverage').textContent=remaining.length===2?Math.round((remaining[0]+remaining[1])/2):'—';const fault=online&&(data.critical||!data.t1OK||!data.t2OK||!data.mpuOK),warning=online&&[1,2].some(n=>motorState(data,n)[0]==='WARNING');const status=$('fleetStatus');status.dataset.state=!online?'offline':fault?'critical':warning?'warning':'normal';status.textContent=!online?'● FLEET STATUS: OFFLINE':fault?'● FLEET STATUS: ATTENTION':warning?'● FLEET STATUS: WARNING':'● FLEET STATUS: OPTIMAL';};
const referenceObserver=new ResizeObserver(()=>drawReferenceTrend());referenceObserver.observe($('referenceTemperature').parentElement);
showWorkspace(workspacePage);render();drawTrends();
