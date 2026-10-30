from pathlib import Path
import gzip,re
root=Path(__file__).resolve().parents[1]
p=(root/'web/dashboard.template.html').read_text()
p=p.replace('<title>SmartPredict • Twin motor station</title>','<title>SmartPredict • Twin motor station</title>')
p=p.replace('.scene{height:210px;', '.scene{height:300px;')
p=p.replace('<div class="scene"><div class="assembly">','<div class="scene" id="view${n}"><div class="assembly">')
p=p.replace('<div class="metrics">','<div class="controls"><button data-cutaway="${n}">Cutaway view</button><button data-view="${n}">Reset camera</button><small>Drag to rotate · Scroll to zoom</small></div><div class="metrics">')
p=p.replace('function motorState(d,n)', '''const views=[1,2].map(n=>new MotorView($('view'+n),n));
document.querySelectorAll('[data-cutaway]').forEach(b=>b.onclick=()=>{const v=views[Number(b.dataset.cutaway)-1];v.toggle();b.textContent=v.cutaway?'Show housing':'Cutaway view';});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{const v=views[Number(b.dataset.view)-1];v.angle=.8;v.elevation=.45;v.distance=7;});
function motorState(d,n)''')
a=p.index("let r=$('rotor'+n)");b=p.index('draw(n);',a)
p=p[:a]+"views[n-1].set(data,online);"+p[b:]
p=p.replace("online?'LIVE • ESP32':'OFFLINE'", "online?(window.DEMO?'DEMO • SIMULATED':'LIVE • ESP32'):'OFFLINE'")
p=p.replace("add('p','Generated '","add('p',window.DEMO?'SIMULATED DEMO — no hardware measurements':'HARDWARE TELEMETRY');add('p','Generated '")
p=p.replace("let keys=['time'", "let keys=['mode','time'")
p=p.replace("history.push({...d,time:", "history.push({...d,mode:window.DEMO?'DEMO':'HARDWARE',time:")
p=p.replace("$('address').value=location.host;", "$('address').value=location.host;")
libs='<script>\n'+(root/'web/vendor/three.min.js').read_text()+'\n</script><script>\n'+(root/'web/motor-view.js').read_text()+'\n</script>'
p=p.replace('<script>\n\'use strict\';',libs+'\n<!-- TRANSPORT -->\n<script>\n\'use strict\';')
p=p.replace('</html>', '<script>\n'+(root/'web/dashboard-upgrade.js').read_text()+'\n'+(root/'web/monitoring.js').read_text()+'\n'+(root/'web/design.js').read_text()+'\n'+(root/'web/scada.js').read_text()+'\n'+(root/'web/workspace.js').read_text()+'\n'+(root/'web/reference.js').read_text()+'\n'+(root/'web/trends.js').read_text()+"\nconst scadaStyle=document.createElement('style');scadaStyle.textContent="+repr((root/'web/styles.css').read_text())+";document.head.append(scadaStyle);"+'\n</script></html>')
three_source=(root/'web/vendor/three.min.js').read_text()
parts=[three_source[i:i+8192] for i in range(0,len(three_source),8192)]
hash_value=2166136261
for byte in three_source.encode(): hash_value=((hash_value^byte)*16777619)&0xffffffff
loader=(root/'web/asset-loader.js').read_text().replace('__PARTS__',str(len(parts))).replace('__HASH__',str(hash_value))
hardware=p.replace('<!-- TRANSPORT -->','').replace('<script>\n'+three_source+'\n</script>', '<script>\n'+loader+'\n</script>')
demo=p.replace('<!-- TRANSPORT -->','<script>\n'+(root/'web/demo.js').read_text()+'\n</script>')
demo=demo.replace('SMARTPREDICT / LIVE STATION','SMARTPREDICT / DEMO STUDIO').replace('Independent temperatures · Shared motion · Local protection','SIMULATED READINGS · No ESP32 required · No hardware commands')
demo=demo.replace('<div class="toolbar"><div><label for="address">', '<div class="toolbar"><div hidden><label for="address">')
demo=demo.replace('<div id="message"', '<section class="card"><b>Demo scenarios</b><p>All readings below are simulated. Use scenarios to explore warnings, shutdown and reports.</p><div class="controls">'+''.join(f'<button onclick="scenario(\'{k}\')">{v}</button>' for k,v in [('healthy','Healthy / recover'),('warm1','Motor 1 warning'),('hot2','Motor 2 critical'),('motion','Shared movement'),('sensor','Sensor fault'),('offline','Disconnect')])+'</div></section><div id="message"')
(root/'demo.html').write_text(demo)
(root/'web/hardware.html').write_text(hardware)
s=(root/'web/firmware.template.txt').read_text()
def embed(name, content):
    compressed=bytearray(gzip.compress(content.encode(),mtime=0));compressed[9]=255
    return 'const uint8_t '+name+'[] PROGMEM = {\n'+'\n'.join(','.join(str(b) for b in compressed[i:i+24])+',' for i in range(0,len(compressed),24))+'\n};',len(compressed)
page_array,page_size=embed('PAGE_GZ',hardware)
arrays=[];sizes=[]
for i,part in enumerate(parts):
    array,size=embed('THREE_PART_'+str(i),part);arrays.append(array);sizes.append(size)
index='const int THREE_PART_COUNT='+str(len(parts))+';\nconst uint8_t* const THREE_PARTS[]={'+','.join('THREE_PART_'+str(i) for i in range(len(parts)))+'};\nconst size_t THREE_PART_SIZES[]={'+','.join(map(str,sizes))+'};'
s=s.replace('/* EMBEDDED_DASHBOARD */',page_array+'\n'+'\n'.join(arrays)+'\n'+index)
three_size=sum(sizes)
(root/'SmartPredict_ESP32/SmartPredict_ESP32.ino').write_text(s)
print(f'Built single-file firmware: HTML {page_size} bytes; cacheable Three.js {three_size} bytes')
