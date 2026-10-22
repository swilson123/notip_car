//Runs once a second: keeps the car's NTRIP client connected while rtk_car_ntrip is on, and closed while it's off
var RECONNECT_MS = 3000;
var STALE_MS = 15000;			//no bytes from the caster this long -> reconnect
var HEALTHY_MS = 5000;			//corrections within this long -> car NTRIP is the active source
var LOCATION_UPDATE_MS = 10000;

var ntrip_manager = function (white_rabbit) {
	var ntrip = white_rabbit.ntrip;
	var now = Date.now();

	white_rabbit.update_ntrip_location(white_rabbit);

	ntrip.healthy = white_rabbit.rtk_options.car_ntrip && ntrip.connected && now - ntrip.last_rtcm_time < HEALTHY_MS;

	if (!white_rabbit.rtk_options.car_ntrip) {
		if (ntrip.client) {
			console.log('NTRIP on the car turned off');
			ntrip.client.destroy();
		}
		return;
	}

	if (!ntrip.client) {
		if (now - ntrip.last_close_time > RECONNECT_MS) {
			white_rabbit.create_ntrip_client(white_rabbit);
		}
		return;
	}

	if (now - ntrip.last_data_time > STALE_MS) {
		console.log('NTRIP stream went quiet, reconnecting');
		ntrip.client.destroy();
		return;
	}

	//VRS mount points follow the rover - keep the caster up to date with where the car is
	if (ntrip.connected && ntrip.GGA && now - ntrip.last_location_update > LOCATION_UPDATE_MS) {
		ntrip.client.write(ntrip.GGA);
		ntrip.last_location_update = now;
	}
};


module.exports = ntrip_manager;
