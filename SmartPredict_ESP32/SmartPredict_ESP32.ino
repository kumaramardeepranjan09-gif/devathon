
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// =============== WIFI SETTINGS ===============
const char* WIFI_NAME = "SmartPredict";
const char* WIFI_PASSWORD = "ChangeMe2026"; // CHANGE before upload (8+ characters)

WebServer server(80);

// =============== FIXED GPIO PINS ==============
// DS18B20
#define TEMP1_PIN 16
#define TEMP2_PIN 17

// MPU6050
#define MPU_SDA 21
#define MPU_SCL 22
#define MPU_ADDR 0x68

// Relay
#define RELAY1_PIN 32
#define RELAY2_PIN 33

// L298N motor driver
#define ENA 25
#define IN1 26
#define IN2 27
#define ENB 14
#define IN3 18
#define IN4 19

// Active buzzer
#define BUZZER_PIN 23

const bool RELAY_ACTIVE_LOW = true;

// =============== EDIT THRESHOLDS HERE ==================
const float TEMP_WARNING_C = 32.0;
const float TEMP_CRITICAL_C = 36.0;
const float TEMP_RESET_C = 31.0; // reset only below warning, with healthy sensors
// Movement limits below: VIB_WARNING / VIB_CRITICAL (g), ROT_WARNING / ROT_CRITICAL (deg/s).
// Initial commissioning values, NOT calibrated for your motor/mount.
unsigned long sampleSequence = 0;
unsigned long lastGoodTemp = 0;

// =============== TEMPERATURE ==================
OneWire ow1(TEMP1_PIN);
OneWire ow2(TEMP2_PIN);
DallasTemperature ds1(&ow1);
DallasTemperature ds2(&ow2);

float t1 = NAN, t2 = NAN;
bool t1OK = false, t2OK = false;

bool tempPending = false;
unsigned long tempStarted = 0;
unsigned long lastTempRequest = 0;

// =============== MPU6050 ======================
bool mpuOK = false;
float ax = 0, ay = 0, az = 0;
float gx = 0, gy = 0, gz = 0;
float mpuTemp = 0;
float vibration = 0;
float rotation = 0;

unsigned long lastMPU = 0;
int criticalMotionSamples = 0;
int warningMotionSamples = 0;

// Initial demonstration thresholds; calibrate for your machine.
const float VIB_WARNING = 0.25;
const float VIB_CRITICAL = 0.70;
const float ROT_WARNING = 30.0;
const float ROT_CRITICAL = 90.0;

// =============== SYSTEM STATE ==================
bool relay1State = false;
bool relay2State = false;

String motor1State = "STOP";
String motor2State = "STOP";

int speed1 = 150;
int speed2 = 150;

bool criticalLock = false;
String criticalReason = "";
String statusText = "STARTING";
String warningText = "Starting sensors";

String lastEvent = "System started";
unsigned long eventCount = 0;

// =============== EVENT LOG =====================
void logEvent(String message) {
  lastEvent = String(millis() / 1000) + "s: " + message;
  eventCount++;
  Serial.println(lastEvent);
}

// =============== RELAYS ========================
void setRelay(int pin, bool on) {
  digitalWrite(pin, RELAY_ACTIVE_LOW
                    ? (on ? LOW : HIGH)
                    : (on ? HIGH : LOW));
}

void relay1(bool on) {
  relay1State = on;
  setRelay(RELAY1_PIN, on);
}

void relay2(bool on) {
  relay2State = on;
  setRelay(RELAY2_PIN, on);
}

// =============== MOTORS ========================
void stopM1() {
  analogWrite(ENA, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  motor1State = "STOP";
}

void stopM2() {
  analogWrite(ENB, 0);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
  motor2State = "STOP";
}

void stopAll() {
  stopM1();
  stopM2();
}

void m1Forward() {
  if (motor1State == "REVERSE") { stopM1(); delay(300); }
  relay1(true);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, speed1);
  motor1State = "FORWARD";
}

void m1Reverse() {
  if (motor1State == "FORWARD") { stopM1(); delay(300); }
  relay1(true);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  analogWrite(ENA, speed1);
  motor1State = "REVERSE";
}

void m2Forward() {
  if (motor2State == "REVERSE") { stopM2(); delay(300); }
  relay2(true);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENB, speed2);
  motor2State = "FORWARD";
}

void m2Reverse() {
  if (motor2State == "FORWARD") { stopM2(); delay(300); }
  relay2(true);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENB, speed2);
  motor2State = "REVERSE";
}

// =============== MPU6050 REGISTERS =============
bool readReg(byte reg, byte &value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);

  if (Wire.endTransmission(false) != 0) return false;

  if (Wire.requestFrom((uint8_t)MPU_ADDR,
                       (uint8_t)1,
                       (uint8_t)true) != 1) return false;

  value = Wire.read();
  return true;
}

bool readWord(byte reg, int16_t &value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);

  if (Wire.endTransmission(false) != 0) return false;

  if (Wire.requestFrom((uint8_t)MPU_ADDR,
                       (uint8_t)2,
                       (uint8_t)true) != 2) return false;

  uint8_t hi = Wire.read();
  uint8_t lo = Wire.read();

  value = (int16_t)(((uint16_t)hi << 8) | lo);
  return true;
}

void initMPU() {
  byte who;

  if (!readReg(0x75, who)) {
    mpuOK = false;
    Serial.println("MPU6050 not detected");
    return;
  }

  Serial.printf("MPU WHO_AM_I: 0x%02X\n", who);

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) {
    mpuOK = false;
    return;
  }

  delay(100);

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);
  Wire.write(0x00);  // +/- 2g
  if (Wire.endTransmission() != 0) { mpuOK=false; return; }

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1B);
  Wire.write(0x00);  // +/- 250 degrees/s
  if (Wire.endTransmission() != 0) { mpuOK=false; return; }

  mpuOK = (who == 0x68);
}

void readMPU() {
  if (!mpuOK) { initMPU(); if (!mpuOK) return; }
  int16_t rax, ray, raz, rt, rgx, rgy, rgz;

  // One burst keeps all axes from the same register snapshot.
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14, (uint8_t)true) != 14) {
    mpuOK=false; return;
  }
  int16_t words[7];
  for (int i=0;i<7;i++) { uint8_t hi=Wire.read(),lo=Wire.read(); words[i]=(int16_t)(((uint16_t)hi<<8)|lo); }
  rax=words[0]; ray=words[1]; raz=words[2]; rt=words[3]; rgx=words[4]; rgy=words[5]; rgz=words[6];

  mpuOK = true;

  ax = rax / 16384.0;
  ay = ray / 16384.0;
  az = raz / 16384.0;

  gx = rgx / 131.0;
  gy = rgy / 131.0;
  gz = rgz / 131.0;

  mpuTemp = rt / 340.0 + 36.53;

  float totalG = sqrtf(ax * ax + ay * ay + az * az);
  vibration = fabsf(totalG - 1.0);
  rotation = sqrtf(gx * gx + gy * gy + gz * gz);
}

// =============== TEMPERATURE UPDATES ===========
void updateTemperatures() {
  unsigned long now = millis();

  if (!tempPending && now - lastTempRequest >= 2500) {
    ds1.requestTemperatures();
    ds2.requestTemperatures();

    tempStarted = now;
    lastTempRequest = now;
    tempPending = true;
  }

  if (tempPending && now - tempStarted >= 800) {
    t1 = ds1.getTempCByIndex(0);
    t2 = ds2.getTempCByIndex(0);

    t1OK = t1 != DEVICE_DISCONNECTED_C &&
           isfinite(t1) && t1 >= -55 && t1 <= 125 && t1 != 85.0;

    t2OK = t2 != DEVICE_DISCONNECTED_C &&
           isfinite(t2) && t2 >= -55 && t2 <= 125 && t2 != 85.0;

    tempPending = false;
    lastGoodTemp = now;
  }
}

// =============== SAFETY ========================
void criticalShutdown(String reason) {
  if (!criticalLock) {
    criticalLock = true;
    criticalReason = reason;
    logEvent("CRITICAL: " + reason);
  }

  stopAll();
  relay1(false);
  relay2(false);
  digitalWrite(BUZZER_PIN, HIGH);
}

void evaluateSafety() {
  if (millis() > 5000 && (!t1OK || !t2OK || !mpuOK || millis()-lastGoodTemp > 5000)) {
    criticalShutdown(!mpuOK ? "Shared MPU sensor fault: both motors" : !t1OK ? "Motor 1 temperature sensor fault" : !t2OK ? "Motor 2 temperature sensor fault" : "Temperature samples stale");
  }
  bool tempCritical =
    (t1OK && t1 >= TEMP_CRITICAL_C) ||
    (t2OK && t2 >= TEMP_CRITICAL_C);

  bool tempWarning =
    (t1OK && t1 >= TEMP_WARNING_C) ||
    (t2OK && t2 >= TEMP_WARNING_C);

  bool motionWarning =
    vibration >= VIB_WARNING ||
    rotation >= ROT_WARNING;

  bool motionCritical =
    vibration >= VIB_CRITICAL ||
    rotation >= ROT_CRITICAL;

  if (motionWarning) { if (warningMotionSamples < 3) warningMotionSamples++; }
  else warningMotionSamples = 0;

  if (motionCritical) { if (criticalMotionSamples < 4) criticalMotionSamples++; }
  else criticalMotionSamples = 0;

  if (tempCritical) {
    criticalShutdown(t1OK && t1 >= TEMP_CRITICAL_C ? "Motor 1 temperature critical" : "Motor 2 temperature critical");
  } else if (criticalMotionSamples >= 4) {
    criticalShutdown("Excessive movement/vibration");
  }

  if (criticalLock) {
    statusText = "CRITICAL";
    warningText = criticalReason;
  } else if (tempWarning || warningMotionSamples >= 3) {
    statusText = "WARNING";
    warningText = tempWarning
      ? (t1OK && t1 >= TEMP_WARNING_C ? "Motor 1 temperature warning" : "Motor 2 temperature warning")
      : "High movement/vibration";
  } else if (!t1OK || !t2OK || !mpuOK) {
    statusText = "WARNING";
    warningText = "Check sensor connection";
  } else {
    statusText = "NORMAL";
    warningText = "System operating normally";
  }

  if (!criticalLock) digitalWrite(BUZZER_PIN, LOW);
}

// =============== WEB COMMANDS ==================
void handleCommand() {
  if (!server.hasArg("c")) {
    server.send(400, "text/plain", "Missing command");
    return;
  }

  if (server.header("Origin").length() && server.header("Origin") != "http://" + server.hostHeader()) {
    server.send(403,"text/plain","Cross-origin command blocked"); return;
  }
  String c = server.arg("c");
  c.toUpperCase();

  if (criticalLock && c != "RESET" && c != "ALLSTOP" && c != "M1S" && c != "M2S" && c != "R1OFF" && c != "R2OFF") {
    server.send(423, "text/plain",
                "CRITICAL LOCK: resolve fault and reset");
    return;
  }

  bool starts = c == "R1ON" || c == "R2ON" || c == "M1F" || c == "M1R" || c == "M2F" || c == "M2R";
  if (starts && (!t1OK || !t2OK || !mpuOK || t1 >= TEMP_WARNING_C || t2 >= TEMP_WARNING_C || vibration >= VIB_WARNING || rotation >= ROT_WARNING)) {
    server.send(409,"text/plain","Start blocked: sensors must be healthy and below warning limits"); return;
  }
  if (c == "R1ON") relay1(true);
  else if (c == "R1OFF") { stopM1(); relay1(false); }
  else if (c == "R2ON") relay2(true);
  else if (c == "R2OFF") { stopM2(); relay2(false); }
  else if (c == "M1F") m1Forward();
  else if (c == "M1R") m1Reverse();
  else if (c == "M1S") stopM1();
  else if (c == "M2F") m2Forward();
  else if (c == "M2R") m2Reverse();
  else if (c == "M2S") stopM2();
  else if (c == "ALLSTOP") { stopAll(); relay1(false); relay2(false); }
  else if (c == "SPEED1" || c == "SPEED2") {
    if (!server.hasArg("v")) {
      server.send(400, "text/plain", "Missing speed");
      return;
    }

    String raw = server.arg("v");
    for (unsigned int i=0;i<raw.length();i++) if (!isDigit(raw[i])) { server.send(400,"text/plain","Invalid PWM"); return; }
    int v = raw.toInt();
    if (!raw.length() || raw.length()>3 || v<0 || v>255) { server.send(400,"text/plain","PWM must be 0..255"); return; }

    if (c == "SPEED1") {
      speed1 = v;
      if (motor1State == "FORWARD") m1Forward();
      else if (motor1State == "REVERSE") m1Reverse();
    } else {
      speed2 = v;
      if (motor2State == "FORWARD") m2Forward();
      else if (motor2State == "REVERSE") m2Reverse();
    }
  } else if (c == "RESET") {
    bool tempSafe =
      (t1OK && t1 < TEMP_RESET_C) &&
      (t2OK && t2 < TEMP_RESET_C);

    bool motionSafe =
      vibration < VIB_WARNING &&
      rotation < ROT_WARNING;

    if (!tempSafe || !motionSafe || !mpuOK) {
      server.send(409, "text/plain",
                  "Reset blocked: check sensors/conditions");
      return;
    }

    criticalLock = false;
    criticalReason = "";
    criticalMotionSamples = 0;
    warningMotionSamples = 0;
    digitalWrite(BUZZER_PIN, LOW);
    logEvent("Safety reset");
  } else {
    server.send(400, "text/plain", "Unknown command");
    return;
  }

  logEvent("Command: " + c);
  server.send(200, "text/plain", "OK");
}

// =============== LIVE DATA API =================
void handleAPI() {
  String j = "{";
  j += "\"sequence\":" + String(sampleSequence) + ",";
  j += "\"uptime\":" + String(millis()) + ",";
  j += "\"tempWarning\":" + String(TEMP_WARNING_C) + ",";
  j += "\"tempCritical\":" + String(TEMP_CRITICAL_C) + ",";
  j += "\"vibWarning\":" + String(VIB_WARNING) + ",";
  j += "\"vibCritical\":" + String(VIB_CRITICAL) + ",";
  j += "\"rotWarning\":" + String(ROT_WARNING) + ",";
  j += "\"rotCritical\":" + String(ROT_CRITICAL) + ",";

  j += "\"t1\":" + String(t1OK ? t1 : 0.0, 2) + ",";
  j += "\"t2\":" + String(t2OK ? t2 : 0.0, 2) + ",";
  j += "\"t1OK\":" + String(t1OK ? "true" : "false") + ",";
  j += "\"t2OK\":" + String(t2OK ? "true" : "false") + ",";
  j += "\"mpuOK\":" + String(mpuOK ? "true" : "false") + ",";

  j += "\"ax\":" + String(ax, 3) + ",";
  j += "\"ay\":" + String(ay, 3) + ",";
  j += "\"az\":" + String(az, 3) + ",";
  j += "\"gx\":" + String(gx, 2) + ",";
  j += "\"gy\":" + String(gy, 2) + ",";
  j += "\"gz\":" + String(gz, 2) + ",";
  j += "\"mt\":" + String(mpuTemp, 2) + ",";
  j += "\"vib\":" + String(vibration, 3) + ",";
  j += "\"rot\":" + String(rotation, 2) + ",";

  j += "\"status\":\"" + statusText + "\",";
  j += "\"warning\":\"" + warningText + "\",";
  j += "\"critical\":" + String(criticalLock ? "true" : "false") + ",";
  j += "\"reason\":\"" + criticalReason + "\",";
  j += "\"r1\":" + String(relay1State ? "true" : "false") + ",";
  j += "\"r2\":" + String(relay2State ? "true" : "false") + ",";
  j += "\"m1\":\"" + motor1State + "\",";
  j += "\"m2\":\"" + motor2State + "\",";
  j += "\"sp1\":" + String(speed1) + ",";
  j += "\"sp2\":" + String(speed2) + ",";
  j += "\"events\":" + String(eventCount) + ",";
  j += "\"event\":\"" + lastEvent + "\"";
  j += "}";

  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", j);
}

// =============== DASHBOARD =====================
const char PAGE[] PROGMEM = R"HTML(
<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SmartPredict • Twin motor station</title>
<style>
:root{color-scheme:dark;--bg:#080f19;--panel:#111f30;--line:#26384b;--ink:#e9f2fa;--muted:#a0b4c9;--accent:#48e0c2}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top right,#153449,transparent 65%),var(--bg);color:var(--ink);font:15px system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:28px}header,.toolbar,.row{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}h1{font-size:32px;letter-spacing:-1px;margin:10px 0}h2{font-size:20px}p{line-height:1.6}.eyebrow{color:var(--accent);letter-spacing:3px;font-size:11px;font-weight:800}.muted,small{color:var(--muted)}button,input{font:inherit;border:1px solid #38526a;border-radius:9px;padding:11px;background:#183044;color:var(--ink)}button{cursor:pointer}button:hover{border-color:var(--accent)}button:disabled{opacity:.4;cursor:not-allowed}.primary{background:#48e0c2;color:#09221f;font-weight:750}.danger{background:#632c39;border-color:#cb5368}.toolbar{margin:24px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{background:linear-gradient(140deg,#14263a,#101b29);border:1px solid var(--line);border-radius:20px;padding:24px}.badge{font-size:12px;letter-spacing:1px;padding:7px 11px;border-radius:99px;background:#20384a}.NORMAL{color:#48e0c2}.WARNING{color:#ffc46b}.CRITICAL,.FAULT{color:#ff8294}.OFFLINE{color:#a0b4c9}.number{font-size:44px;font-weight:650;letter-spacing:-2px}.metrics{display:grid;grid-template-columns:1fr 1fr;gap:18px}.metric{border-top:1px solid var(--line);padding:14px 0}.controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}input[type=range]{width:100%;accent-color:var(--accent);padding:0}.scene{height:210px;perspective:700px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse,#203f50,transparent 65%);border-radius:12px}.assembly{position:relative;width:210px;height:110px;transform:rotateX(-15deg) rotateY(-24deg);transform-style:preserve-3d}.housing{position:absolute;width:170px;height:100px;border-radius:25px;background:repeating-linear-gradient(90deg,#356272 0 9px,#1e3b4a 10px 15px);box-shadow:0 20px 25px #0008,inset 0 4px 4px #7cadb8}.plate{position:absolute;width:96px;height:96px;border:9px solid #506d7f;border-radius:50%;background:#182c3a;left:125px;top:2px;transform:rotateY(30deg);box-shadow:5px 3px 0 #0a1721}.rotor{position:absolute;inset:12px;border-radius:50%;background:conic-gradient(#48e0c2 0 25%,#1e3345 25% 50%,#48e0c2 50% 75%,#1e3345 75%);border:8px solid #899eaa;animation:spin 1s linear infinite;animation-play-state:paused}.axle{position:absolute;width:65px;height:18px;background:linear-gradient(#e3e9eb,#617788);top:41px;left:174px;border-radius:6px;transform:translateZ(30px)}.foot{position:absolute;width:180px;height:18px;left:-5px;top:107px;border-radius:5px;background:#29485b}.label{position:absolute;top:30px;left:20px;background:#0a1823;padding:9px;border-radius:4px;font-size:10px;letter-spacing:2px}.reason{min-height:42px;color:#cbd8e5;line-height:1.5}canvas{width:100%;height:110px}.lower{margin-top:20px}.log{max-height:220px;overflow:auto;padding-left:20px;line-height:1.8}.shared{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.shared strong{display:block;font-size:24px;margin-top:8px}dialog{background:#fff;color:#162333;border:0;border-radius:14px;width:min(900px,95vw);max-height:90vh}dialog table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #ccd5de;padding:10px}#message{min-height:24px;color:#ffc46b}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:700px){main{padding:16px}.grid{grid-template-columns:1fr}.shared{grid-template-columns:1fr}h1{font-size:27px}.card{padding:18px}}@media print{body{background:white}main{display:none}dialog{position:static;display:block!important;max-height:none;width:100%;color:black}dialog button{display:none}}
</style>
<main><header><div><div class="eyebrow">SMARTPREDICT / LIVE STATION</div><h1>Two motors. One clear view.</h1><p class="muted">Independent temperatures · Shared motion · Local protection</p></div><span class="badge OFFLINE" id="connection">CONNECTING</span></header>
<div class="toolbar"><div><label for="address">ESP32 address </label><input id="address" placeholder="192.168.4.1" size="18"><button id="connect">Open device</button></div><div><button id="report">Fleet report / PDF</button> <button id="csv">Export CSV</button> <button class="danger" id="stop">Stop both motors</button></div></div><div id="message" role="status"></div><div class="grid" id="motors"></div>
<section class="card lower"><div class="row"><h2>Shared motion sensor</h2><span class="badge" id="mpu">WAITING</span></div><p class="muted">One MPU6050 measures the common mounting surface. These readings apply to both motors; they cannot identify which motor caused movement.</p><div class="shared"><div>Acceleration deviation<strong id="vibration">—</strong></div><div>Angular velocity magnitude<strong id="rotation">—</strong></div><div>Acceleration X / Y / Z<strong id="axes">—</strong></div></div><p class="muted" id="limits"></p></section>
<div class="grid lower"><section class="card"><div class="row"><h2>Protection & connection</h2><span id="lock" class="badge">WAITING</span></div><p id="system">Waiting for live telemetry.</p><button id="reset">Reset safety latch</button><p class="muted">Reset requires both temperature sensors below 31°C and movement below warning limits. Reset never starts a motor. Critical or missing sensors stop both motors and activate the buzzer.</p></section><section class="card"><h2>Session events</h2><ol class="log" id="events"></ol><small>Latest 100 events in this browser session. Export reports before closing.</small></section></div><p class="muted">3D shaft animation follows reported PWM, direction and relay command. It is not measured shaft speed. No RPM sensor is installed. Temperature limits: warning ≥32°C, critical ≥36°C (firmware configurable).</p></main>
<dialog id="reportDialog"><button onclick="this.parentElement.close()">Close</button> <button onclick="window.print()">Print / Save PDF</button><article id="reportBody"></article></dialog>
<script>
'use strict';
const $=id=>document.getElementById(id);let data=null,online=false,lastSeq=null,lastChange=0,lastUptime=0,history=[],events=[],previous='',busy=false;
$('address').value=location.host;
for(let n=1;n<=2;n++) $('motors').insertAdjacentHTML('beforeend',`<section class="card"><div class="row"><h2>Motor ${n}</h2><span id="state${n}" class="badge OFFLINE">OFFLINE</span></div><div class="scene"><div class="assembly"><div class="housing"></div><div class="foot"></div><div class="label">MOTOR ${n}</div><div class="plate"><div class="rotor" id="rotor${n}"></div></div><div class="axle"></div></div></div><div class="metrics"><div class="metric"><small>DS18B20 temperature</small><div class="number" id="temp${n}">—</div></div><div class="metric"><small>Reported output</small><h3 id="output${n}">Unavailable</h3><small id="relay${n}">Relay unknown</small></div></div><div class="reason" id="reason${n}">Waiting for telemetry</div><canvas id="chart${n}" width="600" height="110" aria-label="Motor ${n} temperature trend"></canvas><label>PWM command <span id="pwm${n}">—</span> / 255<input type="range" min="0" max="255" value="150" id="speed${n}" disabled></label><div class="controls"><button data-command="M${n}F" class="primary">Forward</button><button data-command="M${n}R">Reverse</button><button data-command="M${n}S">Stop</button><button data-report="${n}">Motor ${n} report</button></div></section>`);
function motorState(d,n){if(!d['t'+n+'OK'])return ['FAULT',`Motor ${n}: temperature sensor unavailable`];if(d['t'+n]>=d.tempCritical)return ['CRITICAL',`Motor ${n}: temperature ≥ ${d.tempCritical}°C`];if(!d.mpuOK)return ['FAULT',`Motor ${n}: shared MPU unavailable`];if(d.vib>=d.vibCritical||d.rot>=d.rotCritical)return ['CRITICAL',`Motor ${n}: excessive shared movement`];if(d.critical)return ['CRITICAL',`Motor ${n}: safety latch — ${d.reason}`];if(d['t'+n]>=d.tempWarning)return ['WARNING',`Motor ${n}: temperature ≥ ${d.tempWarning}°C`];if(d.vib>=d.vibWarning||d.rot>=d.rotWarning)return ['WARNING',`Motor ${n}: elevated shared movement`];return ['NORMAL',`Motor ${n}: readings within configured limits`];}
function valid(d){for(const k of ['sequence','uptime','t1','t2','vib','rot','ax','ay','az','sp1','sp2','tempWarning','tempCritical','vibWarning','vibCritical','rotWarning','rotCritical'])if(typeof d[k]!=='number'||!Number.isFinite(d[k]))throw Error('Invalid telemetry: '+k);for(const k of ['t1OK','t2OK','mpuOK','critical','r1','r2'])if(typeof d[k]!=='boolean')throw Error('Invalid flags');for(const n of [1,2]){if(!['STOP','FORWARD','REVERSE'].includes(d['m'+n]))throw Error('Invalid direction');if(d['sp'+n]<0||d['sp'+n]>255)throw Error('Invalid PWM');}if(d.tempWarning>=d.tempCritical)throw Error('Invalid thresholds');}
function render(){ $('connection').textContent=online?'LIVE • ESP32':'OFFLINE';$('connection').className='badge '+(online?'NORMAL':'OFFLINE');document.querySelectorAll('[data-command]').forEach(b=>b.disabled=!online||busy||(data.critical&&!b.dataset.command.endsWith('S')));$('reset').disabled=!online||busy;
for(const n of [1,2]){let state=online?motorState(data,n):['OFFLINE',`Motor ${n}: live data unavailable`];$('state'+n).textContent=state[0];$('state'+n).className='badge '+state[0];$('reason'+n).textContent=state[1];$('temp'+n).textContent=online&&data['t'+n+'OK']?data['t'+n].toFixed(1)+'°':'—';$('output'+n).textContent=online?data['m'+n]:'Unavailable';$('relay'+n).textContent=online?'Relay '+(data['r'+n]?'ON':'OFF'):'Relay unknown';$('pwm'+n).textContent=online?data['sp'+n]:'—';$('speed'+n).disabled=!online||busy||data.critical;if(online&&document.activeElement!==$('speed'+n))$('speed'+n).value=data['sp'+n];let r=$('rotor'+n);let running=online&&!data.critical&&data['r'+n]&&data['m'+n]!=='STOP'&&data['sp'+n]>0;r.style.animationPlayState=running?'running':'paused';r.style.animationDirection=online&&data['m'+n]==='REVERSE'?'reverse':'normal';r.style.animationDuration=online?Math.max(.15,2-data['sp'+n]/150)+'s':'1s';draw(n);}
$('mpu').textContent=online?(data.mpuOK?'CONNECTED':'SENSOR FAULT'):'UNAVAILABLE';$('vibration').textContent=online&&data.mpuOK?data.vib.toFixed(3)+' g':'—';$('rotation').textContent=online&&data.mpuOK?data.rot.toFixed(1)+' °/s':'—';$('axes').textContent=online&&data.mpuOK?[data.ax,data.ay,data.az].map(x=>x.toFixed(2)).join(' / '):'—';$('lock').textContent=online?(data.critical?'LATCHED':'CLEAR'):'UNKNOWN';$('system').textContent=online?data.warning:'Connection lost. Last values are not live. ESP32 protection operates locally.';$('limits').textContent=online?`Movement: warning ≥${data.vibWarning} g / ${data.rotWarning} °/s; critical ≥${data.vibCritical} g / ${data.rotCritical} °/s. Initial limits need calibration on your mount.`:'';}
function draw(n){let c=$('chart'+n),ctx=c.getContext('2d');ctx.clearRect(0,0,600,110);let rows=history.slice(-120);ctx.strokeStyle='#48e0c2';ctx.lineWidth=2;ctx.beginPath();let pen=false;rows.forEach((r,i)=>{if(!r['t'+n+'OK']){pen=false;return;}let x=i*600/119,y=100-Math.min(60,Math.max(0,r['t'+n]))/60*90;if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;});ctx.stroke();}
function log(text){events.unshift({time:new Date().toISOString(),text});events=events.slice(0,100);$('events').replaceChildren(...events.map(e=>{let li=document.createElement('li');li.textContent=e.time.slice(11,19)+' · '+e.text;return li;}));}
async function update(){try{let r=await fetch('/api',{cache:'no-store',signal:AbortSignal.timeout(2500)});if(!r.ok)throw Error('HTTP '+r.status);let d=await r.json();valid(d);if(d.sequence!==lastSeq||d.uptime<lastUptime){lastChange=Date.now();lastSeq=d.sequence;}if(Date.now()-lastChange>4000)throw Error('Frozen telemetry');lastUptime=d.uptime;data=d;if(!online)log('Device connected');online=true;history.push({...d,time:new Date().toISOString()});history=history.slice(-1800);let key=[1,2].map(n=>motorState(d,n).join(':')).join('|');if(key!==previous){[1,2].forEach(n=>log(motorState(d,n)[1]));previous=key;}}catch(e){if(online)log('Connection unavailable: '+e.message);online=false;}render();}
async function command(c,v){if(busy)return;busy=true;render();try{let body=new URLSearchParams({c});if(v!==undefined)body.set('v',v);let r=await fetch('/cmd',{method:'POST',body,signal:AbortSignal.timeout(3000)});let text=await r.text();if(!r.ok)throw Error(text);$('message').textContent='Command accepted: '+c;log('Command accepted: '+c);await update();}catch(e){$('message').textContent=e.message;log('Command failed: '+e.message);}finally{busy=false;render();}}
document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>command(b.dataset.command));[1,2].forEach(n=>$('speed'+n).onchange=e=>command('SPEED'+n,e.target.value));$('stop').onclick=()=>command('ALLSTOP');$('reset').onclick=()=>command('RESET');
$('connect').onclick=()=>{try{let raw=$('address').value.trim();let u=new URL(raw.includes('://')?raw:'http://'+raw);if(u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error();location.href=u.origin;}catch{$('message').textContent='Enter an HTTP device IP or hostname, for example 192.168.4.1';}};
function report(n){let root=$('reportBody');root.replaceChildren();const add=(tag,text)=>{let e=document.createElement(tag);e.textContent=text;root.append(e);};add('h1','SmartPredict • '+(n?'Motor '+n:'Fleet')+' condition report');add('p','Generated '+new Date().toLocaleString()+' · Device '+location.host+' · '+(online?'LIVE':'OFFLINE — last retained data'));add('p','Observation window: '+(history.length?history[0].time+' to '+history.at(-1).time:'No samples')+' · '+history.length+' samples retained (max 1800).');if(data)for(const i of n?[n]:[1,2]){add('h2','Motor '+i);add('p',motorState(data,i)[1]);let values=history.filter(r=>r['t'+i+'OK']).map(r=>r['t'+i]);add('p',`Last temperature: ${data['t'+i+'OK']?data['t'+i].toFixed(2)+' °C':'unavailable'} · Peak: ${values.length?Math.max(...values).toFixed(2)+' °C':'unavailable'} · PWM: ${data['sp'+i]} · Direction: ${data['m'+i]} · Relay: ${data['r'+i]?'ON':'OFF'}`);add('p',`Temperature limits: warning ${data.tempWarning} °C / critical ${data.tempCritical} °C. Inspect cooling/load if hot; inspect mount/alignment if shared movement rises. These are inspection suggestions, not a diagnosis.`);}add('h2','Shared motion and event evidence');add('p','One shared MPU6050; no independent motor vibration or shaft RPM measurement. Animation indicates commands only. No failure-life prediction is made.');for(const e of events.filter(e=>!n||!e.text.includes('Motor ')||e.text.includes('Motor '+n)))add('p',e.time+' — '+e.text);$('reportDialog').showModal();}
$('report').onclick=()=>report(0);document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>report(Number(b.dataset.report)));
$('csv').onclick=()=>{let keys=['time','t1','t1OK','t2','t2OK','mpuOK','vib','rot','m1','m2','sp1','sp2','r1','r2','critical'];let csv=keys.join(',')+'\n'+history.map(r=>keys.map(k=>JSON.stringify(r[k])).join(',')).join('\n');let url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));let a=document.createElement('a');a.href=url;a.download='smartpredict-readings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function poll(){await update();setTimeout(poll,1000);}render();poll();
</script></html>

)HTML";

// =============== SETUP =========================
void setup() {
  Serial.begin(115200);
  delay(700);

  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  stopAll();

  digitalWrite(RELAY1_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  digitalWrite(RELAY2_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  relay1(false);
  relay2(false);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  ds1.begin();
  ds2.begin();
  ds1.setWaitForConversion(false);
  ds2.setWaitForConversion(false);

  Wire.begin(MPU_SDA, MPU_SCL);
  Wire.setClock(100000);
  initMPU();

  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);

  bool apOK = WiFi.softAP(
    WIFI_NAME,
    WIFI_PASSWORD,
    1,
    false,
    4
  );

  Serial.println("\n===== ESP32 DASHBOARD =====");
  Serial.print("AP started: ");
  Serial.println(apOK ? "YES" : "NO");
  Serial.print("Wi-Fi name: ");
  Serial.println(WIFI_NAME);

  Serial.print("IP address: ");
  Serial.println(WiFi.softAPIP());

  server.on("/", HTTP_GET, []() {
    server.send_P(200, "text/html", PAGE);
  });

  server.on("/api", HTTP_GET, handleAPI);
  const char* headers[] = {"Origin"};
  server.collectHeaders(headers, 1);
  server.on("/cmd", HTTP_POST, handleCommand);
  server.begin();

  Serial.println("Web server started");
  Serial.println("Waiting for phone connection...");

  ds1.requestTemperatures();
  ds2.requestTemperatures();
  tempStarted = millis();
  lastTempRequest = millis();
  tempPending = true;
}

// =============== LOOP ==========================
void loop() {
  server.handleClient();

  updateTemperatures();

  unsigned long now = millis();
  if (now - lastMPU >= 100) {
    lastMPU = now;
    readMPU();
    sampleSequence++;
    evaluateSafety();
  }

  static int previousClients = -1;
  int clients = WiFi.softAPgetStationNum();

  if (clients != previousClients) {
    previousClients = clients;
    Serial.print("Connected phone/device count: ");
    Serial.println(clients);
  }
}
