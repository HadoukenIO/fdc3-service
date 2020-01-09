import * as React from 'react';

import {Channel, defaultChannel, getCurrentChannel, getSystemChannels, ChannelChangedEvent} from '../../../client/contextChannels';
import {addEventListener, removeEventListener} from '../../../client/main';
import {getId} from '../../../provider/utils/getId';

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
        getCurrentChannel().then((channel) => {
            setCurrentChannel(channel);
        });
        getSystemChannels().then((channelsLocal) => {
            setChannels([defaultChannel, ...channelsLocal]);
        });
        addEventListener('channel-changed', channelChanged);

        return () => {
            removeEventListener('channel-changed', channelChanged);
        };
    }, []);

    const channelChanged = (event: ChannelChangedEvent) => {
        if (getId(event.identity) === getId(fin.Window.me) && event.channel !== currentChannel) {
            setCurrentChannel(event.channel!);
        }
    };

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const {value: id} = event.currentTarget;
        const selectedChannel = channels.find((channel) => channel.id === id);

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
            <div className="selector">
                <ContextChannelView channel={currentChannel} />
                <select value={currentChannel.id} onChange={handleChange}>
                    {
                        channels.map((channel, index) => {
                            return (
                                <option
                                    key={`${channel.id}${index}`}
                                    value={channel.id}
                                >
                                    {channel.type === 'system' ? channel.visualIdentity.name : 'Default'}
                                </option>
                            );
                        })
                    }
                </select>
            </div>
        </div>
    );
}
