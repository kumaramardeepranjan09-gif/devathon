// Shared, offline chart presentation for overview, trends and exported reports.
tempSeries[0].color='#5ed6c2';tempSeries[1].color='#b29aff';
const trendSwatches='<span><i style="--series:#5ed6c2"></i>Motor 1</span><span><i style="--series:#b29aff"></i>Motor 2</span>';
$('trends').querySelector('h2').textContent='Sensor history';
for(const p of $('trends').querySelectorAll('p'))if(p.textContent.includes('Dashed lines'))p.textContent='Teal = Motor 1. Violet = Motor 2. Dashed lines mark warning and critical limits. Gaps mean readings are unavailable.';
$('trends').querySelector('.chart-legend').innerHTML=trendSwatches;
document.querySelector('.reference-legend').innerHTML=trendSwatches;
$('trends').querySelector('.row').insertAdjacentHTML('afterend','<p class="trend-intro">Compare both motors over time. Dashed lines show protection limits; gaps mean unavailable readings.</p><div id="trendReadings" class="trend-readings" aria-label="Latest sensor readings"></div>');
const graphNames={temperatureTrend:['Motor temperatures','Independent DS18B20 sensors'],motionTrend:['Shared acceleration deviation','One IMU on the common mounting surface'],rotationTrend:['Shared tilt angle','Relative to the calibrated boot position']};
for(const [id,[title,description]]of Object.entries(graphNames)){
 const canvas=$(id),wrap=canvas.parentElement;wrap.classList.add('sensor-plot');
 wrap.insertAdjacentHTML('beforebegin',`<div class="plot-heading"><h3>${title}</h3><p>${description}</p></div>`);
 canvas.tabIndex=0;canvas.style.width='100%';canvas.style.height=id==='temperatureTrend'?'300px':'240px';
 if(id!=='temperatureTrend')wrap.previousElementSibling.previousElementSibling.hidden=true;
}
$('referenceTemperature').tabIndex=0;
if(!$('referenceTemperature').nextElementSibling)$('referenceTemperature').insertAdjacentHTML('afterend','<div class="chart-tip" hidden></div>');
document.querySelector('.reference-chart').classList.add('chart-wrap');
document.querySelector('.trend-footnote').textContent='Hover, touch, or focus the graph and use arrow keys to inspect readings.';

chart=function(canvas,rows,series,unit,limits=[],light=false){
 light=light||document.documentElement.dataset.theme==='light';
 const rect=canvas.getBoundingClientRect(),w=Math.max(260,rect.width||600),h=light?180:Math.max(220,rect.height||260),dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
 const ink=light?'#435165':'#a9bbb5',grid=light?'#e3e8eb':'#293b35',left=50,right=w-18,top=38,bottom=h-36;
 const good=(r,s)=>r[s.ok]&&Number.isFinite(r[s.key])&&!r.disconnected;
 const values=rows.flatMap(r=>series.filter(s=>good(r,s)).map(s=>r[s.key]));
 const all=values.concat(limits.map(l=>l.value).filter(Number.isFinite));
 let lo=all.length?Math.min(...all):0,hi=all.length?Math.max(...all):1;
 const pad=Math.max((hi-lo)*.18,unit==='°C'?2:unit==='°'?3:.025);
 lo=unit==='°C'?lo-pad:Math.max(0,lo-pad);hi+=pad;
 const rough=(hi-lo)/4,magnitude=10**Math.floor(Math.log10(rough));
 const step=[1,2,2.5,5,10].map(n=>n*magnitude).find(n=>n>=rough)||10*magnitude;
 lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
 const first=rows.length?Date.parse(rows[0].time):Date.now(),last=rows.length?Date.parse(rows.at(-1).time):first+1000,span=Math.max(1000,last-first);
 const x=r=>left+(Date.parse(r.time)-first)/span*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
 c.font='11px Arial, sans-serif';c.fillStyle=ink;c.fillText(unit,left,16);
 const decimals=step<1?Math.min(3,Math.ceil(-Math.log10(step))+1):step%1?1:0;
 for(let i=0;i<=Math.round((hi-lo)/step);i++){
  const v=lo+i*step,Y=y(v);c.strokeStyle=grid;c.lineWidth=1;c.beginPath();c.moveTo(left,Y);c.lineTo(right,Y);c.stroke();
  c.fillStyle=ink;c.textAlign='right';c.fillText(v.toFixed(decimals),left-9,Y+4);
 }
 c.textAlign='left';
 for(let i=0;i<limits.length;i++){
  const l={...limits[i],color:light?(i===0?'#96630c':'#b44237'):(i===0?'#f5bf68':'#ff948c')};if(!Number.isFinite(l.value))continue;
  const Y=y(l.value);c.strokeStyle=l.color;c.lineWidth=1;c.setLineDash([5,5]);c.beginPath();c.moveTo(left,Y);c.lineTo(right,Y);c.stroke();c.setLineDash([]);
  const label=(l.label||(i===0?'Warning':'Critical'))+' '+l.value+unit;
  const tw=c.measureText(label).width;
  // Labels are separated above the plot, including when thresholds are close.
  const labelX=i===0?left:right-tw;c.fillStyle=light?'#34445a':l.color;c.fillText(label,labelX,29);
 }
 c.save();c.beginPath();c.rect(left-4,top-4,right-left+8,bottom-top+8);c.clip();
 for(const s of series){
  c.strokeStyle=s.color;c.fillStyle=s.color;c.lineWidth=2.5;c.lineJoin='round';c.lineCap='round';c.beginPath();
  let pen=false,previous=null,lastGood=null;
  for(const r of rows){
   if(!good(r,s)){pen=false;previous=null;continue;}
   const time=Date.parse(r.time);if(previous!==null&&time-previous>5000)pen=false;
   if(pen)c.lineTo(x(r),y(r[s.key]));else c.moveTo(x(r),y(r[s.key]));
   pen=true;previous=time;lastGood=r;
  }
  c.stroke();
  if(lastGood){c.beginPath();c.arc(x(lastGood),y(lastGood[s.key]),3.5,0,Math.PI*2);c.fill();}
 }
 c.restore();c.fillStyle=ink;
 if(!values.length){c.textAlign='center';c.fillText(rows.length?'No valid sensor readings in this range':'Waiting for sensor readings', (left+right)/2,(top+bottom)/2);c.textAlign='left';}
 const ticks=w<420?2:4;
 for(let i=0;i<ticks;i++){
  const f=i/(ticks-1),time=first+f*(last-first),X=left+f*(right-left);
  c.textAlign=i===0?'left':i===ticks-1?'right':'center';c.fillText(new Date(time).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'}),X,h-12);
 }
 canvas._trend={rows,series,unit,left,right,first,last,lo,hi,validCount:values.length};
 canvas.setAttribute('aria-label',series.map(s=>s.label).join(' and ')+' history in '+unit+'. '+values.length+' valid readings. Use left and right arrow keys to inspect samples.');
};
function showTrendSample(canvas,index){
 const t=canvas._trend,tip=canvas.nextElementSibling;if(!t?.rows.length||!tip)return;
 index=Math.max(0,Math.min(t.rows.length-1,index));canvas._sampleIndex=index;const r=t.rows[index];
 tip.textContent=new Date(r.time).toLocaleString()+'\n'+t.series.map(s=>s.label+': '+(r[s.ok]&&Number.isFinite(r[s.key])&&!r.disconnected?r[s.key].toFixed(2)+' '+t.unit:'Unavailable')).join('\n');tip.hidden=false;
}
for(const id of ['temperatureTrend','motionTrend','rotationTrend','referenceTemperature']){
 const canvas=$(id);
 canvas.onpointermove=e=>{const t=canvas._trend;if(!t?.rows.length)return;const rect=canvas.getBoundingClientRect(),f=Math.max(0,Math.min(1,(e.clientX-rect.left-t.left)/(t.right-t.left))),time=t.first+f*(t.last-t.first);let closest=0;for(let i=1;i<t.rows.length;i++)if(Math.abs(Date.parse(t.rows[i].time)-time)<Math.abs(Date.parse(t.rows[closest].time)-time))closest=i;showTrendSample(canvas,closest);};
 canvas.onpointerleave=()=>{if(document.activeElement!==canvas)canvas.nextElementSibling.hidden=true;};
 canvas.onfocus=()=>showTrendSample(canvas,(canvas._trend?.rows.length||1)-1);
 canvas.onblur=()=>canvas.nextElementSibling.hidden=true;
 canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End','Escape'].includes(e.key)){e.preventDefault();const count=canvas._trend?.rows.length||0;if(e.key==='Escape'){canvas.nextElementSibling.hidden=true;return;}showTrendSample(canvas,e.key==='Home'?0:e.key==='End'?count-1:(canvas._sampleIndex??count-1)+(e.key==='ArrowLeft'?-1:1));}};
}
const polishedDraw=drawTrends;drawTrends=function(){
 polishedDraw();const reading=$('trendReadings');
 reading.replaceChildren(...[1,2].map(n=>{const box=document.createElement('div');box.className='trend-reading motor-'+n;const label=document.createElement('span'),value=document.createElement('strong'),note=document.createElement('small');label.textContent='Motor '+n;value.textContent=online&&data?.['t'+n+'OK']?data['t'+n].toFixed(1)+' °C':'Unavailable';const st=stats(selectedRows(),n);note.textContent=st?'Range '+st.min.toFixed(1)+'–'+st.max.toFixed(1)+' °C':'No valid samples in range';box.append(label,value,note);return box;}));
 const state=document.createElement('div');state.className='trend-reading';const label=document.createElement('span'),value=document.createElement('strong'),note=document.createElement('small');label.textContent='Data source';value.textContent=online?(window.DEMO?'Simulated':'Live ESP32'):'Offline';note.textContent=online?'Latest readings above; history below':'Showing retained history only';state.append(label,value,note);reading.append(state);
};
$('range').addEventListener('change',()=>{for(const id of ['temperatureTrend','motionTrend','rotationTrend','referenceTemperature'])$(id).nextElementSibling.hidden=true;drawTrends();});
new ResizeObserver(()=>drawReferenceTrend()).observe(document.querySelector('.reference-chart'));
drawTrends();
