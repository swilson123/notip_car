//Tell Noah which ground station gives it waypoints: NAMED_VALUE_INT "ATLAS" 1 = Atlas (car uploads on arm), 0 = Mission Planner
var send_groundstation_to_noah = function (white_rabbit) {
	if (!white_rabbit.radio_port.connected || !white_rabbit.radio_port.mavlink) {
		return;
	}

	var time_boot_ms = (Date.now() - white_rabbit.radio_port.mavlink.startup_time) >>> 0;

	var request = new white_rabbit.mavlink.messages.named_value_int(
		time_boot_ms,
		'ATLAS',
		white_rabbit.groundstation === 'atlas' ? 1 : 0
	);

	white_rabbit.send_mavlink_command(white_rabbit, null, request);
};


module.exports = send_groundstation_to_noah;
