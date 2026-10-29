# SmartPredict — two motor station

Single upload file: **[SmartPredict_ESP32/SmartPredict_ESP32.ino](SmartPredict_ESP32/SmartPredict_ESP32.ino)**. It contains the ESP32 firmware, offline dashboard, animated motor models, controls, reports and CSV export. No separate website, backend, CDN or API key is needed.

## Pehle upload, phir IP kholo

1. Arduino IDE 2.x install karein. Boards Manager mein **esp32 by Espressif Systems 3.3.0** install karein. Additional board URL: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
2. Library Manager mein **OneWire 2.3.8** aur **DallasTemperature 4.0.5** install karein. WiFi/WebServer/Wire ESP32 package mein hain.
3. `SmartPredict_ESP32.ino` ko usi naam wale folder se open karein. Board **ESP32 Dev Module** (classic WROOM) aur correct USB port select karein.
4. File ke top mein `WIFI_NAME` aur `WIFI_PASSWORD` set karein. Default network name `SmartPredict`; password ko upload se pehle apne 8+ character password se replace karein. Credentials GitHub par commit na karein.
5. Motor power disconnected rakhkar Verify/Upload karein. Serial Monitor **115200 baud** kholein.
6. Phone/laptop ko ESP32 ke **SmartPredict Wi-Fi access point** se connect karein. “No internet” normal hai; connected rahein.
7. Browser mein **http://192.168.4.1** kholein (Serial Monitor mein printed IP authoritative hai). Dashboard ESP32 se hi load hota hai. IP code mein dalne ki zaroorat nahi. Address box dusre ESP32 IP ko open karta hai.
8. Dono temperature aur shared MPU healthy hone ka wait karein. Outputs boot par OFF hain. Wiring verify karne ke baad motor power connect karein aur Forward click karein. Stop both motors button PWM aur dono relays OFF karta hai.

## Exact hardware and GPIO wiring

| Component | ESP32 connection |
|---|---|
| DS18B20 Motor 1 DATA | GPIO16, separate 4.7 kΩ pull-up to 3.3V |
| DS18B20 Motor 2 DATA | GPIO17, separate 4.7 kΩ pull-up to 3.3V |
| Both DS18B20 | VDD 3.3V, GND common; use powered 3-wire mode |
| MPU6050 SDA / SCL | GPIO21 / GPIO22; AD0 GND (0x68); compatible 3.3V supply/logic |
| Relay IN1 / IN2 | GPIO32 / GPIO33; default active LOW |
| L298N ENA / IN1 / IN2 | GPIO25 / GPIO26 / GPIO27 |
| L298N ENB / IN3 / IN4 | GPIO14 / GPIO18 / GPIO19 |
| Active buzzer control | GPIO23, active HIGH through transistor driver |

Remove L298N **ENA/ENB jumpers** before connecting PWM. Never connect ESP32 PWM to a jumper tied to 5V. L298N OUT1/OUT2 → Motor 1 circuit; OUT3/OUT4 → Motor 2 circuit. Each relay's COM/NO can interrupt one lead of its corresponding motor; use contacts rated for DC motor stall current. Keep NC unused. Both direction commands automatically enable that motor's relay. PWM value is a command, not measured RPM. Stop before changing direction; allow the rotor to settle (the firmware includes only a minimum 300 ms reversal interval).

Battery → appropriate fuse and accessible physical power switch → L298N motor supply, rated for your motors/module. Battery → buck converter adjusted and measured to the board's permitted 5V input (not 3V3), with common logic grounds. Do not simultaneously feed conflicting USB/external supplies. L298N regulator/5V jumper behavior varies: follow your module's marked supply requirements; do not tie two regulator outputs together. Verify battery voltage, motor stall current, driver cooling and relay ratings before powering motors.

Use a 3.3V-compatible relay input module and its rated coil supply. Add suitable external pull-ups to keep active-low relay inputs OFF while ESP32 resets; firmware alone cannot guarantee reset-time GPIO levels. Verify OFF polarity with motors disconnected. Do not feed 5V back into ESP32 pins.

Buzzer: GPIO23 → ~1 kΩ → NPN base, ~10 kΩ base-to-ground, emitter ground, collector buzzer negative; buzzer positive to its rated supply. For an inductive buzzer use a flyback diode. Do not power a high-current buzzer directly from GPIO. Verify transistor pinout and current rating.

## Thresholds: exactly where to edit

Search **`EDIT THRESHOLDS HERE`** in the `.ino`. The constants are authoritative:

- `TEMP_WARNING_C = 32.0` — warning at or above 32°C.
- `TEMP_CRITICAL_C = 36.0` — critical at or above 36°C; both motors stop and latch.
- `TEMP_RESET_C = 31.0` — reset requires both temperatures below 31°C.
- `VIB_WARNING = 0.25`, `VIB_CRITICAL = 0.70` — acceleration magnitude deviation from 1 g.
- `ROT_WARNING = 30.0`, `ROT_CRITICAL = 90.0` — angular velocity magnitude in degrees/second.

Temperature constants are on lines **43–45**; movement constants are on lines **77–80** of the delivered sketch. Search names if later edits move lines. Edit, compile and upload; the UI reads thresholds from the firmware API. Never set warning ≥ critical. Movement limits are initial commissioning values and must be calibrated on the actual common mount; they are not measured vibration RMS or motor-specific vibration. At 10 Hz the MPU path detects gross movement, not high-frequency bearing vibration. Movement warning uses 3 consecutive samples; critical uses 4. UI shows current threshold exceedance immediately; the firmware latch applies persistence. Temperature conversion completes approximately every 2.5 seconds.

Sensor loss after the initial 5-second boot grace stops both motors, latches and sounds the buzzer. DS18B20 disconnected, nonfinite, out-of-range and 85°C power-on values are rejected. Healthy sensors are required before motor start. Critical latches require manual reset after conditions become safe; reset never starts motors. Power cycling does not auto-start. A software fault, processor hang or electrical failure can defeat software protection: retain an independent physical power cutoff.

## Dashboard and reports

- Motor 1 and Motor 2 have independent temperatures, states and PWM/direction controls.
- One MPU reading is explicitly shared by both. It cannot tell which motor produced vibration.
- 3D CSS motor models show commanded rotation/direction only; animation stops on reported stop, critical latch or stale/disconnected data. No RPM measurement is claimed.
- Fleet and per-motor reports include last readings, temperature peak, thresholds, session events, observation window and inspection suggestions. Print / Save PDF uses the browser print dialog.
- CSV exports up to 1800 retained browser samples. Reports/events are session-local; export before closing. No historical data is stored permanently on the ESP32.
- Control POSTs are same-origin; do not expose this local device to the public Internet. Everyone with the access-point password can control it. Set a private AP password.
- Dashboard network loss does not disable ESP32 local protection or automatically stop otherwise healthy motors. Use the physical stop if browser access is lost.

## Validation and limitations

Run `python3 tests/safety.py` for host tests of the actual firmware safety functions. Run `node tests/dashboard.cjs` with Playwright and `/usr/bin/chromium` installed for browser integration tests. Tests extract the embedded page from the single `.ino`; there is no duplicate dashboard source.

Passed in cloud: temperature boundaries, separate motor attribution, stop/latch/buzzer logic, sensor loss, stale temperature detection, movement persistence; browser telemetry, animation stop, reports, CSV, POST commands, offline/frozen-data rejection, reconnection and mobile layout.

**ESP32 target compilation passed in GitHub Actions** for firmware commit `61291e4`: [verified successful build](https://github.com/kumaramardeepranjan09-gif/devathon/actions/runs/40782134885). The job compiles for `esp32:esp32:esp32` with core 3.3.0 and runs the host protection tests. Local cloud compilation was blocked by network policy; the remote build supplies the target compilation result. Run Arduino IDE Verify again after changing credentials or thresholds. **Physical-device validation remains pending:** no hardware was available for wiring, calibration, buzzer or relay tests.

Before motor power: verify DS18B20 identities (warm each separately), remove one sensor and confirm latch, gently move the shared MPU, confirm relay OFF polarity, then test outputs with a safe low-energy setup. Ambient temperatures above the configured limits will intentionally block starting.
