var NOAH_ONLINE_STALE_MS = 5000;
var IMU_STALE_MS = 1000;
var POST_TIMEOUT_MS = 10000;

var gps_state = function (fix_type) {
	if (fix_type === 5) {
		return 'rtk_float';
	}
	if (fix_type === 6) {
		return 'rtk_fixed';
	}
	if ((fix_type >= 2 && fix_type <= 4) || fix_type === 7 || fix_type === 8) {
		return 'available';
	}
	return 'unavailable';
};

var post_fleet_state = function (white_rabbit) {
	var atlas = white_rabbit.atlas;

	if (atlas.fleet_state_in_flight) {
		return;
	}

	var now = Date.now();
	var gps = white_rabbit.noah.gps;
	var noah = {
		online: now - white_rabbit.noah.last_heartbeat < NOAH_ONLINE_STALE_MS,
	};

	if (white_rabbit.car.heading !== null && now - white_rabbit.car.last_update <= IMU_STALE_MS) {
		noah.heading = white_rabbit.car.heading;
	}
	if (white_rabbit.noah.battery_percent !== null) {
		noah.battery_percent = white_rabbit.noah.battery_percent;
	}
	if (gps) {
		noah.gps_state = gps_state(gps.fix_type);
		if (gps.lat !== null && gps.lon !== null) {
			noah.latitude = gps.lat;
			noah.longitude = gps.lon;
		}
		if (gps.satellites_visible !== 255) {
			noah.satellite_count = gps.satellites_visible;
		}
		if (gps.h_acc !== null) {
			noah.position_accuracy_m = gps.h_acc;
		}
	}
	if (white_rabbit.noah.current_waypoint_sequence !== null) {
		noah.current_waypoint_sequence = white_rabbit.noah.current_waypoint_sequence;
	}

	var payload = {
		middleware_id: atlas.middleware_id,
		ark_id: atlas.ark_id,
		connected_noah_id: atlas.noah_id,
		noah: noah,
	};
	var headers = { 'Content-Type': 'application/json' };
	if (atlas.middleware_token) {
		headers.Authorization = 'Bearer ' + atlas.middleware_token;
	}

	atlas.fleet_state_in_flight = true;
	fetch(atlas.ingest_url, {
		method: 'POST',
		headers: headers,
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(POST_TIMEOUT_MS),
	})
		.then(function (response) {
			if (!response.ok) {
				console.log('ATLAS fleet state POST failed: HTTP ' + response.status);
				return;
			}
			console.log('ATLAS fleet state POST accepted: HTTP ' + response.status);
		})
		.catch(function (err) {
			var reason = err.message + (err.cause ? ' (' + (err.cause.code || err.cause.message) + ')' : '');
			console.log('ATLAS fleet state POST network error: ' + reason);
		})
		.finally(function () {
			atlas.fleet_state_in_flight = false;
		});
};

module.exports = post_fleet_state;
