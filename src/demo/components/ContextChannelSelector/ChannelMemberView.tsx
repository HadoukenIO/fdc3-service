import * as React from 'react';
import {Identity} from 'openfin/_v2/main';

import {Channel} from '../../../client/contextChannels';
import {addEventListener} from '../../../client/main';

interface ChannelViewProps {
    channel: Channel;
}

export function ContextChannelView(props: ChannelViewProps): React.ReactElement {
    const channel = props.channel;
    const [members, setMembers] = React.useState<Identity[]>([]);
    const [color, setColor] = React.useState<number>(0xFFFFFF);
    const [visible, setVisible] = React.useState(false);

    const handleVisible = (event: React.MouseEvent) => {
        setVisible(!visible);
    };

    const setInfo = async (channel: Channel) => {
        setMembers(await channel.getMembers());
        if (channel.type === 'desktop') {
            setColor(channel.color);
        } else {
            // Use white for default channel
            setColor(0xFFFFFF);
        }
    };

    React.useEffect(() => {
        setInfo(channel);
        addEventListener('channel-changed', (event) => {
            const changedChannel = event.channel || event.previousChannel;
            if (changedChannel!.id === channel.id) {
                changedChannel!.getMembers().then(result => {
                    setMembers(result);
                });
            }
            setInfo(channel);
        });
    }, [channel]);

    return (
        <React.Fragment>
            <div className="details">{members.length}</div>
            <div className="color" title="Click to show members." onClick={handleVisible} style={{backgroundColor: numberToHex(color)}}></div>
            {visible && <MemberList members={members}/>}
        </React.Fragment>
    );
}

interface MemberList {
    members: Identity[];
}

function MemberList(props: MemberList): React.ReactElement {
    const {members} = props;

    return (
        <div className="member-list">
            <ul>
                {
                    members.map((member, i) => (
                        <li key={i}>
                            <span>{member.uuid}: {member.name}</span>
                        </li>
                    ))
                }
            </ul>
        </div>
    );
}

function numberToHex(num: number) {
    return num.toString(16).padStart(6, '0');
}
