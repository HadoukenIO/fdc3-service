import * as React from 'react';

import {Application} from '../../../../client/directory';
import {ResolverArgs, ResolverResult} from '../../../controller/ResolverHandler';
import {AppList} from '../AppList/AppList';

import '../../styles/_main.scss';
import './Resolver.scss';

let sendSuccess: (result: {app: Application}) => void;

export function Resolver(): React.ReactElement {
    const [applications, setApplications] = React.useState<Application[]>([]);
    const [intent, setIntent] = React.useState<string>();

    const handleAppOpen = (app: Application) => sendSuccess({app});
    const handleCancel = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        sendSuccess(null!);
    };

    React.useEffect(() => {
        fin.InterApplicationBus.Channel.create('resolver').then((channel) => {
            Object.assign(window, {channel});

            channel.register('resolve', async (args: ResolverArgs) => {
                setApplications(args.applications);
                setIntent(`Open "${prettyPrintIntent(args.intent.type)}" with`);

                return new Promise<ResolverResult>((resolve, reject) => {
                    sendSuccess = resolve;
                });
            });
        });
    }, []);

    return (
        <div className="container">
            <div className="header">
                <h1>{intent}</h1>
                <div id="exit" onClick={handleCancel}>
                    <img src="assets/exit.png" />
                </div>
            </div>
            <AppList applications={applications} onAppOpen={handleAppOpen} />
            <div id="cancel" onClick={handleCancel}>
                <h1>Cancel</h1>
            </div>
        </div>
    );
}

/**
 *  - Strip-off the namespace - remove the first dot character (if there is one) and anything preceding it.
 *  - Split the resulting string into individual words. Any of the following will be taken as a word separator:
 *  - A space, hyphen or underscore character
 *  - A lowercase letter followed by an uppercase character
 *  - Capitalise the first letter of each word, with every other character being lowercase
 *
 * Some examples of the above rules:
 * - fdc3.ViewChart -> 'Open "View Chart" with'
 * - fdc3.StartChat -> 'Open "Start Chat" with'
 * - myorg.ViewChart -> 'Open "View Chart" with'
 * - myorg.START_CHAT -> 'Open "Start Chat" with'
 * - myorg.FETCH_RFQ -> 'Open "Fetch Rfq" with'
 */
function prettyPrintIntent(intent: string) {
    const intentWithoutNamespace = intent.includes('.') ? intent.split('.')[1] : intent;
    return intentWithoutNamespace
        .replace(/([A-Z]+)/g, ' $1')
        .replace(/([A-Z][a-z])/g, ' $1')
        .replace(/[-_]/g, ' ')
        .trimLeft()
        .toLowerCase();
}
