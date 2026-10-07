var create_mavlink_server = function (white_rabbit) {
	//Create a server to forward mavlink messages to groundstation
	//In Mission Planner: pick "TCP" in the connect dropdown, then enter this computer's IP and port
	white_rabbit.radio_port.server = white_rabbit.net.createServer(function (sock) {

		sock.setNoDelay(true);
		white_rabbit.radio_port.mavlink_sockets.push(sock);

		console.log('New Mavlink Sock........................... ' + sock.remoteAddress + ':' + sock.remotePort);

		//Only whole frames go to the radio, so our compass heading can never land in the middle of a groundstation message
		var splitter = white_rabbit.mavlink_frame_splitter();

		sock.on('data', function (data) {
			//write groundstation message to Noah............
			splitter.push(data).forEach(function (frame) {
				if (white_rabbit.radio_port.serial && white_rabbit.radio_port.connected) {
					white_rabbit.radio_port.serial.write(frame);
				}
			});
		});

		sock.on('error', function (e) {
			console.log('Mavlink socket error: ', e.message);
		});

		sock.on('close', function () {
			console.log('Mavlink socket closed');

			var i = white_rabbit.radio_port.mavlink_sockets.indexOf(sock);
			if (i !== -1) {
				white_rabbit.radio_port.mavlink_sockets.splice(i, 1);
			}
		});

	});

	white_rabbit.radio_port.server.on('error', function (e) {
		console.log('Mavlink server error: ', e.message);
	});

	white_rabbit.radio_port.server.listen(white_rabbit.radio_port.port, white_rabbit.radio_port.ip_address, function () {
		console.log('Mavlink server listening for Mission Planner on ' + white_rabbit.radio_port.ip_address + ':' + white_rabbit.radio_port.port);
	});
};


module.exports = create_mavlink_server;
