# OpenFin FDC3


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


### API Documentation

[official API spec](https://github.com/FDC3/API)


## Roadmap
This is a WIP living implementation of the FDC3 API.

### Usage

An in-depth usage guide and additional documentation will be published in due course.

## Run Locally

To preview the functionality of the service without integrating it into an existing application - or to start contributing to the service - the service can be ran locally. By checking out this repo and then running the project.

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

### Setup

After checkout, install project dependencies using `npm install`.

### Startup
Once dependencies are installed, start the "built-in" sample application with `npm start`. This uses `webpack-dev-middleware` to both build and host the application; a custom `server.js` script will start the OpenFin application once the server is up and running.

The startup script has optional arguments which can be used to tweak the behavior of the build and the test server. See the constants at the top of `server.js` for details on the available parameters and their effects.

### Build Process
The service consists of several different components unified into a single project. The `package.json` defines the combined dependencies of all components; anything required for the pre-built client to work within an application is included in the `"dependencies"` section, and the remaining dependencies - used to build the client, and to both build & run the provider and demo application - are included under `"devDependencies"`.

Similarly, there is a single `webpack.config.js` script that will build the above components.

### Testing
To run the full test-suite for fdc3-service, run:
```bash
npm install
npm test
```

This will run unit tests followed by the integration tests. These steps can also be ran individually via `npm run test:unit` and `npm run test:int`. When running the tests separately in this way, both test runners support some optional arguments. Append `--help` to either of the above `npm run` commands to see the available options.

### Deployment
Staging and production builds are managed via the Jenkinsfile build script. This will build the project as usual (except with the `--production` argument) and then deploy the client and provider to their respective locations. The demo application exists only within this repo and is not deployed.

The service client is deployed as an NPM module, so that it can be included as a dependency in any application that wishes to integrate with the service.

The service provider is a standard OpenFin application, only its lifecycle is controlled by the RVM (based upon the requirements of user-launched applications) rather than being launched by users. The provider is deployed to the OpenFin CDN; a zip file is also provided to assist with re-deploying the provider to an alternate location. Direct links to each build are listed in the release notes, available on the [services versions page](https://developer.openfin.co/versions/?product=Services).

## Known Issues
A list of known issues can be found on our [Versions page](https://developer.openfin.co/versions/?product=Services).

## License
This project uses the [Apache2 license](https://www.apache.org/licenses/LICENSE-2.0)

However, if you run this code, it may call on the OpenFin RVM or OpenFin Runtime, which are covered by OpenFin's Developer, Community, and Enterprise licenses. You can learn more about OpenFin licensing at the links listed below or just email us at support@openfin.co with questions.

https://openfin.co/developer-agreement/
https://openfin.co/licensing/

## Support
This is an open source project and all are encouraged to contribute.
Please enter an issue in the repo for any questions or problems. Alternatively, please contact us at support@openfin.co
