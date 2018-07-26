
/**
 * TypeScript definitions for envelope and context objects.
 *
 * These structures are defined by the Contexts FDC3 working group. he definitions here are based on current
 * proposals and are not final. There may be minor differences between the current spec and the definitions here,
 * in order to support this demo.
 */

export interface Envelope<T extends Payload> {
    type: 'fdc-context';
    definition: 'https://fdc3.org/context/1.0.0/';
    version: string;
    data: T[];
}

export interface Payload {
    type: string;
    name: string;
    id: {[key: string]: string};
}

export interface SecurityPayload extends Payload {
    type: 'security';
    id: {[key: string]: string}&{default: string};
}

export interface OrganizationPayload extends Payload {
    type: 'organization';
    id: {[key: string]: string}&{default: string};
}

export interface ContactPayload extends Payload {
    type: 'contact';
    name: string;
    id: {email?: string; twitter?: string; phone?: string};
}
