var connect_to_radio = function (white_rabbit) {

    if (white_rabbit.radio_port.comName) {
        white_rabbit.radio_port.connecting = true;

        white_rabbit.radio_port.serial = new white_rabbit.SerialPort({
            path: white_rabbit.radio_port.comName,
            baudRate: white_rabbit.radio_port.baudrate
        });

        //When port is open, start up mavlink
        white_rabbit.radio_port.serial.on('open', function () {
            console.log("Mavlink Port is opened");

            //Parser for messages from Noah. Also stamps sysid/compid/seq on messages we create.
            white_rabbit.radio_port.mavlink = new white_rabbit.MAVLink(null, white_rabbit.radio_port.commandSystem, white_rabbit.radio_port.commandComponent);

            //On mavlink port message...........................
            white_rabbit.radio_port.mavlink.on("message", function (message) {
                white_rabbit.mavlink_message_handler(white_rabbit, message);
            });

            white_rabbit.radio_port.connecting = false;
            white_rabbit.radio_port.connected = true;
        });


        //Parse any new incoming data..........................
        white_rabbit.radio_port.serial.on('data', function (data) {

            //forward to groundstation(s)..........
            white_rabbit.radio_port.mavlink_sockets.forEach(function (sock) {
                sock.write(data);
            });

            if (white_rabbit.radio_port.mavlink) {
                try {
                    white_rabbit.radio_port.mavlink.parseBuffer(data);
                } catch (e) {
                    console.log('radio_port mavlink parse error: ', e.message);
                }
            }
        });


        var radio_lost = function (e) {
            console.log("radio_port closed: ", e ? e.message : '');
            white_rabbit.radio_port.serial = null;
            white_rabbit.radio_port.mavlink = null;
            white_rabbit.radio_port.connecting = false;
            white_rabbit.radio_port.connected = false;
        };

        white_rabbit.radio_port.serial.on('close', radio_lost);
        white_rabbit.radio_port.serial.on('error', radio_lost);

    }
    else {
        console.log('Missing radio port');
    }

};


module.exports = connect_to_radio;
