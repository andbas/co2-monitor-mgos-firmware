load('api_sys.js')
load('api_uart.js');
load('api_timer.js');

let MHZ19B = {
  _cmdAutocalibrationOff : '\xff\x01\x79\x00\x00\x00\x00\x00',
  _cmdAutocalibrationOn  : '\xff\x01\x79\xA0\x00\x00\x00\x00',
  _cmdGetPpm: '\xff\x01\x86\x00\x00\x00\x00\x00',
  
  create: function(uartNo, rx, tx, autocalib){
  
    let mhz19b = Object.create(this._proto);
    mhz19b.configure(uartNo, rx, tx, autocalib);

    return mhz19b;
  },

  _proto: {

    _checksum: function(cmd) {
      let sum = 0x00;
      for(let i = 1; i < cmd.length; i++) {
        sum += cmd.at(i);
        if(sum > 0xff) {
          sum = sum % 0xff - 0x01;
        }
      }
      sum = 0xff - sum + 0x01;
      return sum;
    },

    _sendcmd: function(cmd, isReturning) {
      let chksum = this._checksum(cmd);
      
      UART.write(this._uartNo, cmd);
      UART.write(this._uartNo, chr(chksum));
      UART.flush(this._uartNo);

      if(isReturning) {
        return this._readSync();
      }
    },

    _parseSensorResponse: function(data) {
      if (data && data.at(1) === MHZ19B._cmdGetPpm.at(2)) {
        self._ppm = data.at(2) * 256 + data.at(3);
        self._temp = data.at(4) - 40;
        if(self.isWarming) {
          self.isWarming = false;
        }
      }
    },

    _update: function() {
      this._sendcmd(MHZ19B._cmdGetPpm);
    },

    configure: function(uartNo, rx, tx, autocalib) {
      this._uartNo = uartNo;
      this._ppm = -1;
      this._temp = -40;

      this.isWarming = true;

      UART.setConfig(uartNo, {
        baudRate: 9600,
        esp32: {
          gpio: {
            rx: rx,
            tx: tx,
          },
        },
      });

      UART.setDispatcher(uartNo, function(uartNo, self) {
        if (uartNo !== self._uartNo) {
          return;
        }

        let ra = UART.readAvail(self._uartNo);
        if (ra > 0) {
          let data = UART.read(self._uartNo);
          self._parseSensorResponse(data);
        }

      }, this);

      UART.setRxEnabled(uartNo, true);
  
      if(!autocalib) {
        this._sendcmd(MHZ19B._cmdAutocalibrationOff);
      }

      this._update();
      // this._autoUpdate();
      Timer.set(5000, Timer.REPEAT, function(self) {
        self._update();
      }, this)
    },

    getPPM: function() {
      return this._ppm;
    },

    getTemp: function() {
      return this._temp;
    }
  }
};
