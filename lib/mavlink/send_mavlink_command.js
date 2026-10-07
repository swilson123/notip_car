var send_mavlink_command = function (white_rabbit, status_message, request) {
	//send radio mavlink command
	if (white_rabbit.radio_port.mavlink) {
		if (white_rabbit.radio_port.connected) {
			if (status_message) {
				console.log('send_mavlink_command - status_message: ' + status_message);
			}
			if (request) {
				var mav = white_rabbit.radio_port.mavlink;
				var p = Buffer.from(request.pack(mav));
				mav.seq = (mav.seq + 1) % 256;

				white_rabbit.radio_port.serial.write(p);
			}
			else {
				console.log('send_mavlink_command: Command Request Not Found');
			}

		}
		else {
			console.log('send_mavlink_command: Drone not connected via mavlink');
		}

	}
	else {
		console.log('send_mavlink_command: Missing Radio');
	}

};


module.exports = send_mavlink_command;
