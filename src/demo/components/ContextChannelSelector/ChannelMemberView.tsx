import * as React from 'react';
import {Identity} from 'openfin/_v2/main';

import /* type */ {Channel} from '../../../client/contextChannels';
import {fdc3} from '../../stub';

interface ChannelViewProps {
    channel: Channel;
}

export function ContextChannelView(props: ChannelViewProps): React.ReactElement {
    const channel = props.channel;
    const [members, setMembers] = React.useState<Identity[]>([]);
    const [color, setColor] = React.useState<string>('#FFFFFF');
    const [visible, setVisible] = React.useState(false);

    const handleVisible = (event: React.MouseEvent) => {
        setVisible(!visible);
    };

    const setInfo = async (channelLocal: Channel) => {
        setMembers(await channelLocal.getMembers());
        if (channelLocal.type === 'system') {
            setColor(channelLocal.visualIdentity.color);
        } else {
            // Use white for default channel
            setColor('#FFFFFF');
        }
    };

    React.useEffect(() => {
        setInfo(channel);
        fdc3.addEventListener('channel-changed', (event) => {
            const changedChannel = event.channel || event.previousChannel;
            if (changedChannel!.id === channel.id) {
                changedChannel!.getMembers().then((result) => {
                    setMembers(result);
                });
            }
            setInfo(channel);
        });
    }, [channel]);

    return (
        <React.Fragment>
            <div className="details">{members.length}</div>
            <div className="color" title="Click to show members." onClick={handleVisible} style={{backgroundColor: color}}></div>
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
