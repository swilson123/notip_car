var FIX_NAMES = ['no GPS', 'no fix', '2D', '3D', 'DGPS', 'RTK float', 'RTK fixed', 'static', 'PPP'];

var mavlink_message_handler = function (white_rabbit, message) {
	//incoming mavlink messages from radio show here......
	if (message.name == "HEARTBEAT") {
		if (white_rabbit.noah.system_id !== message.header.srcSystem) {
			console.log('Noah heartbeat from system id: ' + message.header.srcSystem);
		}
		white_rabbit.noah.system_id = message.header.srcSystem;
		white_rabbit.noah.last_heartbeat = Date.now();

		//Arm state from the Pixhawk's own heartbeat (not the Raspberry Pi's, which has no autopilot)
		if (message.autopilot !== white_rabbit.mavlink.MAV_AUTOPILOT_INVALID) {
			var armed = (message.base_mode & white_rabbit.mavlink.MAV_MODE_FLAG_SAFETY_ARMED) !== 0;

			if (white_rabbit.noah.armed !== null && armed !== white_rabbit.noah.armed) {
				console.log('Noah ' + (armed ? 'ARMED' : 'disarmed'));

				if (armed && white_rabbit.groundstation === 'atlas') {
					white_rabbit.atlas_dispatch_to_noah(white_rabbit);
				}
			}
			white_rabbit.noah.armed = armed;
		}
	}

	//Replies to a mission upload the car started (Atlas waypoints)
	if (message.name == "MISSION_REQUEST_INT" || message.name == "MISSION_REQUEST" || message.name == "MISSION_ACK") {
		white_rabbit.mission_upload_handler(white_rabbit, message);
	}

	if (message.name == "SYS_STATUS" && message.battery_remaining >= 0 && message.battery_remaining <= 100) {
		white_rabbit.noah.battery_percent = message.battery_remaining;
	}

	if (message.name == "BATTERY_STATUS" && message.battery_remaining >= 0 && message.battery_remaining <= 100) {
		white_rabbit.noah.battery_percent = message.battery_remaining;
	}

	if (message.name == "MISSION_CURRENT") {
		white_rabbit.noah.current_waypoint_sequence = message.seq;
	}

	//Noah's GPS: used to judge the RTK options, and as the NTRIP location if the Here 4 isn't plugged in
	if (message.name == "GPS_RAW_INT") {
		var fix_type = message.fix_type;
		if (white_rabbit.noah.gps && white_rabbit.noah.gps.fix_type !== fix_type) {
			console.log('Noah GPS fix: ' + (FIX_NAMES[fix_type] || fix_type));
		}
		white_rabbit.noah.gps = {
			fix_type: fix_type,
			lat: message.lat === 2147483647 ? null : message.lat / 1e7,
			lon: message.lon === 2147483647 ? null : message.lon / 1e7,
			alt_m: message.alt / 1000,
			satellites_visible: message.satellites_visible,
			h_acc: Number.isFinite(message.h_acc) && message.h_acc !== 4294967295 ? message.h_acc / 1000 : null,
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
