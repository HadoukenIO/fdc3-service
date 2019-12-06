import {SemVer, SemVerType} from '../../src/provider/utils/SemVer';

// A semver string, or a string and which part of the string will actually match the regex (i.e. with any junk pre/post text removed)
type SemVerInput = string | [string, string];
// Major, Minor and Patch numbers, followed by the segments of a dot-separated 'pre-release' version string.
type SemVerComponents = [number, number, number, ...(string | number)[]];
type SemVerInstance = [SemVerInput, SemVerType, SemVerComponents];

function createSemVerTests(instanceData: SemVerInstance[]): void {
    function doTest(input: string, output: string, type: SemVerType, components: SemVerComponents): void {
        const semVer = new SemVer(input);

        expect(semVer.type).toEqual(type);
        expect(semVer.components).toEqual(components);
        expect(semVer.version).toEqual(type === SemVerType.VALID ? output : type);
    }

    it.each(instanceData)('%s is parsed as %s', (input, type, components) => {
        const [versionString, expectedVersionString] = typeof input === 'string' ? [input, input] : input;
        doTest(versionString, expectedVersionString, type, components);
    });

    it.each(instanceData)('%s is parsed as %s, when surrounded by unrelated text', (input, type, components) => {
        const [versionString, expectedVersionString] = typeof input === 'string' ? [input, input] : input;
        doTest(`foo v${versionString}! bar`, expectedVersionString, type, components);
    });
}

describe('When parsing semver strings', () => {
    describe('When string contains only a version number', () => {
        const instanceData: SemVerInstance[] = [
            // Valid version numbers
            ['0.0.0', SemVerType.VALID, [0, 0, 0]],
            ['0.0.1', SemVerType.VALID, [0, 0, 1]],
            ['0.1.0', SemVerType.VALID, [0, 1, 0]],
            ['1.0.0', SemVerType.VALID, [1, 0, 0]],
            ['99.99.99', SemVerType.VALID, [99, 99, 99]],
            ['10.2.99', SemVerType.VALID, [10, 2, 99]],

            // Wrong number of components
            ['0', SemVerType.INVALID, [0, 0, 0]],
            ['10', SemVerType.INVALID, [0, 0, 0]],
            ['0.0', SemVerType.INVALID, [0, 0, 0]],
            ['10.10', SemVerType.INVALID, [0, 0, 0]],
            ['0.0.0.0', SemVerType.INVALID, [0, 0, 0]],
            ['10.10.10.10', SemVerType.INVALID, [0, 0, 0]],

            // Invalid numbers
            ['-1.0.0', SemVerType.INVALID, [0, 0, 0]],
            ['0.-1.0', SemVerType.INVALID, [0, 0, 0]],
            ['0.0.-1', SemVerType.INVALID, [0, 0, 0]]
        ];

        createSemVerTests(instanceData);
    });

    describe('When string contains a version number and pre-release version', () => {
        const instanceData: SemVerInstance[] = [
            // Valid version numbers
            ['1.0.0-alpha', SemVerType.VALID, [1, 0, 0, 'alpha']],
            ['1.0.0-0', SemVerType.VALID, [1, 0, 0, 0]],
            ['1.0.0-1', SemVerType.VALID, [1, 0, 0, 1]],
            ['1.0.0-10', SemVerType.VALID, [1, 0, 0, 10]],
            ['1.0.0-1.0', SemVerType.VALID, [1, 0, 0, 1, 0]],
            ['1.0.0-1.1', SemVerType.VALID, [1, 0, 0, 1, 1]],
            ['1.0.0-1.10', SemVerType.VALID, [1, 0, 0, 1, 10]],
            ['1.0.0-alpha.0', SemVerType.VALID, [1, 0, 0, 'alpha', 0]],
            ['1.0.0-alpha.1', SemVerType.VALID, [1, 0, 0, 'alpha', 1]],
            ['1.0.0-alpha.beta', SemVerType.VALID, [1, 0, 0, 'alpha', 'beta']],
            ['1.0.0-beta.1', SemVerType.VALID, [1, 0, 0, 'beta', 1]],

            // Whole string is invalid, but contains a smaller, valid SemVer
            [['1.0.0-alpha-1', '1.0.0-alpha'], SemVerType.VALID, [1, 0, 0, 'alpha']],

            // Wrong number of components
            ['1.0.0-', SemVerType.INVALID, [0, 0, 0]],
            ['1.0.0-+1', SemVerType.INVALID, [0, 0, 0]],

            // Invalid characters
            ['1.0.0-', SemVerType.INVALID, [0, 0, 0]],
            ['0.-1.0', SemVerType.INVALID, [0, 0, 0]],
            ['0.0.-1', SemVerType.INVALID, [0, 0, 0]]
        ];

        createSemVerTests(instanceData);
    });

    describe('When string contains a version number, pre-release version and build metadata', () => {
        const instanceData: SemVerInstance[] = [
            // With just version number
            [['1.0.0+0', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+1', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+100', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+alpha', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+0.0', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+0.100', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+alpha.0', '1.0.0'], SemVerType.VALID, [1, 0, 0]],
            [['1.0.0+20200101.1200', '1.0.0'], SemVerType.VALID, [1, 0, 0]],

            // With version number and pre-release version
            [['1.0.0-alpha.100+0', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+1', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+100', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+alpha', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+0.0', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+0.100', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+alpha.0', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]],
            [['1.0.0-alpha.100+20200101.1200', '1.0.0-alpha.100'], SemVerType.VALID, [1, 0, 0, 'alpha', 100]]
        ];

        createSemVerTests(instanceData);
    });
});
