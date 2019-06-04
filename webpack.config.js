const path = require('path');
const outputDir = path.resolve(__dirname, './dist');

/**
 * Import the webpack tools from openfin-service-tooling
 */
const webpackTools = require('openfin-service-tooling').webpackTools;

/**
 * Modules to be exported
 */
module.exports = [
    webpackTools.createConfig(`${outputDir}/client`, './src/client/main.ts', {minify: false, isLibrary: true, libraryName: 'fdc3'}, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/client`, './src/client/main.ts', {
        minify: true, isLibrary: true, libraryName: 'fdc3', outputFilename: 'openfin-fdc3'
    }, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/provider`, './src/provider/index.ts', undefined, webpackTools.manifestPlugin, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/provider/ui`, {
        'resolver': './src/provider/view/Resolver.tsx'
    }, undefined, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/demo`, {
        app: './src/demo/index.tsx'
    }, undefined, webpackTools.versionPlugin)
];

