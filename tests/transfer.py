from pathlib import Path
import tempfile,subprocess
s=Path('web/firmware.template.txt').read_text();body=s[s.index('bool writeAll('):s.index('void serveAsset(')]
pre='''#include <vector>
#include <cstdint>
#include <algorithm>
#include <cassert>
#include <iostream>
unsigned long tick=0,calls=0;unsigned long millis(){return tick;}void delay(int n){tick+=n;}void serviceSensors(){calls++;}
struct NetworkClient {bool alive=true,stall=false;size_t cap=7;std::vector<uint8_t> result;bool connected(){return alive;}size_t write(const uint8_t *p,size_t n){if(stall)return 0;size_t count=std::min(cap,n);result.insert(result.end(),p,p+count);return count;}};
'''
main='''int main(){std::vector<uint8_t> payload(150000);for(size_t i=0;i<payload.size();i++)payload[i]=i%251;NetworkClient client;assert(writeAll(client,payload.data(),payload.size()));assert(client.result==payload);assert(calls>1000);NetworkClient stalled;stalled.stall=true;auto start=tick;assert(!writeAll(stalled,payload.data(),payload.size()));assert(tick-start<=5002);NetworkClient closed;closed.alive=false;assert(!writeAll(closed,payload.data(),payload.size()));std::cout<<"PASS: exact payload after partial writes, cooperative sensor service, bounded stall, disconnected client\\n";}'''
with tempfile.TemporaryDirectory() as d:
 p=Path(d);(p/'transfer.cpp').write_text(pre+body+main);subprocess.run(['g++','-std=c++17',str(p/'transfer.cpp'),'-o',str(p/'run')],check=True);subprocess.run([str(p/'run')],check=True)
