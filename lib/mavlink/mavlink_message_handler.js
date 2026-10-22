var FIX_NAMES = ['no GPS', 'no fix', '2D', '3D', 'DGPS', 'RTK float', 'RTK fixed', 'static', 'PPP'];

var mavlink_message_handler = function (white_rabbit, message) {
	//incoming mavlink messages from radio show here......
	if (message.name == "HEARTBEAT") {
		if (white_rabbit.noah.system_id !== message.header.srcSystem) {
			console.log('Noah heartbeat from system id: ' + message.header.srcSystem);
		}
		white_rabbit.noah.system_id = message.header.srcSystem;
		white_rabbit.noah.last_heartbeat = Date.now();
	}

	if (message.name == "VFR_HUD") {
		white_rabbit.noah.heading = message.heading;
	}

	//Noah's GPS: used to judge the RTK options, and as the NTRIP location if the Here 4 isn't plugged in
	if (message.name == "GPS_RAW_INT") {
		var fix_type = message.fix_type;
		if (white_rabbit.noah.gps && white_rabbit.noah.gps.fix_type !== fix_type) {
			console.log('Noah GPS fix: ' + (FIX_NAMES[fix_type] || fix_type));
		}
		white_rabbit.noah.gps = {
			fix_type: fix_type,
			lat: message.lat / 1e7,
			lon: message.lon / 1e7,
			alt_m: message.alt / 1000,
			satellites_visible: message.satellites_visible,
			time: Date.now(),
		};
	}

	//Noah reports its own NTRIP status: NAMED_VALUE_INT "NTRIP_OK" 1 = getting corrections, 0 = not
	//(the message's name field overwrites message.name, so match on the id)
	if (message.id == white_rabbit.mavlink.MAVLINK_MSG_ID_NAMED_VALUE_INT && String(message.name).replace(/\0/g, '') == 'NTRIP_OK') {
		if (white_rabbit.noah.ntrip_ok !== message.value) {
			console.log('Noah NTRIP_OK: ' + message.value);
		}
		white_rabbit.noah.ntrip_ok = message.value;
		white_rabbit.noah.ntrip_ok_time = Date.now();
	}


};


module.exports = mavlink_message_handler;
