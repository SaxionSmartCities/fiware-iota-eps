# iotagent-eps

## Index

* [Overview](#overview)
* [Installation](#installation)
* [Usage](#usage)
* [Configuration] (#configuration)

## <a name="overview"/> Overview

This IoT Agent is designed to be a bridge between the Enschede Parking Service and the OMA NGSI standard used in FIWARE.
This project communicates directly with the Orion context broker.

## <a name="installation"/> Installation
In order to install the TT Agent, just clone the project and install the dependencies:
```
git clone https://github.com/vidinexus/iotagent-eps.git
npm install
```
In order to start the IoT Agent, from the root folder of the project, type:
```
bin/iotagent-eps
``` 
 
## <a name="usage"/> Usage
In order to execute the EPS IoT Agent just execute the following command from the root folder:
```
bin/iotagent-eps.js
```
This will start the EPS IoT Agent in the foreground. The agent will update the context and finish.

When started with no arguments, the IoT Agent will expect to find a `config.js` file with the configuration in the root
folder. An argument can be passed with the path to a new configuration file (relative to the application folder) to be
used instead of the default one.

## <a name="configuration"/> Configuration
All the configuration for the IoT Agent is stored in a single configuration file (typically installed in the root folder).

This configuration file is a JavaScript file and contains two configuration chapters:
* **iota**: this object stores the configuration of the Northbound of the IoT Agent, and is completely managed by the
IoT Agent library. More information about this options can be found [here](https://github.com/telefonicaid/iotagent-node-lib#configuration).

