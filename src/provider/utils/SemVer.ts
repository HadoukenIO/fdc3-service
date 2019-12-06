export enum SemVerType {
    VALID = 'VALID',
    INVALID = 'INVALID',
    UNKNOWN = 'UNKNOWN'
}

export enum Operator {
    LESS_THAN = '<',
    GREATER_THAN = '>',
    LESS_THAN_OR_EQUAL = '<=',
    GREATER_THAN_OR_EQUAL = '>='
}

/**
 * Util for comparing semantic version numbers.
 *
 * NOTE: Only parses the major, minor, patch and pre-release parts of the semver string - build metadata is ignored.
 *
 * Spec: https://semver.org/
 */
export class SemVer {
    private static readonly REGEX_SEMVER: RegExp = createSemVerRegex();
    private static readonly REGEX_INTEGER: RegExp = /^\d+$/;
    private static readonly CACHE: {[key: string]: SemVer} = {};

    public static compare(a: string | SemVer, operator: Operator, b: string | SemVer): boolean {
        return SemVer.parse(a).compare(operator, b);
    }

    public static parse(version: string | SemVer): SemVer {
        if (version instanceof SemVer) {
            return version;
        } else {
            let semVer = SemVer.CACHE[version];

            if (!semVer) {
                semVer = new SemVer(version);
                SemVer.CACHE[version] = semVer;
            }

            return semVer;
        }
    }

    public readonly version: string;
    public readonly type: SemVerType;
    public readonly components: Readonly<[number, number, number, ...(string | number)[]]>;

    constructor(version: string) {
        const match = version && SemVer.REGEX_SEMVER.exec(version);

        if (match) {
            const [matchedText, major, minor, patch, preRelease = ''] = match;
            const preReleaseComponents = preRelease.split('.').map((component) => {
                if (SemVer.REGEX_INTEGER.test(component)) {
                    return parseInt(component);
                } else {
                    return component;
                }
            }).filter((component) => component !== '');
            this.version = matchedText;
            this.components = [parseInt(major), parseInt(minor), parseInt(patch), ...preReleaseComponents];
            this.type = SemVerType.VALID;
        } else {
            this.components = [0, 0, 0];
            this.type = version ? SemVerType.INVALID : SemVerType.UNKNOWN;
            this.version = this.type;
        }
    }

    public get valid(): boolean {
        return this.type === SemVerType.VALID;
    }

    public compare(operator: Operator, other: string | SemVer, defaultIfInvalid: boolean = false): boolean {
        other = SemVer.parse(other);

        if (this.type === SemVerType.VALID && other.type === SemVerType.VALID) {
            // Based on operator, determine if inputs are allowed to be equal
            const allowEqual = operator.endsWith('=');

            // Given the existance of caching, there's a decent chance we don't actually need to compare anything
            if (this === other) {
                return allowEqual;
            }

            // Based on the operator, determine which of the inputs should be smaller
            const {components: min} = operator.startsWith('<') ? this : other;
            const {components: max} = operator.startsWith('<') ? other : this;

            // Check each component of the inputs in turn
            const minCount = min.length;
            const maxCount = max.length;
            const componentCount = Math.min(minCount, maxCount);
            for (let i = 0; i < componentCount; i++) {
                if (min[i] !== max[i]) {
                    if (typeof min[i] !== typeof max[i]) {
                        // When comparing numeric and non-numeric pre-release parts, non-numeric take precedence
                        return typeof min[i] === 'number';
                    } else {
                        return min[i] < max[i];
                    }
                }
            }

            if (minCount === maxCount) {
                return allowEqual;
            } else if (componentCount === 3) {
                // When mixing 'release' and 'pre-release', the 'release' version takes precedence
                return minCount > maxCount;
            } else {
                // When comparing two 'pre-release' versions, the version with most parts takes precedence
                return minCount < maxCount;
            }
        } else {
            return defaultIfInvalid;
        }
    }
}

/**
 * Generates a regex that matches a valid version number and (optional) pre-release string.
 *
 * The input string can contain other characters before/after the semver, so long as they don't invalidate the semver
 * itself. For example, good: v1.0.0, ^1.0.0  bad: 1.0.0.0
 *
 * Extracted into a function rather than Regex literal given the complexity of the pattern.
 */
function createSemVerRegex(): RegExp {
    const noPrecedingNumberOrDot = '(?<!\\d|[.-])';
    const majorMinorPatch = '(\\d+)\\.(\\d+)\\.(\\d+)';
    const noAdditionalNumberDotOrTrailingHyphen = '(?!\\d|\\.|-(?:$|\\W))';
    const preReleaseSegment = '\\w+';
    const preReleaseStringIncludingHyphen = `(?:-(${preReleaseSegment}(?:\\.${preReleaseSegment})*))?`;

    return new RegExp([
        noPrecedingNumberOrDot,
        majorMinorPatch,
        noAdditionalNumberDotOrTrailingHyphen,
        preReleaseStringIncludingHyphen
    ].join(''));
}
