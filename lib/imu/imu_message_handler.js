//WitMotion HWT906 standard protocol: 11 byte packets
//[0x55][type][8 data bytes][checksum = low byte of the sum of the first 10 bytes]
//type 0x53 = angle: roll, pitch, yaw as int16 little-endian, degrees = value / 32768 * 180
var PACKET_LENGTH = 11;
var HEADER = 0x55;
var TYPE_ANGLE = 0x53;

var imu_message_handler = function (white_rabbit, data) {
	
	var imu = white_rabbit.imu_port;
	imu.buffer = Buffer.concat([imu.buffer, data]);

	while (imu.buffer.length >= PACKET_LENGTH) {
		if (imu.buffer[0] !== HEADER) {
			imu.buffer = imu.buffer.slice(1);
			continue;
		}

		var sum = 0;
		for (var i = 0; i < PACKET_LENGTH - 1; i++) {
			sum += imu.buffer[i];
		}
		// if ((sum & 0xFF) !== imu.buffer[PACKET_LENGTH - 1]) {
		// 	//Not a real packet start, resync one byte on
		// 	imu.buffer = imu.buffer.slice(1);
		// 	continue;
		// }

		var packet = imu.buffer.slice(0, PACKET_LENGTH);
		imu.buffer = imu.buffer.slice(PACKET_LENGTH);

		if (packet[1] === TYPE_ANGLE) {
			var roll = packet.readInt16LE(2) / 32768 * 180;
			var pitch = packet.readInt16LE(4) / 32768 * 180;
			var yaw = packet.readInt16LE(6) / 32768 * 180;

			//IMU yaw is counter-clockwise positive; compass heading is clockwise from north
			var heading = white_rabbit.imu_heading_reverse ? -yaw : yaw;
			heading = heading + white_rabbit.imu_heading_offset;
			heading = ((heading % 360) + 360) % 360;

			white_rabbit.car.roll = roll;
			white_rabbit.car.pitch = pitch;
			white_rabbit.car.yaw = yaw;
			white_rabbit.car.heading = heading;
			white_rabbit.car.last_update = Date.now();
			//console.log(white_rabbit.car.heading);
		}
	}
};


module.exports = imu_message_handler;
