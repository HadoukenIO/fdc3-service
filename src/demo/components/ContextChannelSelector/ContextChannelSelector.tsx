import * as React from 'react';

import {Channel, defaultChannel, getCurrentChannel, getDesktopChannels, DesktopChannel} from '../../../client/contextChannels';

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
    const [currentChannelId, setCurrentChannelId] = React.useState<Channel>(defaultChannel);
    const [color, setColor] = React.useState<number>(0xFFFFFF);
    const [channels, setChannels] = React.useState<Channel[]>([]);
    React.useEffect(() => {
        getCurrentChannel().then(channel => {
            if (channel.type === 'desktop') {
                setColor(channel.color);
            } else {
                // Use white for default channel
                setColor(0xFFFFFF);
            }
            setCurrentChannelId(channel);
        });
        getDesktopChannels().then(channels => {
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
                    setCurrentChannelId(selectedChannel);
                    if (selectedChannel) {
                        if (selectedChannel.type === 'desktop') {
                            setColor(selectedChannel.color);
                        }
                    } else {
                        setColor(0xFFFFFF);
                    }
                })
                .catch((error: Error) => {
                    console.error(`Unable to join channel ${id}! ${error.message}`);
                });
        }
    };

    return (
        <div className={`context-channel ${float ? 'float' : ''}`}>
            <div className='selector'>
                <div className="color" style={{backgroundColor: numberToHex(color)}}></div>
                <select value={currentChannelId.id} onChange={handleChange}>
                    {
                        channels.map((channel, index) => {
                            return (
                                <option
                                    key={channel.id + index}
                                    value={channel.id}
                                >
                                    {(channel as DesktopChannel).name || 'Default'}
                                </option>
                            );
                        })
                    }
                </select>
            </div>
        </div>
    );
}

/**
 *
 * @param num
 */
function numberToHex(num: number) {
    return num.toString(16).padStart(6, '0');
}
