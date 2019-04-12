import * as React from 'react';

import {Channel, getChannel, getAllChannels, joinChannel, GLOBAL_CHANNEL_ID, ChannelId} from '../../../client/contextChannels';

import './ContextChannelSelector.css';

interface ContextChannelSelectorProps {
    float?: boolean;
}

/**
 * Context channel ui
*/
export function ContextChannelSelector(props: ContextChannelSelectorProps): React.ReactElement {
    const {float = false} = props;
    const [currentChannelId, setCurrentChannelId] = React.useState<ChannelId>(GLOBAL_CHANNEL_ID);
    const [color, setColor] = React.useState<number>(0xFFFFFF);
    const [channels, setChannels] = React.useState<Channel[]>([]);
    React.useEffect(() => {
        getChannel().then(channel => {
            setColor(channel.color);
            setCurrentChannelId(channel.id);
        });
        getAllChannels().then(channels => {
            setChannels(channels);
        });
    }, []);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const {value: id} = event.currentTarget;
        const channel = channels.find(x => x.id === id);

        joinChannel(id)
            .then(() => {
                setCurrentChannelId(id);
                if (channel) {
                    setColor(channel.color);
                }
            })
            .catch(error => {
                console.error(`Unable to join channel ${id}! ${error.message}`);
            });
    };

    return (
        <div className={`context-channel ${float ? 'float' : ''}`}>
            <div className='selector'>
                <div className="color" style={{backgroundColor: numberToHex(color)}}></div>
                <select value={currentChannelId} onChange={handleChange}>
                    {
                        channels.map((channel, index) => {
                            return (
                                <option
                                    key={channel.id + index}
                                    value={channel.id}
                                >
                                    {channel.name}
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
