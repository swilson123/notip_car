var imu_connect = function (white_rabbit) {

	if (white_rabbit.imu_port.comName) {
		white_rabbit.imu_port.connecting = true;

		white_rabbit.imu_port.serial = new white_rabbit.SerialPort({
			path: white_rabbit.imu_port.comName,
			baudRate: white_rabbit.imu_port.baudrate
		});

		white_rabbit.imu_port.serial.on('open', function () {
			console.log('IMU Port is opened');
			white_rabbit.imu_port.buffer = Buffer.alloc(0);
			white_rabbit.imu_port.connecting = false;
			white_rabbit.imu_port.connected = true;
		});

		white_rabbit.imu_port.serial.on('data', function (data) {
			white_rabbit.imu_message_handler(white_rabbit, data);
		});

		var imu_lost = function (e) {
			console.log('imu_port closed: ', e ? e.message : '');
			white_rabbit.imu_port.serial = null;
			white_rabbit.imu_port.connecting = false;
			white_rabbit.imu_port.connected = false;
			white_rabbit.car.heading = null;
		};

		white_rabbit.imu_port.serial.on('close', imu_lost);
		white_rabbit.imu_port.serial.on('error', imu_lost);

	}
	else {
		console.log('Missing IMU port');
	}

};


module.exports = imu_connect;
