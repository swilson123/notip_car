var rtk_connect = function (white_rabbit) {

	if (white_rabbit.rtk_port.comName) {
		white_rabbit.rtk_port.connecting = true;

		white_rabbit.rtk_port.serial = new white_rabbit.SerialPort({
			path: white_rabbit.rtk_port.comName,
			baudRate: white_rabbit.rtk_port.baudrate
		});

		white_rabbit.rtk_port.serial.on('open', function () {
			console.log('RTK Port is opened');
			white_rabbit.rtk_port.buffer = Buffer.alloc(0);
			white_rabbit.rtk_port.connecting = false;
			white_rabbit.rtk_port.connected = true;
			white_rabbit.rtk_configure(white_rabbit);
		});

		white_rabbit.rtk_port.serial.on('data', function (data) {
			white_rabbit.rtk_message_handler(white_rabbit, data);
		});

		var rtk_lost = function (e) {
			console.log('rtk_port closed: ', e ? e.message : '');
			white_rabbit.rtk_port.serial = null;
			white_rabbit.rtk_port.connecting = false;
			white_rabbit.rtk_port.connected = false;
			white_rabbit.rtk.state = 'disconnected';
		};

		white_rabbit.rtk_port.serial.on('close', rtk_lost);
		white_rabbit.rtk_port.serial.on('error', rtk_lost);

	}
	else {
		console.log('Missing RTK port');
	}

};


module.exports = rtk_connect;
