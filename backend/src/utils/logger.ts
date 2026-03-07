import winston from 'winston';
import path from 'path';

// Format for log files (JSON with timestamps)
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),  // Include error stack traces
    winston.format.splat(),                   // String interpolation
    winston.format.json()                     // Save as JSON
);

// Format for console (colored, human-readable)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),  // Add colors
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = JSON.stringify(meta, null, 2);
        }
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

// Create the logger
const logger = winston.createLogger({
    // Log level: 'info' in production, 'debug' in development
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // 1. Console (terminal output)
        new winston.transports.Console({
            format: consoleFormat,
        }),
        // 2. Error file (only errors)
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,      // Keep 5 old files
        }),
        // 3. Combined file (all logs)
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exitOnError: false,  // Don't exit on errors
});

// Stream for HTTP request logging (Morgan middleware)
export const loggerStream = {
    write: (message: string) => {
        logger.info(message.trim());
    },
};

export default logger;