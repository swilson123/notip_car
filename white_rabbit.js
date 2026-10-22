/*
#========================================================================================================================================== #
..................................................................Global Variables.........................................................
#========================================================================================================================================== #
*/

var path = require('path');

//Start logging first so every console.log below goes to the log files...
var log = require('./lib/logging/logging.js');

console.log('...................................................White Rabbit Car............................................');

//Fetch setup params......................
var fs = require('fs');
var config = null;

try {
	var data = fs.readFileSync(path.join(__dirname, 'setup.json'));
	config = JSON.parse(data);

} catch (err) {
	console.log('There has been an error reading/parsing the setup JSON.');
	console.log(err);
	process.exit(1);
}

//NTRIP login lives outside setup.json so the password never gets committed (ntrip_credentials.json is in .gitignore)
var ntrip_credentials = {};

try {
	ntrip_credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'ntrip_credentials.json')));
} catch (err) {
	console.log('No ntrip_credentials.json - NTRIP on the car will not connect');
}

//mavlink2.js (same file Noah uses - Noah's parser only accepts MAVLink 2 frames) exports the message namespace and defines the MAVLink parser class as a global
var mavlink = require('./lib/mavlink/mavlink2.js');

var white_rabbit = {
	SerialPort: require('serialport').SerialPort,
	net: require('net'),
	log: log,
	mavlink: mavlink,
	MAVLink: global.MAVLink,
	connect_to_radio: require('./lib/mavlink/connect_to_radio.js'),
	create_mavlink_server: require('./lib/mavlink/create_mavlink_server.js'),
	mavlink_message_handler: require('./lib/mavlink/mavlink_message_handler.js'),
	mavlink_frame_splitter: require('./lib/mavlink/mavlink_frame_splitter.js'),
	send_mavlink_command: require('./lib/mavlink/send_mavlink_command.js'),
	send_compass_heading: require('./lib/mavlink/send_compass_heading.js'),
	imu_connect: require('./lib/imu/imu_connect.js'),
	imu_message_handler: require('./lib/imu/imu_message_handler.js'),
	ubx: require('./lib/rtk/ubx.js'),
	rtk_connect: require('./lib/rtk/rtk_connect.js'),
	rtk_configure: require('./lib/rtk/rtk_configure.js'),
	rtk_message_handler: require('./lib/rtk/rtk_message_handler.js'),
	rtk_set_survey: require('./lib/rtk/rtk_set_survey.js'),
	rtk_base_manager: require('./lib/rtk/rtk_base_manager.js'),
	send_rtcm_to_noah: require('./lib/rtk/send_rtcm_to_noah.js'),
	send_rtk_options_to_noah: require('./lib/rtk/send_rtk_options_to_noah.js'),
	rtcm_frame_splitter: require('./lib/rtk/rtcm_frame_splitter.js'),
	create_ntrip_client: require('./lib/ntrip/create_ntrip_client.js'),
	update_ntrip_location: require('./lib/ntrip/update_ntrip_location.js'),
	ntrip_manager: require('./lib/ntrip/ntrip_manager.js'),
	radio_comName: config.radio_comName,
	radio_baudrate: config.radio_baudrate,
	witmotion_hwt906_comName: config.witmotion_hwt906_comName,
	witmotion_hwt906_baudrate: config.witmotion_hwt906_baudrate,

	//Telemetry radio connected to Noah.......................
	radio_port: {
		comName: null,
		productId: config.radio_productId || 'EA60',
		baudrate: config.radio_baudrate,
		serial: null,
		connecting: false,
		connected: false,
		mavlink: null,
		//Identity used for messages this bridge creates (the compass heading)
		commandSystem: config.bridge_system_id || 255,
		commandComponent: config.bridge_component_id || 158,
		//TCP server Mission Planner connects to.....
		ip_address: config.mission_planner_ip_address || '0.0.0.0',
		port: config.mission_planner_port || 5760,
		server: null,
		mavlink_sockets: [],
	},

	//WitMotion HWT906 IMU..................................
	imu_port: {
		comName: config.witmotion_hwt906_comName,
		productId: config.witmotion_hwt906_productId || '7523',
		baudrate: config.witmotion_hwt906_baudrate,
		serial: null,
		connecting: false,
		connected: false,
		buffer: Buffer.alloc(0),
	},

	//Latest car orientation from the IMU...................
	car: {
		heading: null,		//degrees 0-360, clockwise from north
		roll: null,
		pitch: null,
		yaw: null,			//raw IMU yaw, -180..180
		last_update: 0,
	},

	heading_send_rate_hz: config.heading_send_rate_hz || 5,
	heading_message_name: config.heading_message_name || 'CAR_HDG',
	imu_heading_offset: config.imu_heading_offset || 0,
	imu_heading_reverse: config.imu_heading_reverse !== false,

	//What we hear from Noah..................................
	noah: {
		heading: null,
		system_id: null,
		last_heartbeat: 0,
		gps: null,				//latest GPS_RAW_INT
		ntrip_ok: null,			//Noah's own NTRIP status (NAMED_VALUE_INT "NTRIP_OK")
		ntrip_ok_time: 0,
	},

	//Which RTK correction options are on (rtk_car_ntrip / rtk_noah_ntrip / rtk_here4_base in setup.json, re-read live)
	rtk_options: {
		car_ntrip: config.rtk_car_ntrip === true,
		noah_ntrip: config.rtk_noah_ntrip === true,
		here4_base: config.rtk_here4_base === true,
	},

	//Car NTRIP client (Ohio Real Time Network)..................................
	ntrip: {
		address: config.ntrip_address,
		port_number: config.ntrip_port || 2101,
		mountpoint: config.ntrip_mountpoint,
		username: ntrip_credentials.username,
		password: ntrip_credentials.password,
		client: null,
		connected: false,
		healthy: false,			//corrections arriving right now
		splitter: null,
		GGA: null,				//car position sent to the caster for VRS
		last_location_update: 0,
		last_data_time: 0,
		last_rtcm_time: 0,
		last_close_time: 0,
		bytes: 0,
	},

	//Here 4 Base (u-blox F9P) on USB..................................
	rtk_port: {
		comName: null,
		vendorId: (config.rtk_vendorId || '1546').toLowerCase(),	//u-blox USB vendor id
		baudrate: config.rtk_baudrate || 115200,
		serial: null,
		connecting: false,
		connected: false,
		buffer: Buffer.alloc(0),
	},

	//RTK base state + corrections sent to Noah.......................
	rtk: {
		state: 'disconnected',		//disconnected | rover | waiting_for_stop | surveying | fixed
		pvt: null,					//latest UBX-NAV-PVT from the base
		svin: null,					//latest UBX-NAV-SVIN (survey-in progress)
		stopped_since: 0,
		survey_started: 0,
		last_progress_log: 0,
		base_position: null,		//where the base got fixed (survey-in or NTRIP RTK fix)
		fixed_heading: null,		//car heading when the base position was fixed
		rtcm_seq: 0,
		rtcm_sent: 0,
		rtcm_bytes: 0,
		active_source: null,		//car_ntrip | here4_base - who is feeding Noah right now
		rtcm_messages: config.rtk_rtcm_messages || [1005, 1074, 1084, 1094, 1124, 1230],
		survey_min_seconds: config.rtk_survey_min_seconds || 30,
		survey_accuracy_m: config.rtk_survey_accuracy_m || 2.0,
		stationary_seconds: config.rtk_stationary_seconds || 3,
		moving_speed_mps: config.rtk_moving_speed_mps || 1.0,
		heading_restart_deg: config.rtk_heading_restart_deg !== undefined ? config.rtk_heading_restart_deg : 20,
		ntrip_fix_timeout_seconds: config.rtk_ntrip_fix_timeout_seconds || 60,
	},

};



/*
#========================================================================================================================================== #
..................................................................Mission Planner Server.....................................................
#========================================================================================================================================== #
*/

//Created once at startup so a radio reconnect doesn't try to re-bind the port
white_rabbit.create_mavlink_server(white_rabbit);



/*
#========================================================================================================================================== #
..................................................................Serial -> USB Ports.................................................................
#========================================================================================================================================== #
*/


function update_serialports(show_ports) {
	white_rabbit.SerialPort.list().then(function (ports) {
		ports.forEach(function (port) {
			if (show_ports) {
				console.log(port);
			}

			if (white_rabbit.imu_port.productId == port.productId) {
				if (!white_rabbit.imu_port.connected && !white_rabbit.imu_port.connecting) {
					console.log('IMU Port Found: ' + port.path);
					white_rabbit.imu_port.comName = port.path;
					white_rabbit.imu_connect(white_rabbit);
				}
			}

			if (white_rabbit.radio_port.productId == port.productId) {
				if (!white_rabbit.radio_port.connected && !white_rabbit.radio_port.connecting) {
					console.log('Radio Port Found: ' + port.path);
					white_rabbit.radio_port.comName = port.path;
					white_rabbit.connect_to_radio(white_rabbit);
				}
			}

			if (port.vendorId && white_rabbit.rtk_port.vendorId == port.vendorId.toLowerCase()) {
				if (!white_rabbit.rtk_port.connected && !white_rabbit.rtk_port.connecting) {
					console.log('RTK Base Port Found: ' + port.path);
					white_rabbit.rtk_port.comName = port.path;
					white_rabbit.rtk_connect(white_rabbit);
				}
			}

		});
	}).catch(function (err) {
		console.log('update_serialports error: ', err);
	});
};

//Connect to Serial Ports.........................................................

update_serialports(true);

setInterval(function () {
	//Retry connection...........
	update_serialports(false);

}, 5000);



/*
#========================================================================================================================================== #
..................................................................Send Compass Heading to Noah...............................................
#========================================================================================================================================== #
*/

setInterval(function () {
	white_rabbit.send_compass_heading(white_rabbit);

}, Math.round(1000 / white_rabbit.heading_send_rate_hz));



/*
#========================================================================================================================================== #
..................................................................RTK Corrections -> Noah....................................................
#========================================================================================================================================== #
*/

console.log('RTK options - car NTRIP: ' + white_rabbit.rtk_options.car_ntrip + ', Noah NTRIP: ' + white_rabbit.rtk_options.noah_ntrip +
	', Here 4 base: ' + white_rabbit.rtk_options.here4_base);

//Flip rtk_car_ntrip / rtk_noah_ntrip / rtk_here4_base in setup.json while running - no restart needed
fs.watchFile(path.join(__dirname, 'setup.json'), { interval: 1000 }, function () {
	try {
		var updated = JSON.parse(fs.readFileSync(path.join(__dirname, 'setup.json')));
		var options = {
			car_ntrip: updated.rtk_car_ntrip === true,
			noah_ntrip: updated.rtk_noah_ntrip === true,
			here4_base: updated.rtk_here4_base === true,
		};

		if (JSON.stringify(options) !== JSON.stringify(white_rabbit.rtk_options)) {
			white_rabbit.rtk_options = options;
			console.log('RTK options changed - car NTRIP: ' + options.car_ntrip + ', Noah NTRIP: ' + options.noah_ntrip + ', Here 4 base: ' + options.here4_base);
		}
	} catch (err) {
		console.log('setup.json changed but could not be read: ', err.message);
	}
});

setInterval(function () {
	white_rabbit.ntrip_manager(white_rabbit);
	white_rabbit.rtk_base_manager(white_rabbit);
	white_rabbit.send_rtk_options_to_noah(white_rabbit);

}, 1000);
