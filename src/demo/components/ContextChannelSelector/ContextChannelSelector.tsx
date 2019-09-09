import * as React from 'react';
import {Identity} from 'openfin/_v2/main';

import {Channel, defaultChannel, getCurrentChannel, getSystemChannels, SystemChannel} from '../../../client/contextChannels';

import {ContextChannelView} from './ChannelMemberView';

import './ContextChannelSelector.css';

interface ContextChannelSelectorProps {
    float?: boolean;
}

ContextChannelSelector.defaultProps = {
    float: false
};

/**
 * Context channel ui
*/
export function ContextChannelSelector(props: ContextChannelSelectorProps): React.ReactElement {
    const {float} = props;
    const [currentChannel, setCurrentChannel] = React.useState<Channel>(defaultChannel);
    const [channels, setChannels] = React.useState<Channel[]>([]);
    React.useEffect(() => {
        getCurrentChannel().then(channel => {
            setCurrentChannel(channel);
        });
        getSystemChannels().then(channels => {
            setChannels([defaultChannel, ...channels]);
        });
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const {value: id} = event.currentTarget;
        const selectedChannel = channels.find(channel => channel.id === id);

        if (selectedChannel) {
            selectedChannel
                .join()
                .then(() => {
                    setCurrentChannel(selectedChannel);
                })
                .catch((error: Error) => {
                    console.error(`Unable to join channel ${id}! ${error.message}`);
                });
        }
    };

    return (
        <div className={`context-channel ${float ? 'float' : ''}`}>
            <div className='selector'>
                <ContextChannelView channel={currentChannel} />
                <select value={currentChannel.id} onChange={handleChange}>
                    {
                        channels.map((channel, index) => {
                            return (
                                <option
                                    key={channel.id + index}
                                    value={channel.id}
                                >
                                    {(channel as SystemChannel).name || 'Default'}
                                </option>
                            );
                        })
                    }
                </select>
            </div>
        </div>
    );
}
