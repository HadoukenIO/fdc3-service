import * as React from 'react';

import {Channel, getChannel, getAllChannels, joinChannel, GLOBAL_CHANNEL_ID, ChannelId} from '../../../client/contextChannels';

/**
 * Context channel ui
*/
export function ContextChannelSelector(): React.ReactElement {
    const [currentChannelId, setCurrentChannelId] = React.useState<ChannelId>(GLOBAL_CHANNEL_ID);
    const [channels, setChannels] = React.useState<Channel[]>([]);

    React.useEffect(() => {
        getChannel().then(channel => {
            setCurrentChannelId(channel.id);
        });
        getAllChannels().then(channels => {
            setChannels(channels);
        });
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const {value: id} = event.currentTarget;
        joinChannel(id);
    };

    return (
        <div>
            <select name="color" value={currentChannelId} onChange={handleChange}>
                {
                    channels.map((channel, index) => {
                        return (
                            <option
                                key={channel.id + index}
                                selected={currentChannelId === channel.id}
                                value={channel.id}
                            >
                                {channel.name}
                            </option>
                        );
                    })
                }
            </select>
        </div>
    );
}
