load('api_config.js');
load('api_rpc.js');
load('api_timer.js');
load('api_sys.js');
load('api_gpio.js');
load('api_mhz19b.js');
load('api_blynk.js');
load("api_log.js");
load("api_esp32.js");

// Get configs
let uartNo = Cfg.get('app.sensor_uart_n');
let sRx = Cfg.get('app.sensor_attached_rx');
let sTx = Cfg.get('app.sensor_attached_tx');
let ledPin = Cfg.get('doit.led');
let memD = Cfg.get('app.mem_d');
let ppmD = Cfg.get('app.ppm_d');
let sensTempD = Cfg.get('app.sensor_temp_d');
let espTempD = Cfg.get('app.esp_temp_d');
let indicatorSwitchP = Cfg.get('app.indication_switch_pin');

// Initialize MH-Z19B Sensor
let mhz19b = MHZ19B.create(uartNo, sRx, sTx);

// Push PPM, Memory data to Blynk
Timer.set(5000, Timer.REPEAT, function() {
  Log.debug('BLYNK DATA PUSH: starting push process');
  
  if(mhz19b.isWarming || !Blynk.isConnected()) {
    Log.debug('BLYNK DATA PUSH: early exit, either sensor not warmed or blynk not connected');
    return;
  }
  
  // get memory and push to stream
  let mem = Sys.free_ram() / 1024; // memory in kb
  Log.debug('BLYNK DATA PUSH: got free memory and goint to push it. Free mem: ' + JSON.stringify(mem) + 'kb');
  Blynk.virtualWrite(null, memD, mem);
  
  // get ppm and push to stream
  let ppm = mhz19b.getPPM();
  Log.debug('BLYNK DATA PUSH: got ppm value and goint to push it. PPM: ' + JSON.stringify(ppm));
  Blynk.virtualWrite(null, ppmD, ppm);
  
  // get sensor temperature and push to stream
  let sensTemp = mhz19b.getTemp();
  Log.debug('BLYNK DATA PUSH: got sensor temp value and goint to push it. Temp: ' + JSON.stringify(sensTemp) + ' deg. C');
  Blynk.virtualWrite(null, sensTempD, sensTemp);
  
  // get chip temperature and push to stream
  let espTemp = (ESP32.temp() - 32) / 1.8;
  Log.debug('BLYNK DATA PUSH: got chip temp value and goint to push it. Temp: ' + JSON.stringify(espTemp) + ' deg. C');
  Blynk.virtualWrite(null, espTempD, espTemp);

  Log.debug('BLYNK DATA PUSH: finished push process');
}, null);


// Indication Setup
let isIndicationOn = false;

Blynk.setHandler(function(conn, cmd, pin, val, id) {
  Log.debug('BLYNK HANDLER: received command ' + JSON.stringify(cmd) + ', pin: ' + JSON.stringify(pin) + 
  ', value: ' + JSON.stringify(val) + ', id: ' + JSON.stringify(id));
  
  if (cmd === 'vw' && pin === indicatorSwitchP) {
    isIndicationOn = (val === 1);
    Log.debug('BLYNK DATA PUSH: change isIndicationOn to ' + JSON.stringify(isIndicationOn));
  }
}, null);

// Working with Global Variable :(
// I'm not proud of it.
// Hardware... Only Hardcore
let indTState = {
  count: 0,
  timerId: null,
  nOfBlink: 1
};

let flushIndTState = function() {
  indTState.count = 0;
  indTState.timerId = null;
  indTState.nOfBlink = 1;
};

GPIO.set_mode(ledPin, GPIO.MODE_OUTPUT);

Timer.set(7000, Timer.REPEAT, function() {
  Log.debug('PPM Indication Timer: start handling timer');
  if (!isIndicationOn) {
    Log.debug('PPM Indication Timer: early exit, indication is off');
    return;
  }
  
  let ppm = mhz19b.getPPM();
  if(ppm < 600) {
    indTState.nOfBlink = 1;
  } else if (ppm < 800) {
    indTState.nOfBlink = 2;
  } else if (ppm < 1000) {
    indTState.nOfBlink = 3;
  } else if (ppm < 1200) { 
    indTState.nOfBlink = 4;
  } else if (ppm < 1400) { 
    indTState.nOfBlink = 5;
  } else { 
    indTState.nOfBlink = 6;
  }
  
  Log.debug('PPM Indication Timer: setting timer for blinking');
  Log.debug('PPM Indication Timer: number of blinks is ' + JSON.stringify(indTState.nOfBlink));
  indTState.timerId = Timer.set(200, Timer.REPEAT, function() {
    Log.debug('PPM Indication Timer: toggling led');
    let ledState = GPIO.toggle(ledPin);
    Log.debug('PPM Indication Timer: led status is ' + JSON.stringify(ledState));
    
    indTState.count += 1;
    Log.debug('PPM Indication Timer: count=' + JSON.stringify(indTState.count));
    
    if(indTState.count >= (indTState.nOfBlink * 2)) {
      Log.debug('PPM Indication Timer: turning off led, delete timer, flush state');
      GPIO.write(ledPin, 0);
      Timer.del(indTState.timerId);
      flushIndTState();
    }
  }, null);

}, null);
