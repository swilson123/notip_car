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


};


module.exports = mavlink_message_handler;
