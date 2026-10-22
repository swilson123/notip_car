//Tell Noah whether to run its own NTRIP client: NAMED_VALUE_INT "NTRIP_EN" 1 = on, 0 = off (follows rtk_noah_ntrip)
var send_rtk_options_to_noah = function (white_rabbit) {
	if (!white_rabbit.radio_port.connected || !white_rabbit.radio_port.mavlink) {
		return;
	}

	var time_boot_ms = (Date.now() - white_rabbit.radio_port.mavlink.startup_time) >>> 0;

	var request = new white_rabbit.mavlink.messages.named_value_int(
		time_boot_ms,
		'NTRIP_EN',
		white_rabbit.rtk_options.noah_ntrip ? 1 : 0
	);

	white_rabbit.send_mavlink_command(white_rabbit, null, request);
};


module.exports = send_rtk_options_to_noah;
