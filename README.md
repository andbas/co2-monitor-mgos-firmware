# CO2 Monitor Firmware 

This firmware is based on mongoose os for ESP32 controller. 

## Installation and setup

```
mos build --platform esp32 --local
mos flash 
mos wifi [ssid] [password] 
mos config-set blynk.auth=[blynk_auth_token]
mos config-set debug.level=3
mos console
```
