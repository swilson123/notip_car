//u-blox UBX protocol helpers for the Here 4 Base (u-blox F9P, gen9 CFG-VALSET configuration interface)
//Frame: [0xB5][0x62][class][id][length U2 LE][payload][ck_a][ck_b], Fletcher-8 checksum over class..payload
var SYNC_1 = 0xB5;
var SYNC_2 = 0x62;

var CLASS = {
	NAV: 0x01,
	ACK: 0x05,
	CFG: 0x06,
};

var ID = {
	NAV_PVT: 0x07,
	NAV_SVIN: 0x3B,
	ACK_NAK: 0x00,
	ACK_ACK: 0x01,
	CFG_VALSET: 0x8A,
};

//Configuration keys (u-blox F9P HPG interface description). Value size is encoded in bits 28-30 of the key.
var KEY = {
	USBINPROT_RTCM3X: 0x10770004,		//accept NTRIP corrections from us
	USBOUTPROT_UBX: 0x10780001,
	USBOUTPROT_NMEA: 0x10780002,
	USBOUTPROT_RTCM3X: 0x10780004,
	RATE_MEAS: 0x30210001,				//ms between measurements
	MSGOUT_NAV_PVT_USB: 0x20910009,
	MSGOUT_NAV_SVIN_USB: 0x2091008b,
	TMODE_MODE: 0x20030001,				//0 = disabled (rover), 1 = survey-in, 2 = fixed
	TMODE_POS_TYPE: 0x20030002,			//0 = ECEF, 1 = lat/lon/height
	TMODE_LAT: 0x40030009,				//1e-7 deg
	TMODE_LON: 0x4003000a,				//1e-7 deg
	TMODE_HEIGHT: 0x4003000b,			//cm above ellipsoid
	TMODE_FIXED_POS_ACC: 0x4003000f,	//0.1 mm
	TMODE_SVIN_MIN_DUR: 0x40030010,		//seconds
	TMODE_SVIN_ACC_LIMIT: 0x40030011,	//0.1 mm
};

//RTCM3 message number -> CFG-MSGOUT key for the USB port
var RTCM_USB_KEY = {
	1005: 0x209102c0,	//base station position
	1074: 0x20910361,	//GPS MSM4
	1077: 0x209102cf,	//GPS MSM7
	1084: 0x20910366,	//GLONASS MSM4
	1087: 0x209102d4,	//GLONASS MSM7
	1094: 0x2091036b,	//Galileo MSM4
	1097: 0x2091031b,	//Galileo MSM7
	1124: 0x20910370,	//BeiDou MSM4
	1127: 0x209102d9,	//BeiDou MSM7
	1230: 0x20910306,	//GLONASS code-phase biases
};

var LAYER_RAM = 0x01;

var checksum = function (buf, start, end) {
	var ck_a = 0;
	var ck_b = 0;
	for (var i = start; i < end; i++) {
		ck_a = (ck_a + buf[i]) & 0xFF;
		ck_b = (ck_b + ck_a) & 0xFF;
	}
	return [ck_a, ck_b];
};

var build = function (msg_class, msg_id, payload) {
	var frame = Buffer.alloc(payload.length + 8);
	frame[0] = SYNC_1;
	frame[1] = SYNC_2;
	frame[2] = msg_class;
	frame[3] = msg_id;
	frame.writeUInt16LE(payload.length, 4);
	payload.copy(frame, 6);

	var ck = checksum(frame, 2, payload.length + 6);
	frame[payload.length + 6] = ck[0];
	frame[payload.length + 7] = ck[1];
	return frame;
};

//items: [{key: KEY.X, value: n}, ...]. Written to RAM only, so the unit goes back to its saved setup on power cycle.
var valset = function (items) {
	var parts = [Buffer.from([0x00, LAYER_RAM, 0x00, 0x00])];

	items.forEach(function (item) {
		var size = [0, 1, 1, 2, 4, 8][(item.key >>> 28) & 0x07];
		var entry = Buffer.alloc(4 + size);
		entry.writeUInt32LE(item.key >>> 0, 0);
		if (size === 1) {
			entry.writeUInt8(item.value & 0xFF, 4);
		}
		else if (size === 2) {
			entry.writeUInt16LE(item.value & 0xFFFF, 4);
		}
		else if (size === 4) {
			entry.writeUInt32LE(item.value >>> 0, 4);
		}
		else if (size === 8) {
			entry.writeBigUInt64LE(BigInt(item.value), 4);
		}
		parts.push(entry);
	});

	return build(CLASS.CFG, ID.CFG_VALSET, Buffer.concat(parts));
};


module.exports = {
	SYNC_1: SYNC_1,
	SYNC_2: SYNC_2,
	CLASS: CLASS,
	ID: ID,
	KEY: KEY,
	RTCM_USB_KEY: RTCM_USB_KEY,
	checksum: checksum,
	build: build,
	valset: valset,
};
