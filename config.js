var config = {};

config.iota = {
    // iotaVersion:  Read from package.json by iotagent-eps script
    logLevel: 'INFO',
    timestamp: false,
    contextBroker: {
        host: '178.21.117.113',
        port: '1026'
    },
    server: {
        port: 4041
    },
    deviceRegistry: {
        type: 'memory'
    },
    types: {
        'OffStreetParking' : {
            commands: [],
            // lazy: [
            //     // {
            //     //     'name': 'mylazytestattrib',
            //     //     'type': 'Text'
            //     // }
            // ],
            attributes: [
                {
                    'object_id': 'username',
                    'name': 'name',
                    'type': 'Text'
                },
                {
                    'object_id': 'filetimestamp',
                    'name': 'dateModified',
                    'type': 'DateTime'
                },
                {
                    'object_id': 'capacityshort',
                    'name': 'totalSpotNumber',
                    'type': 'Integer'
                },
                {
                    'name': 'availableSpotNumber',
                    'type': 'Integer'
                }
            ],
            protocol: 'EnschedeParkingProtocol',
            timezone: 'Europe/Amsterdam'
        }
    },
    service: 'ParkingService',
    subservice: '/nl/enschede',
    providerUrl: 'http://localhost:4041',
    deviceRegistrationDuration: 'P1M',
    defaultType: 'OffStreetParking',
    componentName: 'IoTA-EPS'
};

module.exports = config;
