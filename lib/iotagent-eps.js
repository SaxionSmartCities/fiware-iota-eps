// IoT Agent Enschede Parking Service

'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    iotaUtils = require('./iotaUtils'),
    async = require('async'),
    errors = require('./errors'),
    request = require('request'),
    moment = require('moment'),
    parkings = require('../etc/parkings.json'),

    apply = async.apply,
    context = {
        op: 'IoTAgentEPS.Agent'
    },
    config = require('./configService');

/**
 * Handler for incoming notifications (for the configuration subscription mechanism).
 *
 * @param {Object} device           Object containing all the device information.
 * @param {Array} updates           List of all the updated attributes.

 */
function notificationHandler(device, updates, callback) {
    // function invokeConfiguration(apiKey, callback) {
    //     transportSelector.applyFunctionFromBinding(
    //         [apiKey, device.id, updates],
    //         'sendConfigurationToDevice',
    //         device.transport || config.getConfig().defaultTransport,
    //         callback);
    // }
    //
    // async.waterfall([
    //     apply(iotaUtils.getEffectiveApiKey, device.service, device.subservice),
    //     invokeConfiguration
    // ], callback);
    console.log('\n\n* Notification:\n%s\n\n', JSON.stringify(device, null, 4));
    callback(null, device, updates);

}

function configurationHandler(configuration, callback) {
    if (configuration.resource && config.getConfig().iota.iotManager && config.getConfig().iota.defaultResource &&
        configuration.resource !== config.getConfig().iota.defaultResource) {
        callback(new errors.InvalidResource());
    } else {
        console.log('\n\n* REGISTERING A NEW CONFIGURATION:\n%s\n\n', JSON.stringify(configuration, null, 4));
        callback(null, configuration);
        // callback();
    }}

/**
 * Handles incoming updateContext requests related with lazy attributes. This handler is still just registered,
 * but empty.
 *
 * @param {String} id               ID of the entity for which the update was issued.
 * @param {String} type             Type of the entity for which the update was issued.
 * @param {Array} attributes        List of NGSI attributes to update.
 */
function updateHandler(id, type, attributes, service, subservice, callback) {
    console.log('\n\n* Update for %s %s %s %s:\n%s\n\n', id, type, service, subservice, JSON.stringify(attributes, null, 4));
    callback(null);
}

/**
 * Calls all the device provisioning handlers for each transport protocol binding whenever a new device is provisioned
 * in the Agent.
 *
 * @param {Object} device           Device provisioning information.
 */
function deviceProvisioningHandler(device, callback) {
    // transportSelector.applyFunctionFromBinding([device], 'deviceProvisioningHandler', null, function(error, devices) {
    //     if (error) {
    //         callback(error);
    //     } else {
    //         callback(null, devices[0]);
    //     }
    // });
    console.log('\n\n* REGISTERING A NEW DEVICE:\n%s\n\n', JSON.stringify(device, null, 4));
    // device.type = 'CertifiedType';
    callback(null, device);
}

function initSouthBound(callback) {
    callback(null);
}
/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {
    function createCallbackFunc(device) {
        return function(error) {
            if (error) {
                config.getLogger().error(context, 'Error configuring device "%s" [%s]', device.id, error);
            } else {
                config.getLogger().info(context, 'Added device "%s"', device.id);
            }
        }
    }

    var device;
    config.setConfig(newConfig);
    config.setLogger(iotAgentLib.logModule);
    iotAgentLib.activate(newConfig.iota, function(error) {
        if (error) {
            callback(error);
        } else {
            iotAgentLib.setConfigurationHandler(configurationHandler);
            iotAgentLib.setNotificationHandler(notificationHandler);
            iotAgentLib.setProvisioningHandler(deviceProvisioningHandler);

            iotAgentLib.setDataUpdateHandler(updateHandler);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.attributeAlias.update);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.compressTimestamp.update);
            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.addEvents.update);

            iotAgentLib.addQueryMiddleware(iotAgentLib.dataPlugins.compressTimestamp.query);
            for (var p = 0; p < parkings.devices.length; p++) {
                var device = parkings.devices[p];
                iotAgentLib.register(device, createCallbackFunc(device));
            }

            config.getLogger().info(context, 'IoT Agent services activated');
        }
    });
    initSouthBound(callback);
    // setImmediate(updateParkingGarageContext);
    setTimeout(updateParkingGarageContext, 5000);
    setInterval(updateParkingGarageContext, 5 * 60 * 1000);
}

function updateParkingGarageContext() {
    config.getLogger().info(context, 'Update Parking Garage Context');
    var options = {
        url: 'http://trafficlab-twente.it-t.nl/DVISWebServices.asmx/GetPrisActualJson',
        method: 'GET',
        headers: {
            'User-Agent': 'Saxion IoTAgent-Parking/Node Request',
            'Accept': 'application/json'
        }
    };
    request(options, function (error, response, body) {
        if (error) {
            config.getLogger().info(context, error);
        } else {
            // callback(null, createResponse(id, type, attributes, body));
            // Get rid of the silly xml wrapper
            var json = body.replace(/^(?:.|\s)*\">|<\/string>$/gm, '');
            var garages = JSON.parse(json);
            iotAgentLib.ensureSouthboundDomain(context, function callback() {
                processParkingRequest(garages);
                iotAgentLib.finishSouthBoundTransaction(function callback() {});
            });
        }
    });
}

function processParkingRequest(garages) {
    var iota = config.getConfig().iota;
    garages.forEach(function(gar) {
        iotAgentLib.getDevice(gar.systemname, iota.service, iota.subservice, function(error, device) {
            if (error) {
                config.getLogger().error(context, error.message);
            } else {
                var attribs = parseGarage(gar, device, iota.types[device.type]);
                // Note: Documentation (2016-11-1) specifies different signature
                iotAgentLib.update(device.name, device.type, '', attribs, device, function callback(error) {
                    if (error) {
                        config.getLogger().warn(context, error.message);
                    } else {
                        config.getLogger().info(context, 'Device successfully updated: ' + device.name);
                    }
                });
            }
        });
    });
}

function parseGarage(garage, device, defaultType) {
    // actualshort = 55
    // capacityshort = 220
    // datavalid = 1
    // filetimestamp = "2016-10-05 13:41:36"
    // id = 0
    // initials = "zv"
    // statuscurrent = 2
    // systemname = "P6"
    // username = "P6 Zuiderval"
    function lookupType(name, dev) {
        var type;
        var i;
        if (!dev || !dev.attributes) {
            return;
        }
        for (i = 0; i < dev.attributes.length; i++) {
            if (dev.attributes[i].name === name) {
                type = dev.attributes[i].type;
                break;
            }
        }
        return type;
    }

    function findType(name) {
        var type = lookupType(name, device);
        if (! type) {
            type = lookupType(name, defaultType);
        }
        return type;
    }

    function convertTimestamp(value) {
        // var iso8601 = 'yyyy-MM-dd\'T\'HH:mm:ssZ';
        var date = moment(value, 'YYYY-MM-DD HH:mm:ss');
        return date.toISOString();
    }

    function createAttribute(name, value) {
        var attribute = {
            name: name,
            value: value,
            type: findType(name)
        };
        return attribute;
    }
    var attribs = [];
    attribs.push(createAttribute('name', garage.username));
    attribs.push(createAttribute('availableSpotNumber', garage.capacityshort - garage.actualshort));
    attribs.push(createAttribute('totalSpotNumber', garage.capacityshort));
    attribs.push(createAttribute('dateModified', convertTimestamp(garage.filetimestamp)));
    return attribs;
}
/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    config.getLogger().info(context, 'Stopping IoT Agent');
    async.series([
        // transportSelector.stopTransportBindings,
        // iotAgentLib.resetMiddlewares,
        iotAgentLib.deactivate
    ], callback);
}

exports.start = start;
exports.stop = stop;
