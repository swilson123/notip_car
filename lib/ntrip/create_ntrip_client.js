//NTRIP client for the Ohio Real Time Network (Trimble NtripCaster). Same request as the drone NTRIP client.
//Corrections go to Noah over the radio (GPS_RTCM_DATA) and into the Here 4 so it gets an RTK fixed position too.
var create_ntrip_client = function (white_rabbit) {
	var ntrip = white_rabbit.ntrip;

	if (!ntrip.address || !ntrip.mountpoint) {
		console.log('Missing Ntrip address/mountpoint');
		return;
	}
	if (!ntrip.username || !ntrip.password) {
		console.log('Missing Ntrip username/password (ntrip_credentials.json)');
		return;
	}
	if (ntrip.client || !ntrip.GGA) {
		return;
	}

	ntrip.connected = false;
	ntrip.last_data_time = Date.now();
	ntrip.splitter = white_rabbit.rtcm_frame_splitter();
	ntrip.client = new white_rabbit.net.Socket();

	ntrip.client.connect(ntrip.port_number, ntrip.address, function () {
		console.log('NTRIP Client Connected - Mountpoint: ' + ntrip.mountpoint);
		var base64_user_pass = Buffer.from(ntrip.username + ':' + ntrip.password).toString('base64');
		var useragent = 'NTRIP White Rabbit Client';

		ntrip.client.write('GET /' + ntrip.mountpoint + ' HTTP/1.1' + '\r\nUser-Agent: ' + useragent + '\r\nAuthorization: Basic ' + base64_user_pass + '\r\n\r\n');
	});

	ntrip.client.on('data', function (data) {
		ntrip.last_data_time = Date.now();

		if (!ntrip.connected) {
			var response = data.toString('latin1');

			if (response.indexOf('SOURCETABLE') >= 0 || response.indexOf('404 Not Found') >= 0) {
				console.log('NTRIP mount point does not exist: ' + ntrip.mountpoint);
				return;
			}
			if (response.indexOf('401 Unauthorized') >= 0) {
				console.log('NTRIP unauthorized - check ntrip_credentials.json');
				return;
			}
			if (response.indexOf('ICY 200 OK') >= 0 || response.indexOf('HTTP/1.0 200 OK') >= 0 || response.indexOf('HTTP/1.1 200 OK') >= 0) {
				console.log('NTRIP stream accepted');
				ntrip.connected = true;
				ntrip.client.write(ntrip.GGA);
				ntrip.last_location_update = Date.now();

				//Corrections can arrive in the same packet as the response header
				var header_end = response.indexOf('\r\n\r\n');
				data = header_end >= 0 ? data.slice(header_end + 4) : Buffer.alloc(0);
			}
			else {
				return;
			}
		}

		if (data.length === 0) {
			return;
		}

		ntrip.last_rtcm_time = Date.now();
		ntrip.healthy = true;
		ntrip.bytes += data.length;

		//Write to the Here 4 so it can get an RTK fixed position..............
		if (white_rabbit.rtk_port.serial && white_rabbit.rtk_port.connected) {
			white_rabbit.rtk_port.serial.write(data);
		}

		//Send to Noah..............
		ntrip.splitter.push(data).forEach(function (frame) {
			white_rabbit.send_rtcm_to_noah(white_rabbit, frame, 'car_ntrip');
		});
	});

	ntrip.client.on('close', function () {
		console.log('NTRIP Client closed');
		ntrip.client = null;
		ntrip.connected = false;
		ntrip.healthy = false;
		ntrip.last_close_time = Date.now();
	});

	ntrip.client.on('error', function (e) {
		console.log('NTRIP Client error: ', e.message);
	});
};


module.exports = create_ntrip_client;
