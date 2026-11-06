//Answer the Pixhawk's MISSION_REQUEST(_INT)s during an upload started by mission_upload.js, and finish on MISSION_ACK
var mission_upload_handler = function (white_rabbit, message) {
	var upload = white_rabbit.mission_upload_state;
	var mavlink = white_rabbit.mavlink;

	if (!upload.active) {
		return;
	}

	//Only answer requests meant for us (Mission Planner on the TCP link has its own ids)
	if (message.header.srcSystem !== upload.target_system ||
		message.target_system !== white_rabbit.radio_port.commandSystem ||
		message.target_component !== white_rabbit.radio_port.commandComponent) {
		return;
	}

	if (message.name == 'MISSION_REQUEST_INT' || message.name == 'MISSION_REQUEST') {
		var item = upload.items[message.seq];
		if (!item) {
			return;
		}
		upload.requested = true;

		var request = new mavlink.messages.mission_item_int(
			upload.target_system,
			upload.target_component,
			message.seq,
			mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
			mavlink.MAV_CMD_NAV_WAYPOINT,
			0,		//current
			1,		//autocontinue
			0, 0, 0, 0,
			Math.round(item.lat * 1e7),
			Math.round(item.lon * 1e7),
			item.alt,
			0		//MAV_MISSION_TYPE_MISSION
		);
		white_rabbit.send_mavlink_command(white_rabbit, null, request);
	}

	if (message.name == 'MISSION_ACK') {
		//A duplicate item (we answered a re-sent request the radio delayed) - the Pixhawk keeps the upload open and asks again
		if (message.type === mavlink.MAV_MISSION_INVALID_SEQUENCE) {
			return;
		}

		if (message.type === mavlink.MAV_MISSION_ACCEPTED) {
			white_rabbit.mission_upload_finish(white_rabbit, null);
		}
		else {
			white_rabbit.mission_upload_finish(white_rabbit, new Error('Pixhawk rejected the mission, MAV_MISSION_RESULT ' + message.type));
		}
	}
};


module.exports = mission_upload_handler;
