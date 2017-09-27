// IoT Agent Enschede Parking Service

'use strict';

var async = require('async'),
    request = require('request'),
    parkings = require('../etc/parkings.json'),
    vialis = require('../etc/vialis.json'),
    apply = async.apply,
    context = {
        op: 'IoTAgentEPS.Agent'
    },
    config = require('./configService');

/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {
    config.setConfig(newConfig);
    var logger = require('logops');
    logger.format = logger.formatters.pipe;
    config.setLogger(logger);
    updateParkingGarageContext(function updateCallback(error) {
        callback(error);
    });
}

// http://opd.it-t.nl/data/parkingdata/v1/twente/dynamic/
// Enschede P Mooienhof.json
// Enschede P R Zuiderval.json [JR] P6 P&R
// Enschede P1 van Heek .json
// Enschede P2 Stationsplein.json
// Enschede P3 Irene.json
// Enschede P4 Q-park Enschede.json
// Enschede P5 Hermandad.json

function updateParkingGarageContext(callback) {
    config.getLogger().info(context, 'Update Parking Garage Context');
    var tasks = [];
    var nrGarages = vialis.garages.length;
    for (var ix = 0; ix < nrGarages; ix++) {
        var definition = vialis.garages[ix];
        tasks.push(createUpdateGarageTask(definition.id, encodeURI(vialis.baseUrl[definition.url] + definition.filename)));
    }
    async.series(tasks, callback);
}

function createUpdateGarageTask(id, url) {
    return function(callback) {
        var options = {
            url: url,
            method: 'GET',
            headers: {
                'User-Agent': 'Saxion IoTAgent-Parking/Node Request',
                'Accept': 'application/json,*/*;q=0.5'  // This server says it produces html, but actually it is json
            }
        };
        request(options, function (error, response, body) {
            if (error) {
                config.getLogger().info(context, error);
                callback(error);
            } else if (response.statusCode >= 400) {
                config.getLogger().error(context, id + ': ' + response.statusCode + ' ' + response.statusMessage + ' - ' + url);
                callback(null); // continue
            } else {
                var garage = JSON.parse(body);
                processParkingData(id, garage, function processingCompleted(error) {
                    callback(error);
                });
            }
        });
    };
}

function processParkingData(id, garage, callback) {
    var parkingTemplate = parkings.entities.find(function matchParkingId(gar) {
        return gar.id === id;
    });
    if (!parkingTemplate) {
        callback('No garage template found: ' + id);
    } else {
        var parking = {};
        Object.keys(parkingTemplate).forEach(function(key) {
            parking[key] = parkingTemplate[key];
        });
        try {
            // Apparently not a single data model
            var facility = garage['parkingFacility'];
            var status;
            if (facility) {
                status = facility['status'];
            } else {
                facility = garage['parkingFacilityDynamicInformation'];
                status = facility['facilityActualStatus'];
            }
            // Bug fix: lastUpdated should represent UTC, but shows Amsterdam local time
            var now = new Date();
            var updated = new Date(status.lastUpdated * 1000);
            var offset_min = now.getTimezoneOffset();
            if (now.getTime() < updated.getTime()) {
                status.lastUpdated += offset_min * 60;  // Amsterdam time give -120 minutes offset
            }
            parking.availableSpotNumber = {
                type: 'Integer',
                value: status.vacantSpaces
            };
            parking.totalSpotNumber = {
                type: 'Integer',
                value: status.parkingCapacity
            };
            parking.dateModified = {
                type: 'DateTime',
                value: new Date(status.lastUpdated * 1000).toISOString()
            };
            // Wrap the data into an update request for the context broker
            var updateBody = {};
            updateBody.actionType = 'APPEND';
            updateBody.entities = [];
            updateBody.entities.push(parking);
            var iota = config.getConfig().iota;
            var cb = iota.contextBroker;
            var options = {
                url: (cb.secure ? 'https' : 'http') + '://' + cb.host + ':' + cb.port + '/v2/op/update',
                method: 'POST',
                headers: {
                    'User-Agent': 'Saxion IoTAgent-Parking/Node Request',
                    'Content-Type': 'application/json',
                    'Fiware-Service': iota.service,
                    'Fiware-ServicePath': iota.subservice
                },
                json: updateBody
            };
            request(options, function (error, response) {
                if (error) {
                    config.getLogger().info(context, error);
                } else {
                    if (response.statusCode >= 400) {
                        config.getLogger().error(context, id + ': ' + response.statusCode + ' ' + response.body.error + ' - ' + response.body.description);
                    } else {
                        config.getLogger().info(context, 'Updated ' + id);
                    }
                }
                callback(null);
            });
            // config.getLogger().info(context, JSON.stringify(parking, null, 2));
        } catch (e) {
            config.getLogger().error(context, 'Error updating parking garage ' + id + ': ' + e);
            callback(null);
        }
    }
}

/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    // config.getLogger().info(context, 'Stopping IoT Agent');
    callback(null);
}

exports.start = start;
exports.stop = stop;
