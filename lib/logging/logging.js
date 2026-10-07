'use strict';

require('winston-daily-rotate-file');

var util = require('util'),
    fs = require('fs'),
    path = require('path'),
    winston = require('winston'),
    production = (process.env.NODE_ENV || '').toLowerCase() === 'production';

var logdir = path.join(__dirname, '..', '..', 'logger');

// create dir recursively if it does not exist!
fs.mkdirSync(logdir, { recursive: true });

var line_format = winston.format.printf(function (info) {
    return info.timestamp + ' ' + info.level + ': ' + info.message;
});

var logger = winston.createLogger({
    level: 'info',
    exitOnError: false,
    transports: [
        // write to a daily rotating file log
        new winston.transports.DailyRotateFile({
            dirname: logdir,
            filename: '%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
            handleExceptions: true,
            format: winston.format.combine(winston.format.timestamp(), line_format)
        }),

        // output log entries to console
        new winston.transports.Console({
            handleExceptions: true,
            format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), line_format)
        })
    ]
});

module.exports = {
    logger: logger,
    middleware: function(req, res, next){
        console.info(req.method, req.url, res.statusCode);
        next();
    },
    production: production
};


function formatArgs(args){
    return util.format.apply(util, Array.prototype.slice.call(args));
}

console.log = function(){
    logger.info(formatArgs(arguments));
};
console.info = function(){
    logger.info(formatArgs(arguments));
};
console.warn = function(){
    logger.warn(formatArgs(arguments));
};
console.error = function(){
    logger.error(formatArgs(arguments));
};
console.debug = function(){
    logger.debug(formatArgs(arguments));
};
