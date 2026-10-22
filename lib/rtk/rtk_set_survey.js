//Switch the Here 4 between:
//  'rover'  - normal GPS (TMODE disabled), used while driving
//  'survey' - survey-in its own position (TMODE disabled then survey-in throws away the old survey and starts fresh)
//  'fixed'  - base at a known position, here the Here 4's own RTK fixed position from car NTRIP
var rtk_set_survey = function (white_rabbit, mode, position) {
	var ubx = white_rabbit.ubx;
	var rtk = white_rabbit.rtk;
	var serial = white_rabbit.rtk_port.serial;

	if (!serial || !white_rabbit.rtk_port.connected) {
		return;
	}

	serial.write(ubx.valset([{ key: ubx.KEY.TMODE_MODE, value: 0 }]));

	rtk.stopped_since = 0;
	rtk.svin = null;
	rtk.base_position = null;
	rtk.fixed_heading = null;

	if (mode === 'survey') {
		serial.write(ubx.valset([
			{ key: ubx.KEY.TMODE_SVIN_MIN_DUR, value: rtk.survey_min_seconds },
			{ key: ubx.KEY.TMODE_SVIN_ACC_LIMIT, value: Math.round(rtk.survey_accuracy_m * 10000) },
			{ key: ubx.KEY.TMODE_MODE, value: 1 },
		]));

		rtk.state = 'surveying';
		rtk.survey_started = Date.now();
		console.log('RTK survey-in started (min ' + rtk.survey_min_seconds + 's, accuracy ' + rtk.survey_accuracy_m + 'm)');
	}
	else if (mode === 'fixed') {
		serial.write(ubx.valset([
			{ key: ubx.KEY.TMODE_POS_TYPE, value: 1 },
			{ key: ubx.KEY.TMODE_LAT, value: Math.round(position.lat * 1e7) },
			{ key: ubx.KEY.TMODE_LON, value: Math.round(position.lon * 1e7) },
			{ key: ubx.KEY.TMODE_HEIGHT, value: Math.round(position.height_m * 100) },
			{ key: ubx.KEY.TMODE_FIXED_POS_ACC, value: Math.round(position.h_acc_m * 10000) },
			{ key: ubx.KEY.TMODE_MODE, value: 2 },
		]));

		rtk.state = 'fixed';
		rtk.base_position = { lat: position.lat, lon: position.lon, height_m: position.height_m, accuracy_m: position.h_acc_m, source: 'car_ntrip' };
		console.log('RTK base position fixed from NTRIP RTK fix, accuracy ' + position.h_acc_m.toFixed(3) + 'm (' +
			position.lat.toFixed(8) + ', ' + position.lon.toFixed(8) + ')');
	}
	else {
		rtk.state = white_rabbit.rtk_options.here4_base ? 'waiting_for_stop' : 'rover';
		console.log('RTK Here 4 in rover mode' + (rtk.state === 'waiting_for_stop' ? ', waiting for the car to stop' : ''));
	}
};


module.exports = rtk_set_survey;
