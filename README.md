# OpenFin FDC3 Service


## Overview

OpenFin FDC3 API uses the new Services framework to expose its API to consuming applications.  You can see the documentation for these APIs here:  http://cdn.openfin.co/jsdocs/alpha/fin.desktop.Service.html.

This project consist of 2 parts:
1. The FDC3 Provider, taking care of intents, context and resolving them (UI)
2. The FDC3 Client, exposing API's for applications to handle/raise intents with contexts

### Dependencies
- OpenFin version >= 8.56.30.42 
- RVM >= 4.2.0.33 

### Features
* Raise an FDC3 Intent
* Resolve an FDC3 Intent
* Open an application with an intent/context
* Attach listeners for Intents and Contexts

### Run Locally
- To run the project locally the npm scripts require git bash.
- Windows support only.
- Node 8.11 LTS.
```bash
npm install
npm run build:demo
npm run start
```

## Getting Started

Using the FDC3 service is done in two steps, add the service to application manifest and import the API:

### Manifest declaration

To ensure the service is running, you must declare it in your application config.

```
"services": [
    {
        "name": "fdc3"
    }
]

```

### Import the API

To use the API, you must first include it in your application. 

```bash
npm install openfin-fdc3
```

### API Documentation

[official API spec](https://github.com/FDC3/API)


## Roadmap
This is a WIP living implementation of the FDC3 API.


## Known Issues


## Project Structure

All code lives under the src directory which can be broken down into 5 areas: client, demo, provider, test and ui.

* src
 * client - the service client
 * demo - the demo config/html (for testing the service itself)
 * provider - the service provider
 * test - all the tests
 * ui - the intent/context resolution ui

## Project Helpers

We use a handful of NPM scripts to handle most of the typical tasks in a project like compile, stage, run, etc.

* build - run webpack and stage (production)
* build:demo - run webpack and stage (development)
* start - runs the server/apps, must run either build command prior
* test - runs all project tests


## Build

The project is built and staged to the ./build directory.  This directory is exactly what would be deployed to the production CDN.

* build
 * client.js - the compiled service client
 * demo/ - the demo files
 * provider.js - the compiled service provider
 * ui - the compiled intent/context resolution UI


## License
This project uses the [Apache2 license](https://www.apache.org/licenses/LICENSE-2.0)

## Support
This is an open source project and all are encouraged to contribute.
Please enter an issue in the repo for any questions or problems. For further inqueries, please contact us at support@openfin.co
