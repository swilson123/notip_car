//Noah armed with groundstation = "atlas": pull the latest Atlas dispatch and upload its waypoints to Noah's Pixhawk.
//The Raspberry Pi then downloads the mission from the Pixhawk. MSN_RDY tells it when: waypoint count on success, 0 on failure.
//If anything fails the Pixhawk's mission is cleared, so Noah can't run the previous house's mission by mistake.

//Turn the dispatch into mission items, or throw if it isn't usable
var dispatch_to_items = function (white_rabbit, dispatch) {
	var atlas = white_rabbit.atlas;

	if (!dispatch || dispatch.error) {
		throw new Error('dispatch has an error: ' + JSON.stringify(dispatch && dispatch.error));
	}

	var payload = dispatch.payload || {};
	if (atlas.noah_id && payload.noah_id !== atlas.noah_id) {
		throw new Error('dispatch is for ' + payload.noah_id + ', this Noah is ' + atlas.noah_id);
	}
	if (atlas.ark_id && payload.ark_id !== atlas.ark_id) {
		throw new Error('dispatch is for ' + payload.ark_id + ', this car is ' + atlas.ark_id);
	}
	if (!Array.isArray(payload.waypoints) || payload.waypoints.length === 0) {
		throw new Error('dispatch has no waypoints');
	}

	var waypoints = payload.waypoints.slice().sort(function (a, b) {
		return a.sequence - b.sequence;
	});

	var items = waypoints.map(function (wp) {
		var lat = Number(wp.latitude);
		var lon = Number(wp.longitude);
		if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) {
			throw new Error('bad waypoint ' + JSON.stringify(wp));
		}
		var alt = isFinite(Number(wp.altitude)) && wp.altitude !== null ? Number(wp.altitude) : atlas.default_altitude_m;
		return { lat: lat, lon: lon, alt: alt };
	});

	//Item 0 is home - ArduPilot replaces it with its own home position
	return [items[0]].concat(items);
};

//Sent MSN_RDY_REPEATS times so one lost radio packet can't strand Noah. Same time_boot_ms on every copy - Noah handles it once.
var MSN_RDY_REPEATS = 5;
var MSN_RDY_INTERVAL_MS = 1000;

var send_mission_ready = function (white_rabbit, count) {
	var time_boot_ms = (Date.now() - white_rabbit.radio_port.mavlink.startup_time) >>> 0;
	var sent = 0;

	var send = function () {
		if (white_rabbit.radio_port.connected && white_rabbit.radio_port.mavlink) {
			var request = new white_rabbit.mavlink.messages.named_value_int(time_boot_ms, 'MSN_RDY', count);
			white_rabbit.send_mavlink_command(white_rabbit, null, request);
		}
		sent++;
		if (sent < MSN_RDY_REPEATS) {
			setTimeout(send, MSN_RDY_INTERVAL_MS);
		}
	};

	send();
};

var mission_failed = function (white_rabbit, err) {
	console.log('ATLAS mission NOT sent to Noah: ' + err.message);

	if (white_rabbit.radio_port.connected && white_rabbit.radio_port.mavlink && white_rabbit.noah.system_id) {
		console.log('ATLAS clearing the mission on Noah');
		var request = new white_rabbit.mavlink.messages.mission_clear_all(white_rabbit.noah.system_id, 1, 0);
		white_rabbit.send_mavlink_command(white_rabbit, null, request);
		send_mission_ready(white_rabbit, 0);
	}
	white_rabbit.atlas.busy = false;
};

var atlas_dispatch_to_noah = function (white_rabbit) {
	var atlas = white_rabbit.atlas;

	if (atlas.busy) {
		console.log('ATLAS already sending a mission, ignoring arm');
		return;
	}
	atlas.busy = true;

	console.log('ATLAS Noah armed - fetching latest dispatch');

	white_rabbit.fetch_atlas_dispatch(white_rabbit, function (err, dispatch) {
		if (err) {
			mission_failed(white_rabbit, new Error('could not fetch dispatch: ' + err.message));
			return;
		}

		var items;
		try {
			items = dispatch_to_items(white_rabbit, dispatch);
		} catch (e) {
			mission_failed(white_rabbit, e);
			return;
		}

		console.log('ATLAS dispatch ' + dispatch.dispatch_id + ' (' + (dispatch.payload.address || 'no address') + ', revision ' +
			dispatch.mission_revision_id + ', dispatched ' + dispatch.payload.dispatched_at + ') - uploading ' + (items.length - 1) + ' waypoints');

		white_rabbit.mission_upload(white_rabbit, items, function (upload_err) {
			if (upload_err) {
				mission_failed(white_rabbit, upload_err);
				return;
			}

			console.log('ATLAS mission accepted by Noah: ' + (items.length - 1) + ' waypoints from dispatch ' + dispatch.dispatch_id);
			atlas.last_dispatch_id = dispatch.dispatch_id;
			send_mission_ready(white_rabbit, items.length - 1);
			atlas.busy = false;
		});
	});
};


module.exports = atlas_dispatch_to_noah;
