const path = require('path');
const outputDir = path.resolve(__dirname, './dist');

const {SchemaToDefaultsPlugin} = require('openfin-service-config/plugins/SchemaToDefaultsPlugin');
const {SchemaToTypeScriptPlugin} = require('openfin-service-config/plugins/SchemaToTypeScriptPlugin');
/**
 * Import the webpack tools from openfin-service-tooling
 */
const webpackTools = require('openfin-service-tooling').webpackTools;

const schemaRoot = path.resolve(__dirname, './res/provider/config');
const schemaOutput = path.resolve(__dirname, './gen/provider/config');
const defaultsOutput = path.resolve(__dirname, './gen/provider/config/defaults.json');

/**
 * Webpack plugin to generate a static JSON file that contains the default value of every input schema.
 *
 * Any top-level 'rules' object will be stripped-out of the generated JSON, as the 'rules' property has
 * special significance and isn't a part of the actual service-specific set of config options.
 *
 * Generated code is placed inside a top-level 'gen' folder, whose structure mirrors that of
 * the 'src', 'res' and 'test' folders.
 */
const schemaDefaultsPlugin = new SchemaToDefaultsPlugin({
    outputPath: defaultsOutput,
    input: `${schemaRoot}/fdc3-config.schema.json`
});

/**
 * Webpack plugin to generate TypeScript definitions from one or more JSON schema files.
 *
 * Generated code is placed inside a top-level 'gen' folder, whose structure mirrors that of
 * the 'src', 'res' and 'test' folders.
 */
const schemaTypesPlugin = new SchemaToTypeScriptPlugin({
    schemaRoot,
    outputPath: schemaOutput,
    input: [
        `${schemaRoot}/fdc3-config.schema.json`
    ]
});

/**
 * Modules to be exported
 */
module.exports = [
    webpackTools.createConfig(`${outputDir}/client`, './src/client/main.ts', {minify: false, isLibrary: true, libraryName: 'fdc3'}, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/client`, './src/client/main.ts', {
        minify: true, isLibrary: true, libraryName: 'fdc3', outputFilename: 'openfin-fdc3'
    }, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/provider`, './src/provider/index.ts', undefined, webpackTools.manifestPlugin, webpackTools.versionPlugin, schemaDefaultsPlugin, schemaTypesPlugin),
    webpackTools.createConfig(`${outputDir}/provider/ui`, {
        'resolver': './src/provider/view/Resolver.tsx'
    }, undefined, webpackTools.versionPlugin),
    webpackTools.createConfig(`${outputDir}/demo`, {
        app: './src/demo/index.tsx'
    }, undefined, webpackTools.versionPlugin)
];

