//Set the Here 4 Base up as an RTK base on its USB port (RAM only - same job Mission Planner's RTK Inject page does)
var rtk_configure = function (white_rabbit) {
	var ubx = white_rabbit.ubx;
	var rtk = white_rabbit.rtk;
	var serial = white_rabbit.rtk_port.serial;

	if (!serial) {
		return;
	}

	var items = [
		{ key: ubx.KEY.USBINPROT_RTCM3X, value: 1 },
		{ key: ubx.KEY.USBOUTPROT_UBX, value: 1 },
		{ key: ubx.KEY.USBOUTPROT_RTCM3X, value: 1 },
		{ key: ubx.KEY.USBOUTPROT_NMEA, value: 0 },
		{ key: ubx.KEY.RATE_MEAS, value: 1000 },
		{ key: ubx.KEY.MSGOUT_NAV_PVT_USB, value: 1 },
		{ key: ubx.KEY.MSGOUT_NAV_SVIN_USB, value: 1 },
		//Start as a rover so we can tell if the car is still moving before setting up the base
		{ key: ubx.KEY.TMODE_MODE, value: 0 },
	];

	//Turn on the RTCM messages we want and off any others, to keep the radio link to Noah lean
	Object.keys(ubx.RTCM_USB_KEY).forEach(function (type) {
		var rate = 0;
		if (rtk.rtcm_messages.indexOf(Number(type)) !== -1) {
			rate = (type === '1230') ? 5 : 1;
		}
		items.push({ key: ubx.RTCM_USB_KEY[type], value: rate });
	});

	serial.write(ubx.valset(items));

	rtk.state = white_rabbit.rtk_options.here4_base ? 'waiting_for_stop' : 'rover';
	rtk.stopped_since = 0;
	rtk.pvt = null;
	rtk.svin = null;
	rtk.base_position = null;
	rtk.fixed_heading = null;

	console.log('RTK base configured, RTCM messages: ' + rtk.rtcm_messages.join(', '));
};


module.exports = rtk_configure;
