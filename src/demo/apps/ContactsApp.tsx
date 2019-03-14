import * as React from 'react';
import * as fdc3 from '../../client/index';
import {ContactsTable} from '../components/contacts/ContactsTable';
import {Payload, ContactPayload} from '../../client/index';

import '../../../res/demo/css/w3.css';

const initialContactsState: Contact[] = [
    {"name": "Tailor D'Angeli", "email": "tdangeli0@toplist.cz", "phone": "4475836763"},
    {"name": "Flossie Sackett", "email": "fsackett1@ihg.com", "phone": "7728469257"},
    {"name": "Ginelle Tallant", "email": "gtallant2@yale.edu", "phone": "2524970037"},
    {"name": "Christoper Letrange", "email": "cletrange3@altervista.org", "phone": "8167973339"},
    {"name": "Damian Peggram", "email": "dpeggram4@sciencedirect.com", "phone": "7634911375"},
    {"name": "Abram Jacquemard", "email": "ajacquemard5@booking.com", "phone": "2065047535"},
    {"name": "Essa Gibben", "email": "egibben6@cyberchimps.com", "phone": "1643511094"},
    {"name": "Vidovic Dolby", "email": "vdolby7@dyndns.org", "phone": "5379152226"},
    {"name": "Alain Parris", "email": "aparris8@pagesperso-orange.fr", "phone": "5643113394"},
    {"name": "Garald Morde", "email": "gmorde9@exblog.jp", "phone": "6996319800"},
    {"name": "Carlene Yushachkov", "email": "cyushachkova@timesonline.co.uk", "phone": "6489419332"},
    {"name": "Kelcy Bourgourd", "email": "kbourgourdb@latimes.com", "phone": "5961805349"},
    {"name": "Sydney Fatscher", "email": "sfatscherc@nba.com", "phone": "3943290438"},
    {"name": "Emeline Tarquinio", "email": "etarquiniod@npr.org", "phone": "8719709707"},
    {"name": "Morena Gaitskell", "email": "mgaitskelle@so-net.ne.jp", "phone": "3349239607"},
    {"name": "Laurene Logsdail", "email": "llogsdailf@sitemeter.com", "phone": "3469357354"},
    {"name": "Gradeigh Oganesian", "email": "goganesiang@ustream.tv", "phone": "6847841054"},
    {"name": "Stacey Skittreal", "email": "sskittrealh@blogs.com", "phone": "4666283343"},
    {"name": "Rudyard Feldberger", "email": "rfeldbergeri@comcast.net", "phone": "9373567990"},
    {"name": "Doralynne Gregolin", "email": "dgregolinj@people.com.cn", "phone": "9386210249"}
];

export interface Contact {
    name: string;
    phone: string | null;
    email: string | null;
}


export function ContactsApp(): React.ReactElement {
    const [contacts, setContacts] = React.useState(initialContactsState);
    function handleIntent(context: ContactPayload) {
        if (context && context.name) {
            const newContact: Contact = {
                name: context.name,
                phone: context.id.phone || null,
                email: context.id.email || null
            };
            setContacts(contacts.concat(newContact));
        }
    }

    React.useEffect(() => {
        document.title = "Contacts";
    });

    React.useEffect(() => {
        const intent = new fdc3.IntentListener(fdc3.Intents.SAVE_CONTACT, (context: Payload): Promise<void> => {
            return new Promise((resolve: () => void, reject: (reason?: Error) => void) => {
                try {
                    handleIntent(context as ContactPayload);
                    resolve();
                } catch (e) {
                    reject(new Error("SAVE_CONTACT intent requires a valid contact context"));
                }
            });
        });
        //Cleanup
        return () => {
            intent.unsubscribe();
        };
    }, []);


    return (
        <ContactsTable items={contacts} />
    );
}