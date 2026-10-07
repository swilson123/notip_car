//Splits a raw byte stream into complete MAVLink v1 (0xFE) or v2 (0xFD) frames.
//Frames are passed through untouched (no CRC check) - we only need to know where each one ends.
var mavlink_frame_splitter = function () {
	var buf = Buffer.alloc(0);

	return {
		push: function (data) {
			var frames = [];
			buf = Buffer.concat([buf, data]);

			while (buf.length > 0) {
				var start = 0;
				while (start < buf.length && buf[start] !== 0xFE && buf[start] !== 0xFD) {
					start++;
				}
				if (start > 0) {
					//Drop junk before the next frame start
					buf = buf.slice(start);
					continue;
				}
				if (buf.length < 3) {
					break;
				}

				var frame_length;
				if (buf[0] === 0xFE) {
					frame_length = buf[1] + 8;	//6 header + payload + 2 crc
				}
				else {
					frame_length = buf[1] + 12 + ((buf[2] & 0x01) ? 13 : 0);	//10 header + payload + 2 crc (+13 signature)
				}

				if (buf.length < frame_length) {
					break;
				}

				frames.push(buf.slice(0, frame_length));
				buf = buf.slice(frame_length);
			}

			return frames;
		}
	};
};


module.exports = mavlink_frame_splitter;
