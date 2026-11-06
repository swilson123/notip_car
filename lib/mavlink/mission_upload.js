//Upload a mission to Noah's Pixhawk with the MAVLink mission protocol:
//  car MISSION_COUNT -> Pixhawk MISSION_REQUEST_INT(seq) -> car MISSION_ITEM_INT(seq) ... -> Pixhawk MISSION_ACK
//The Pixhawk's requests come back through mission_upload_handler.js
//items: [{lat, lon, alt}] - item 0 is home (ArduPilot overwrites it), the rest are NAV_WAYPOINTs
var COUNT_RETRY_MS = 1500;
var COUNT_RETRIES = 5;
var UPLOAD_TIMEOUT_MS = 30000;
var AUTOPILOT_COMPONENT = 1;

var mission_upload = function (white_rabbit, items, done) {
	var upload = white_rabbit.mission_upload_state;

	if (upload.active) {
		done(new Error('a mission upload is already running'));
		return;
	}
	if (!white_rabbit.radio_port.connected || !white_rabbit.noah.system_id) {
		done(new Error('Noah not connected'));
		return;
	}

	upload.active = true;
	upload.items = items;
	upload.target_system = white_rabbit.noah.system_id;
	upload.target_component = AUTOPILOT_COMPONENT;
	upload.started = Date.now();
	upload.requested = false;
	upload.done = done;

	var send_count = function () {
		var request = new white_rabbit.mavlink.messages.mission_count(upload.target_system, upload.target_component, items.length, 0);
		white_rabbit.send_mavlink_command(white_rabbit, null, request);
	};

	var tries = 1;
	send_count();

	upload.timer = setInterval(function () {
		//No MISSION_REQUEST yet - the count may have been lost over the radio
		if (!upload.requested && tries < COUNT_RETRIES) {
			tries++;
			send_count();
		}
		else if (!upload.requested || Date.now() - upload.started > UPLOAD_TIMEOUT_MS) {
			white_rabbit.mission_upload_finish(white_rabbit, new Error('Pixhawk did not respond to the mission upload'));
		}
	}, COUNT_RETRY_MS);
};


module.exports = mission_upload;
