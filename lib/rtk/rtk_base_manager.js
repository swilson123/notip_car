//Runs once a second. Gets the base station position locked in as fast as possible after the car parks:
//  waiting_for_stop -> car stopped for rtk_stationary_seconds ->
//      Here 4 has an RTK fixed position from car NTRIP -> fixed at that position (cm absolute, no survey needed)
//      no car NTRIP (or no RTK fix within rtk_ntrip_fix_timeout_seconds) -> surveying -> survey valid -> fixed
//  surveying + car moves -> waiting_for_stop (survey of a moving antenna is useless)
//  fixed + IMU heading changes -> waiting_for_stop (car has driven off, the old base position is wrong)
//  rtk_here4_base off -> rover (Here 4 is just a GPS for the NTRIP location updates)
//The receiver keeps tracking satellites the whole drive so it's warm and converges quickly on arrival.
var PVT_STALE_MS = 3000;
var IMU_STALE_MS = 1000;
var PROGRESS_LOG_MS = 5000;
var RTK_FIXED = 2;

var heading_difference = function (a, b) {
	var d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
};

var rtk_base_manager = function (white_rabbit) {
	var rtk = white_rabbit.rtk;
	var now = Date.now();

	if (!white_rabbit.rtk_port.connected || rtk.state === 'disconnected') {
		return;
	}

	//Toggle changed..........................
	if (!white_rabbit.rtk_options.here4_base) {
		if (rtk.state !== 'rover') {
			console.log('Here 4 base station turned off');
			white_rabbit.rtk_set_survey(white_rabbit, 'rover');
		}
		return;
	}
	if (rtk.state === 'rover') {
		console.log('Here 4 base station turned on');
		rtk.state = 'waiting_for_stop';
		rtk.stopped_since = 0;
	}

	var pvt = rtk.pvt;
	var pvt_fresh = pvt && now - pvt.time < PVT_STALE_MS;
	//Only call it moving when the speed is bigger than the receiver's own speed uncertainty (poor sky view = noisy speed)
	var moving = pvt_fresh && pvt.g_speed_mps > rtk.moving_speed_mps && pvt.g_speed_mps > pvt.s_acc_mps;
	var rtk_fixed = pvt_fresh && pvt.carr_soln === RTK_FIXED;
	var car = white_rabbit.car;
	var imu_fresh = car.heading !== null && now - car.last_update < IMU_STALE_MS;

	if (rtk.state === 'waiting_for_stop') {
		if (pvt_fresh && pvt.fix_type >= 3 && !moving) {
			if (!rtk.stopped_since) {
				rtk.stopped_since = now;
			}

			var stopped_ms = now - rtk.stopped_since;
			if (stopped_ms >= rtk.stationary_seconds * 1000) {
				if (rtk_fixed) {
					white_rabbit.rtk_set_survey(white_rabbit, 'fixed', pvt);
					rtk.fixed_heading = imu_fresh ? car.heading : null;
				}
				else if (!white_rabbit.ntrip.healthy || stopped_ms >= (rtk.stationary_seconds + rtk.ntrip_fix_timeout_seconds) * 1000) {
					white_rabbit.rtk_set_survey(white_rabbit, 'survey');
				}
				else if (now - rtk.last_progress_log > PROGRESS_LOG_MS) {
					rtk.last_progress_log = now;
					console.log('RTK waiting for Here 4 RTK fix from car NTRIP (' + (pvt.carr_soln === 1 ? 'float' : 'no RTK') + ', ' + pvt.num_sv + ' sats)');
				}
			}
		}
		else {
			rtk.stopped_since = 0;
		}
	}
	else if (rtk.state === 'surveying') {
		var svin = rtk.svin;
		//Ignore a NAV-SVIN from before the restart (its duration would be longer than this survey has run)
		var svin_current = svin && svin.time > rtk.survey_started && svin.duration <= (now - rtk.survey_started) / 1000 + 2;

		if (moving) {
			console.log('RTK survey-in aborted, car is moving (' + pvt.g_speed_mps.toFixed(2) + ' m/s)');
			white_rabbit.rtk_set_survey(white_rabbit, 'rover');
		}
		else if (rtk_fixed) {
			//Car NTRIP came through mid-survey - its RTK position beats the survey
			white_rabbit.rtk_set_survey(white_rabbit, 'fixed', pvt);
			rtk.fixed_heading = imu_fresh ? car.heading : null;
		}
		else if (svin_current && svin.valid) {
			rtk.state = 'fixed';
			rtk.base_position = { ecef_x: svin.ecef_x, ecef_y: svin.ecef_y, ecef_z: svin.ecef_z, accuracy_m: svin.mean_acc_m, source: 'survey' };
			rtk.fixed_heading = imu_fresh ? car.heading : null;
			console.log('RTK base position fixed after ' + ((now - rtk.survey_started) / 1000).toFixed(0) + 's survey-in, accuracy ' +
				svin.mean_acc_m.toFixed(3) + 'm (' + pvt.lat.toFixed(7) + ', ' + pvt.lon.toFixed(7) + ')');
		}
		else if (svin_current && now - rtk.last_progress_log > PROGRESS_LOG_MS) {
			rtk.last_progress_log = now;
			console.log('RTK survey-in: ' + svin.duration + 's, accuracy ' + svin.mean_acc_m.toFixed(2) + 'm, ' +
				(pvt_fresh ? pvt.num_sv : '?') + ' sats, ' + rtk.rtcm_sent + ' RTCM msgs sent to Noah');
		}
	}
	else if (rtk.state === 'fixed') {
		if (rtk.heading_restart_deg > 0 && imu_fresh) {
			if (rtk.fixed_heading === null) {
				rtk.fixed_heading = car.heading;
			}
			else if (heading_difference(car.heading, rtk.fixed_heading) > rtk.heading_restart_deg) {
				console.log('RTK car heading changed ' + heading_difference(car.heading, rtk.fixed_heading).toFixed(0) + ' deg, car has moved');
				white_rabbit.rtk_set_survey(white_rabbit, 'rover');
			}
		}
	}
};


module.exports = rtk_base_manager;
