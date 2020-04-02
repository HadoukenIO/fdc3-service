import * as React from 'react';

import /* type */ {Channel, ChannelChangedEvent} from '../../../client/contextChannels';
import {getId} from '../../../provider/utils/getId';
import {fdc3} from '../../stub';

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
    const [currentChannel, setCurrentChannel] = React.useState<Channel>(fdc3.defaultChannel);
    const [channels, setChannels] = React.useState<Channel[]>([]);
    React.useEffect(() => {
        fdc3.getCurrentChannel().then((channel) => {
            setCurrentChannel(channel);
        });
        fdc3.getSystemChannels().then((channelsLocal) => {
            setChannels([fdc3.defaultChannel, ...channelsLocal]);
        });
        fdc3.addEventListener('channel-changed', channelChanged);

        return () => {
            fdc3.removeEventListener('channel-changed', channelChanged);
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
