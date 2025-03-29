const { Environment } = require('./environment');
;

/**
 * Allowed values for LOGGING_SEVERITY from lowest to highest are:
 * - DEBUG
 * - INFO
 * - FINE
 * - FINER
 * - FINEST
 */

const { LOGGING_SEVERITY_LEVEL } = process.env;

class Logging {

    constructor() {}

    /**
     * function that accepts an String. and compares it to the LOGGING_SEVERITY_LEVEL
     * 
     * return true if the string is a equal to or higher than the LOGGING_SEVERITY_LEVEL, otherwise return false
     */
    static isSeverityLevel(severity) {
        let environment = new Environment().getEnvironment();

        const severityLevels = ['DEBUG', 'INFO', 'FINE', 'FINER', 'FINEST'];

        // create set of severity levels to print
        const severitySet = new Set(severityLevels.slice(0, severityLevels.indexOf(environment.LOGGING_SEVERITY_LEVEL) + 1));

        return severitySet.has(severity);
    }
    
    /*
    Create a debug message in a function.
    - function must take an object as a parameter
    - the object must have the following properties:  message
    - optional properties: location, severity
    - the function must use the current UTC time and create a timestamp in the format: YYYY-MM-DDTHH:MM:SS.mmmZ
    - if the object has no location, the location section be omitted from the message
    - the default severity is DEBUG

    - the function must print the message to the console in the following format:
    Format: <timestamp>|<debug_serverity>|<location>|<message>

    */

    static debugMessage(messageObject) {
        const timestamp = new Date().toISOString();
        const debugSeverity = messageObject.severity || 'DEBUG';
        const location = messageObject.location;
        const message = messageObject.message;

        const messageComponents = [timestamp, debugSeverity];
        if(location) {
          messageComponents.push(location);
        }
        if(message) {
          messageComponents.push(message);
        }

        // if the severity level is not high enough, do not print the message
        if(!this.isSeverityLevel(debugSeverity)) {return;}

        // print the message
        console.log(messageComponents.join('|'));
    }
}

module.exports = { Logging };
