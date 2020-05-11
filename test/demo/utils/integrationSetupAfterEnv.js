jest.setTimeout(30 * 1000);

const args = process.env.CLI_ARGS && JSON.parse(process.env.CLI_ARGS);
if (args && args.asar) {
    const {setServiceIdentity} = require('../../../src/client/internal');

    // Read test-app manifest to find runtime version
    const manifest = require('../../../res/test/test-app-main.json');
    const runtime = args.runtime || manifest.runtime.version;

    // Set service identity, in a place that is accesssible to tests
    setServiceIdentity(runtime);
}
