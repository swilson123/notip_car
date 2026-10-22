//Build an NMEA GGA sentence for the NTRIP caster - VRS mount points need the car's position to make the corrections.
//Position comes from the Here 4, or from Noah's GPS if the Here 4 isn't plugged in.
var PVT_STALE_MS = 3000;
var NOAH_GPS_STALE_MS = 5000;

var pad = function (n, width) {
	var s = String(n);
	while (s.length < width) {
		s = '0' + s;
	}
	return s;
};

var nmea_coordinate = function (degrees, deg_width) {
	var abs = Math.abs(degrees);
	var d = Math.floor(abs);
	var minutes = (abs - d) * 60;
	return pad(d, deg_width) + (minutes < 10 ? '0' : '') + minutes.toFixed(6);
};

var create_gga = function (p) {
	var body = 'GPGGA,' +
		pad(p.hour, 2) + pad(p.min, 2) + pad(p.sec, 2) + '.00,' +
		nmea_coordinate(p.lat, 2) + ',' + (p.lat >= 0 ? 'N' : 'S') + ',' +
		nmea_coordinate(p.lon, 3) + ',' + (p.lon >= 0 ? 'E' : 'W') + ',' +
		p.quality + ',' + pad(Math.min(p.num_sv, 99), 2) + ',' + p.hdop.toFixed(1) + ',' +
		p.hmsl_m.toFixed(3) + ',M,' + p.geoid_sep_m.toFixed(3) + ',M,,';

	var cs = 0;
	for (var i = 0; i < body.length; i++) {
		cs ^= body.charCodeAt(i);
	}
	return '$' + body + '*' + pad(cs.toString(16).toUpperCase(), 2) + '\r\n';
};

var update_ntrip_location = function (white_rabbit) {
	var pvt = white_rabbit.rtk.pvt;
	var noah = white_rabbit.noah;
	var now = Date.now();
	var position = null;

	if (pvt && now - pvt.time < PVT_STALE_MS && pvt.fix_type >= 2) {
		position = {
			hour: pvt.hour, min: pvt.min, sec: pvt.sec,
			lat: pvt.lat, lon: pvt.lon,
			quality: pvt.carr_soln === 2 ? 4 : (pvt.carr_soln === 1 ? 5 : 1),
			num_sv: pvt.num_sv,
			hdop: pvt.pdop || 1.0,
			hmsl_m: pvt.hmsl_m,
			geoid_sep_m: pvt.height_m - pvt.hmsl_m,
		};
	}
	else if (noah.gps && now - noah.gps.time < NOAH_GPS_STALE_MS && noah.gps.fix_type >= 2) {
		var t = new Date();
		position = {
			hour: t.getUTCHours(), min: t.getUTCMinutes(), sec: t.getUTCSeconds(),
			lat: noah.gps.lat, lon: noah.gps.lon,
			quality: 1,
			num_sv: noah.gps.satellites_visible,
			hdop: 1.0,
			hmsl_m: noah.gps.alt_m,
			geoid_sep_m: 0,
		};
	}

	if (position) {
		white_rabbit.ntrip.GGA = create_gga(position);
	}
};


module.exports = update_ntrip_location;
