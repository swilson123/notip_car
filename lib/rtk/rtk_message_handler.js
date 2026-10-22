//Here 4 Base USB stream: a mix of UBX frames (status) and RTCM3 frames (corrections for Noah)
var UBX_MAX_PAYLOAD = 4096;

var handle_ubx = function (white_rabbit, msg_class, msg_id, payload) {
	var ubx = white_rabbit.ubx;
	var rtk = white_rabbit.rtk;

	if (msg_class === ubx.CLASS.NAV && msg_id === ubx.ID.NAV_PVT && payload.length >= 92) {
		rtk.pvt = {
			hour: payload[8],
			min: payload[9],
			sec: payload[10],
			fix_type: payload[20],
			carr_soln: (payload[21] >> 6) & 0x03,	//0 none, 1 RTK float, 2 RTK fixed
			num_sv: payload[23],
			lon: payload.readInt32LE(24) / 1e7,
			lat: payload.readInt32LE(28) / 1e7,
			height_m: payload.readInt32LE(32) / 1000,	//above ellipsoid
			hmsl_m: payload.readInt32LE(36) / 1000,		//above mean sea level
			h_acc_m: payload.readUInt32LE(40) / 1000,
			g_speed_mps: payload.readInt32LE(60) / 1000,
			s_acc_mps: payload.readUInt32LE(68) / 1000,
			pdop: payload.readUInt16LE(76) / 100,
			time: Date.now(),
		};
	}
	else if (msg_class === ubx.CLASS.NAV && msg_id === ubx.ID.NAV_SVIN && payload.length >= 40) {
		//mean position is cm + 0.1 mm high precision part
		rtk.svin = {
			duration: payload.readUInt32LE(8),
			ecef_x: payload.readInt32LE(12) / 100 + payload.readInt8(24) / 10000,
			ecef_y: payload.readInt32LE(16) / 100 + payload.readInt8(25) / 10000,
			ecef_z: payload.readInt32LE(20) / 100 + payload.readInt8(26) / 10000,
			mean_acc_m: payload.readUInt32LE(28) / 10000,
			obs: payload.readUInt32LE(32),
			valid: payload[36] === 1,
			active: payload[37] === 1,
			time: Date.now(),
		};
	}
	else if (msg_class === ubx.CLASS.ACK && msg_id === ubx.ID.ACK_NAK) {
		console.log('RTK base rejected UBX message class 0x' + payload[0].toString(16) + ' id 0x' + payload[1].toString(16));
	}
};

var rtk_message_handler = function (white_rabbit, data) {
	var ubx = white_rabbit.ubx;
	var rtcm = white_rabbit.rtcm_frame_splitter;
	var port = white_rabbit.rtk_port;
	port.buffer = Buffer.concat([port.buffer, data]);

	while (port.buffer.length > 0) {
		var buf = port.buffer;

		if (buf[0] === ubx.SYNC_1) {
			if (buf.length < 2) {
				break;
			}
			if (buf[1] !== ubx.SYNC_2) {
				port.buffer = buf.slice(1);
				continue;
			}
			if (buf.length < 6) {
				break;
			}

			var payload_length = buf.readUInt16LE(4);
			if (payload_length > UBX_MAX_PAYLOAD) {
				port.buffer = buf.slice(1);
				continue;
			}
			if (buf.length < payload_length + 8) {
				break;
			}

			var ck = ubx.checksum(buf, 2, payload_length + 6);
			if (ck[0] !== buf[payload_length + 6] || ck[1] !== buf[payload_length + 7]) {
				port.buffer = buf.slice(1);
				continue;
			}

			handle_ubx(white_rabbit, buf[2], buf[3], buf.slice(6, payload_length + 6));
			port.buffer = buf.slice(payload_length + 8);
		}
		else if (buf[0] === rtcm.RTCM_PREAMBLE) {
			var rtcm_length = rtcm.frame_length(buf);
			if (rtcm_length === 0) {
				break;
			}
			if (rtcm_length < 0) {
				port.buffer = buf.slice(1);
				continue;
			}

			var frame = Buffer.from(buf.slice(0, rtcm_length));
			port.buffer = buf.slice(rtcm_length);
			white_rabbit.send_rtcm_to_noah(white_rabbit, frame, 'here4_base');
		}
		else {
			//NMEA or junk - skip ahead to the next possible frame start
			var next = 1;
			while (next < buf.length && buf[next] !== ubx.SYNC_1 && buf[next] !== rtcm.RTCM_PREAMBLE) {
				next++;
			}
			port.buffer = buf.slice(next);
		}
	}
};


module.exports = rtk_message_handler;
