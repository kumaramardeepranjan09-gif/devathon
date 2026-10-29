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
hardware=p.replace('<!-- TRANSPORT -->','')
demo=p.replace('<!-- TRANSPORT -->','<script>\n'+(root/'web/demo.js').read_text()+'\n</script>')
demo=demo.replace('SMARTPREDICT / LIVE STATION','SMARTPREDICT / DEMO STUDIO').replace('Independent temperatures · Shared motion · Local protection','SIMULATED READINGS · No ESP32 required · No hardware commands')
demo=demo.replace('<div class="toolbar"><div><label for="address">', '<div class="toolbar"><div hidden><label for="address">')
demo=demo.replace('<div id="message"', '<section class="card"><b>Demo scenarios</b><p>All readings below are simulated. Use scenarios to explore warnings, shutdown and reports.</p><div class="controls">'+''.join(f'<button onclick="scenario(\'{k}\')">{v}</button>' for k,v in [('healthy','Healthy / recover'),('warm1','Motor 1 warning'),('hot2','Motor 2 critical'),('motion','Shared movement'),('sensor','Sensor fault'),('offline','Disconnect')])+'</div></section><div id="message"')
(root/'demo.html').write_text(demo)
(root/'web/hardware.html').write_text(hardware)
s=(root/'web/firmware.template.txt').read_text();compressed=bytearray(gzip.compress(hardware.encode(),mtime=0));compressed[9]=255
array='const uint8_t PAGE_GZ[] PROGMEM = {\n'+ '\n'.join(','.join(str(b) for b in compressed[i:i+24])+',' for i in range(0,len(compressed),24))+'\n};'
s=s.replace('/* EMBEDDED_DASHBOARD */',array)
s=s.replace('server.send_P(200, "text/html", PAGE);','server.sendHeader("Content-Encoding", "gzip");\n    server.send_P(200, "text/html; charset=utf-8", (const char*)PAGE_GZ, sizeof(PAGE_GZ));')
(root/'SmartPredict_ESP32/SmartPredict_ESP32.ino').write_text(s)
print(f'Built demo.html and single-file firmware; embedded page gzip = {len(compressed)} bytes')
