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

//mavlink.js exports the message namespace and defines the MAVLink parser class as a global
var mavlink = require('./lib/mavlink/mavlink.js');

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
