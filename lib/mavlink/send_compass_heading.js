//Send the car's IMU compass heading to Noah as a NAMED_VALUE_FLOAT (name "CAR_HDG", value = degrees 0-360)
var IMU_STALE_MS = 1000;

var send_compass_heading = function (white_rabbit) {
	if (!white_rabbit.radio_port.connected || !white_rabbit.radio_port.mavlink) {
		return;
	}

	//Don't send an old heading if the IMU has gone quiet
	if (white_rabbit.car.heading === null || Date.now() - white_rabbit.car.last_update > IMU_STALE_MS) {
		return;
	}

	var time_boot_ms = (Date.now() - white_rabbit.radio_port.mavlink.startup_time) >>> 0;

	var request = new white_rabbit.mavlink.messages.named_value_float(
		time_boot_ms,
		white_rabbit.heading_message_name,
		white_rabbit.car.heading
	);

	white_rabbit.send_mavlink_command(white_rabbit, null, request);
};


module.exports = send_compass_heading;
