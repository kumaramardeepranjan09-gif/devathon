# Current hardware: NO RELAY

Use the same tested pins: DS18B20 DATA 16/17; IMU SDA21/SCL22 (0x68); buzzer23; L298N ENA25/IN1=26/IN2=27, ENB14/IN3=18/IN4=19. GPIO32/33 are unused. Connect motors directly to their L298N outputs; do not follow older relay wiring notes below. PWM uses ESP32 core 3.x ledcAttach at 1000 Hz / 8 bits. Remove ENA/ENB jumpers.

MPU6050 (WHO_AM_I 0x68) and MPU6500 (0x70) are accepted. Keep the IMU still with both motors OFF during the one-second startup baseline acquisition. Acceleration and gyro deviation from this baseline drive movement detection. Motion detection defaults: 0.18 g or 12 degrees/second; edit MOTION_DETECT_G / MOTION_DETECT_DPS. Existing warning/critical protection limits remain separate and enabled; unlike the bring-up test, excessive motion still latches protection.

**3D animation requires an active motor driver command AND shared movement_detected=true.** No movement, stop, sensor fault, stale telemetry or disconnect pauses animation. This shared detector cannot confirm individual shaft motion: smooth running may not cross thresholds; one motor or external shaking can trigger movement for both commanded motors. Add an encoder/Hall sensor to each motor for true per-motor rotation confirmation. No measured RPM is claimed.

API r1/r2 are retained only as backward-compatible aliases for driver enable; no relay is installed or controlled. Relays are not required. Service counters track commanded operation, not actual motion.

# SmartPredict — two motor station

Single upload file: **[SmartPredict_ESP32/SmartPredict_ESP32.ino](SmartPredict_ESP32/SmartPredict_ESP32.ino)**. It contains the ESP32 firmware, offline dashboard, animated motor models, controls, reports and CSV export. No separate website, backend, CDN or API key is needed.

## Hardware ke bina demo dekhein

Download **[demo.html](demo.html)** using GitHub's Download raw file button, then open the downloaded file in Chrome/Edge/Firefox. This is a single self-contained file with embedded Three.js: no npm, server or internet needed by its code. If your browser/device blocks local HTML, serve this folder using `python3 -m http.server 8080` and open `http://localhost:8080/demo.html` on your computer. Some phone file viewers cannot execute HTML JavaScript; use a full browser or laptop.

Demo is visibly labelled **SIMULATED**. Healthy, Motor 1 warning, Motor 2 critical, shared movement, sensor fault and disconnect presets exercise the interface. Reports and CSV also carry DEMO labels. No demo action can send commands to hardware. Drag each 3D motor to rotate, scroll to zoom, use Cutaway to see rotor/bearings and Reset camera to restore the view.

## Separate hardware firmware

`demo.html` is only simulation. Upload `SmartPredict_ESP32/SmartPredict_ESP32.ino` for real readings; it serves the same 3D interface directly from the ESP32, with no demo transport. The HTML is gzip-compressed into flash to reduce transfer and firmware size. `web/hardware.html` is generated developer output: the actual hardware app must be opened from the ESP32's IP so `/api` and `/cmd` address that device.

## Pehle upload, phir IP kholo

1. Arduino IDE 2.x install karein. Boards Manager mein **esp32 by Espressif Systems 3.3.0** install karein. Additional board URL: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
2. Library Manager mein **OneWire 2.3.8** aur **DallasTemperature 4.0.5** install karein. WiFi/WebServer/Wire ESP32 package mein hain.
3. `SmartPredict_ESP32.ino` ko usi naam wale folder se open karein. Board **ESP32 Dev Module** (classic WROOM) aur correct USB port select karein.
4. File ke top mein `WIFI_NAME` aur `WIFI_PASSWORD` set karein. SSID `09` is configured for your existing 2.4 GHz Wi-Fi. Set `WIFI_PASSWORD` locally before upload; the public repository contains a placeholder. Credentials GitHub par commit na karein.
5. Motor power disconnected rakhkar Verify/Upload karein. Serial Monitor **115200 baud** kholein.
6. ESP32 aur phone/laptop ko **same 2.4 GHz Wi-Fi network `09`** par connect karein. ESP32 now uses station mode, not its own access point.
7. Serial Monitor (115200 baud) mein **Dashboard IP: http://...** print hone ka wait karein, phir wahi address browser mein kholein. `192.168.4.1` is not the station-mode address. Dashboard ESP32 se hi load hota hai. IP code mein dalne ki zaroorat nahi. Address box dusre ESP32 IP ko open karta hai.
8. Dono temperature aur shared MPU healthy hone ka wait karein. Outputs boot par OFF hain. Wiring verify karne ke baad motor power connect karein aur Forward click karein. Stop both motors button PWM aur dono relays OFF karta hai.

## Exact hardware and GPIO wiring

| Component | ESP32 connection |
|---|---|
| DS18B20 Motor 1 DATA | GPIO16, separate 4.7 kΩ pull-up to 3.3V |
| DS18B20 Motor 2 DATA | GPIO17, separate 4.7 kΩ pull-up to 3.3V |
| Both DS18B20 | VDD 3.3V, GND common; use powered 3-wire mode |
| MPU6050 SDA / SCL | GPIO21 / GPIO22; AD0 GND (0x68); compatible 3.3V supply/logic |
| GPIO32 / GPIO33 | Unused; no relay |
| L298N ENA / IN1 / IN2 | GPIO25 / GPIO26 / GPIO27 |
| L298N ENB / IN3 / IN4 | GPIO14 / GPIO18 / GPIO19 |
| Active buzzer control | GPIO23, active HIGH through transistor driver |

Remove L298N **ENA/ENB jumpers** before connecting PWM. Never connect ESP32 PWM to a jumper tied to 5V. L298N OUT1/OUT2 → Motor 1 circuit; OUT3/OUT4 → Motor 2 circuit. PWM value is a command, not measured RPM. Stop before changing direction; allow the rotor to settle (the firmware includes only a minimum 300 ms reversal interval).

Battery → appropriate fuse and accessible physical power switch → L298N motor supply, rated for your motors/module. Battery → buck converter adjusted and measured to the board's permitted 5V input (not 3V3), with common logic grounds. Do not simultaneously feed conflicting USB/external supplies. L298N regulator/5V jumper behavior varies: follow your module's marked supply requirements; do not tie two regulator outputs together. Verify battery voltage, motor stall current, driver cooling and relay ratings before powering motors.



Buzzer: GPIO23 → ~1 kΩ → NPN base, ~10 kΩ base-to-ground, emitter ground, collector buzzer negative; buzzer positive to its rated supply. For an inductive buzzer use a flyback diode. Do not power a high-current buzzer directly from GPIO. Verify transistor pinout and current rating.

## Thresholds: exactly where to edit

Search **`EDIT THRESHOLDS HERE`** in the `.ino`. The constants are authoritative:

- `TEMP_WARNING_C = 32.0` — warning at or above 32°C.
- `TEMP_CRITICAL_C = 36.0` — critical at or above 36°C; both motors stop and latch.
- `TEMP_RESET_C = 31.0` — reset requires both temperatures below 31°C.
- `VIB_WARNING = 0.25`, `VIB_CRITICAL = 0.70` — acceleration magnitude deviation from 1 g.
- `ROT_WARNING = 30.0`, `ROT_CRITICAL = 90.0` — angular velocity magnitude in degrees/second.

Search `TEMP_WARNING_C`, `TEMP_CRITICAL_C`, `TEMP_RESET_C`, `VIB_WARNING`, `VIB_CRITICAL`, `ROT_WARNING`, `ROT_CRITICAL` near the top of the sketch; line numbers shift as features are added. Search names if later edits move lines. Edit, compile and upload; the UI reads thresholds from the firmware API. Never set warning ≥ critical. Movement limits are initial commissioning values and must be calibrated on the actual common mount; they are not measured vibration RMS or motor-specific vibration. At 10 Hz the MPU path detects gross movement, not high-frequency bearing vibration. Movement warning uses 3 consecutive samples; critical uses 4. UI shows current threshold exceedance immediately; the firmware latch applies persistence. Temperature conversion completes approximately every 2.5 seconds.

Sensor loss after the initial 5-second boot grace stops both motors, latches and sounds the buzzer. DS18B20 disconnected, nonfinite, out-of-range and 85°C power-on values are rejected. Healthy sensors are required before motor start. Critical latches require manual reset after conditions become safe; reset never starts motors. Power cycling does not auto-start. A software fault, processor hang or electrical failure can defeat software protection: retain an independent physical power cutoff.

## Dashboard and reports

- Motor 1 and Motor 2 have independent temperatures, states and PWM/direction controls.
- One MPU reading is explicitly shared by both. It cannot tell which motor produced vibration.
- Detailed Three.js motor models adapted from the uploaded motor source show commanded rotation/direction only; animation stops on reported stop, critical latch or stale/disconnected data. No RPM measurement is claimed.
- Fleet and per-motor reports include last readings, temperature peak, thresholds, session events, observation window and inspection suggestions. Print / Save PDF uses the browser print dialog.
- CSV exports up to 1800 retained browser samples. Reports/events are session-local; export before closing. Commanded run-time totals are checkpointed in ESP32 Preferences once per minute. Up to one checkpoint interval can be lost on sudden power loss; flash erasure loses totals.
- Control POSTs are same-origin; do not expose this local device to the public Internet. Other users on the same trusted Wi-Fi may control it. Do not port-forward this dashboard.
- Dashboard network loss does not disable ESP32 local protection or automatically stop otherwise healthy motors. Use the physical stop if browser access is lost.

## Validation and limitations

Run `python3 tests/safety.py` for host tests of the actual firmware safety functions. Run `node tests/dashboard.cjs` with Playwright and `/usr/bin/chromium` installed for browser integration tests. Tests extract the embedded page from the single `.ino`; there is no duplicate dashboard source.

Passed in cloud: temperature boundaries, separate motor attribution, stop/latch/buzzer logic, sensor loss, stale temperature detection, movement persistence; browser telemetry, animation stop, reports, CSV, POST commands, offline/frozen-data rejection, reconnection and mobile layout.

**ESP32 target compilation passed in GitHub Actions** for firmware commit `61291e4`: [verified successful build](https://github.com/kumaramardeepranjan09-gif/devathon/actions/runs/40782134885). The job compiles for `esp32:esp32:esp32` with core 3.3.0 and runs the host protection tests. Local cloud compilation was blocked by network policy; the remote build supplies the target compilation result. Run Arduino IDE Verify again after changing credentials or thresholds. **Physical-device validation remains pending:** no hardware was available for wiring, calibration, buzzer or relay tests.

Before motor power: verify DS18B20 identities (warm each separately), remove one sensor and confirm latch, gently move the shared MPU, confirm driver stop behavior, then test outputs with a safe low-energy setup. Ambient temperatures above the configured limits will intentionally block starting.

## Correct readings kaise verify karein

1. Confirm powered 3-wire DS18B20 wiring and separate 4.7 kΩ pull-ups. Secure sensor 1 to Motor 1, sensor 2 to Motor 2 with electrical isolation and good thermal contact. Warm only sensor 1 and check only Motor 1 changes; repeat for sensor 2. Compare both against a known thermometer at stable temperature. Surface temperature is not internal winding temperature.
2. With the mount still, MPU acceleration magnitude should be near 1 g and angular velocity near 0 °/s. Small offsets are normal. Rigidly attach the single MPU to the common mount. Both motors share this reading; it cannot localize a fault. Never interpret g as mm/s or shaft RPM.
3. At safe low power, observe normal movement first. Adjust `VIB_WARNING`, `VIB_CRITICAL`, `ROT_WARNING`, `ROT_CRITICAL` only after measuring the actual baseline. Temperature warning/critical remain 32/36°C by default. Keep warning below critical and reset below warning. Edit the `.ino` constants and re-upload; the dashboard shows the returned firmware limits.
4. Unplug one temperature sensor: its display must become unavailable and both motors must stop/latch after detection. Unplug MPU: shared sensor fault must latch. After restoring healthy cool sensors, Reset then manually start. Verify physical outputs; an ON label is a commanded state, not contact/shaft feedback.
5. Inspect Serial Monitor at 115200 and `/api` from the ESP32 IP. Confirm `t1OK`, `t2OK`, `mpuOK` are true, `sequence` increases, each warmed temperature changes, and PWM/relay values match your commands. A frozen or disconnected browser clears live readings and stops its animations.

## Rebuild for developers

Edit `web/dashboard.template.html`, `web/motor-view.js`, `web/demo.js`, or `web/firmware.template.txt`, then run `python3 tools/build.py`. This deterministically generates `demo.html`, `web/hardware.html`, and the single upload `.ino`. If you edit firmware constants directly in `.ino` for your device, mirror those edits in the firmware template before rebuilding, otherwise generation restores template defaults. Do not commit Wi-Fi secrets.

Run `node tests/demo.cjs`, `node tests/dashboard.cjs`, and `python3 tests/safety.py`. The hardware browser test decompresses the actual embedded firmware payload. The cloud browser blocks `file://`, so demo browser validation uses a local HTTP server and verifies no external requests; direct file opening was not verified in that managed browser.

## Unified dashboard update

Demo and hardware now share a compact system overview, independent Motor 1/Motor 2 panels, enhanced uploaded motor geometry (grille, cable gland, lifting eye, metallic lighting, shadows and cutaway), and one common trend section. Temperature charts compare both sensors and show firmware warning/critical limits. Shared acceleration deviation and angular velocity have separate charts and units. Hover for exact readings; select last 1/5/15 minutes or all retained session samples. No historical values are fabricated. Missing/long-disconnected periods are not joined into continuous traces.

Motor reports use the selected time range, contain only the selected motor's temperatures/events, and include min/max/average when at least two valid samples exist. Shared MPU evidence is explicitly separate. Each motor has its own CSV export; global CSV and fleet reports remain available. Reports show offline status when last values are retained. Data is bounded to 1800 samples and 100 events per tab.

Run `node tests/upgrade.cjs` for independent commands/PWM, unsafe-reset rejection, chart filters, report statistics/event isolation, PDF generation, separate CSV, and responsive layout. Source for the common UI extension is `web/dashboard-upgrade.js`; run the existing `python3 tools/build.py` after edits to update both standalone outputs and embedded firmware.

## Current connection and monitoring workflow

The latest firmware joins your router/hotspot **09** in station mode. Set its password locally in `WIFI_PASSWORD` (never publish it). Use a 2.4 GHz network; classic ESP32 cannot connect to 5 GHz-only networks. Open Serial Monitor at **115200**, press EN/reset once if you missed the boot messages, and wait for `Dashboard IP: http://...`. Open exactly that HTTP address on a phone/laptop connected to the same network. Disable guest/client isolation. No fixed IP is assumed; reconnect IP is printed whenever Wi-Fi returns. No automatic motor start occurs after reconnect or reset. Local protection continues while Wi-Fi is unavailable.

Main dashboard includes two live 3D motors, independent motor-detail buttons, an Alerts button showing the latest 100 session events, a downloadable HTML report (with Print/Save PDF), individual reports, separate-colour trends and service runtime. Models follow reported direction/PWM/relay state and stop visually on critical/disconnect. These are commands, not shaft sensor feedback. If WebGL is unavailable, the UI displays an explicit fallback; use a current browser with hardware acceleration.

Service lifecycle defaults to **200 hours**, configurable via `SERVICE_BUDGET_HOURS`. It is a maintenance budget, not a predicted failure date. The counters measure relay-enabled, nonzero-PWM commanded operation. Values are stored locally every minute and read back after reboot; flash erase resets them. Persistence errors are labelled volatile. Ranking says **Cooler now** using valid temperatures only; tied, disconnected or faulted states do not invent a best motor. Compare under equivalent load and ambient conditions.

Download report records current failure/warning evidence, recorded session events, sensor status, selected-range statistics and charts. Physical root causes (bearing damage, winding faults, alignment) require inspection and cannot be inferred reliably from these sensors alone.

Connection checklist: upload with motor supply off → check Serial IP → open dashboard → confirm both temperatures/MPU healthy → warm each sensor separately → compare with thermometer → verify driver stop behavior → apply safe motor power → start each motor separately → verify stop, fault and reconnect. Existing GPIO table is authoritative; screenshot pin labels were not adopted.

## Dashboard transfer troubleshooting

The hardware page now requests its bundled Three.js at `/three-r128.js` on the same ESP32; no internet/CDN is used. The main HTML is about 15 KB compressed. Three.js is cached by the browser, while HTML uses no-store. Both assets remain inside the single upload file. The response writer sends blocks of at most 1024 bytes, accounts for partial writes and services sensors between blocks. `tests/transfer.py` exercises short writes, stalls and disconnected clients; `tests/delivery.cjs` tests actual gzip HTTP responses and the separate asset route.

After uploading, reset with motor power off, keep IMU still, open the newly printed IP and use Ctrl+Shift+R once. Check `/api` first. Serial Monitor logs `HTTP transfer complete` or `HTTP transfer interrupted` with available heap. If the board prints startup messages again, report the reset/brownout text and check power separately; a transfer fix cannot repair an unstable power source or Wi-Fi. No credential is printed by diagnostics.
