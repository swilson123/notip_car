//End the current mission upload (success when err is null) and tell whoever started it
var mission_upload_finish = function (white_rabbit, err) {
	var upload = white_rabbit.mission_upload_state;

	if (!upload.active) {
		return;
	}

	clearInterval(upload.timer);
	upload.active = false;
	upload.timer = null;

	var done = upload.done;
	upload.done = null;
	if (done) {
		done(err);
	}
};


module.exports = mission_upload_finish;
