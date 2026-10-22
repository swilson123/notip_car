//Send one RTCM3 frame to Noah as GPS_RTCM_DATA (same as Mission Planner's RTK inject).
//Frames over 180 bytes are split into up to 4 fragments: flags = fragmented bit | fragment id << 1 | sequence id << 3
//Only one correction source reaches Noah at a time - mixing two reference stations confuses its GPS.
var MAX_FRAGMENT_LENGTH = 180;
var MAX_FRAGMENTS = 4;
var NOAH_NTRIP_STALE_MS = 10000;

//Is this source allowed to feed Noah right now?
var source_allowed = function (white_rabbit, source) {
	var options = white_rabbit.rtk_options;
	var noah = white_rabbit.noah;
	var now = Date.now();

	//Noah running its own NTRIP: stay off the link unless Noah says its NTRIP is down (NTRIP_OK = 0, or it stopped reporting)
	if (options.noah_ntrip) {
		var noah_ntrip_down = noah.ntrip_ok_time > 0 && (noah.ntrip_ok === 0 || now - noah.ntrip_ok_time > NOAH_NTRIP_STALE_MS);
		if (!noah_ntrip_down) {
			return false;
		}
	}

	if (source === 'car_ntrip') {
		return options.car_ntrip;
	}

	if (source === 'here4_base') {
		//Car NTRIP wins when it's delivering - the Here 4 is the backup
		return options.here4_base && !(options.car_ntrip && white_rabbit.ntrip.healthy);
	}

	return false;
};

var send_fragment = function (white_rabbit, flags, chunk) {
	//jspack packs the data field from a string, one char per byte
	var request = new white_rabbit.mavlink.messages.gps_rtcm_data(flags, chunk.length, chunk.toString('latin1'));
	white_rabbit.send_mavlink_command(white_rabbit, null, request);
};

var send_message = function (white_rabbit, data) {
	var rtk = white_rabbit.rtk;
	var seq = rtk.rtcm_seq;
	rtk.rtcm_seq = (rtk.rtcm_seq + 1) & 0x1F;

	if (data.length <= MAX_FRAGMENT_LENGTH) {
		send_fragment(white_rabbit, seq << 3, data);
		return;
	}

	var fragment = 0;
	for (var i = 0; i < data.length; i += MAX_FRAGMENT_LENGTH) {
		send_fragment(white_rabbit, 1 | (fragment << 1) | (seq << 3), data.slice(i, i + MAX_FRAGMENT_LENGTH));
		fragment++;
	}

	//ArduPilot only knows the message is complete when it sees a short fragment (or all 4)
	if (data.length % MAX_FRAGMENT_LENGTH === 0 && fragment < MAX_FRAGMENTS) {
		send_fragment(white_rabbit, 1 | (fragment << 1) | (seq << 3), Buffer.alloc(0));
	}
};

var send_rtcm_to_noah = function (white_rabbit, frame, source) {
	var rtk = white_rabbit.rtk;

	if (!white_rabbit.radio_port.connected || !white_rabbit.radio_port.mavlink) {
		return;
	}

	if (!source_allowed(white_rabbit, source)) {
		return;
	}

	if (rtk.active_source !== source) {
		console.log('RTK corrections to Noah now from: ' + source);
		rtk.active_source = source;
	}

	//ArduPilot streams the bytes straight into its GPS, so a frame too big for one GPS_RTCM_DATA set can go as several
	var max = MAX_FRAGMENT_LENGTH * MAX_FRAGMENTS;
	for (var i = 0; i < frame.length; i += max) {
		send_message(white_rabbit, frame.slice(i, i + max));
	}

	rtk.rtcm_sent++;
	rtk.rtcm_bytes += frame.length;
};


module.exports = send_rtcm_to_noah;
