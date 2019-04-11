import * as React from 'react';

import {Channel} from '../../../client/contextChannels';


interface ContextChannelSelectorProps {
    current: Channel;
    channels: Channel[];
    onChannelChange: (channel: Channel) => void
}
/**
 * Context channel ui
*/
export function ContextChannelSelector(props: ContextChannelSelectorProps): React.ReactElement {
    const {current, channels, onChannelChange} = props;
    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const {value: id} = event.currentTarget;
        const channel = channels.find(x => x.id === id);
        onChannelChange(channel!);
    };

    return (
        <div>
            <select name="color" value={current.id} onChange={handleChange}>
                {
                    channels.map((channel, index) => {
                        return (
                            <option
                                key={channel.id + index}
                                selected={current.id === channel.id}
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
