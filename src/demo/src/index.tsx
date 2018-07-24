import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { BlotterApp } from './apps/BlotterApp';
import { ChartsApp } from './apps/ChartsApp';
import { ContactsApp } from './apps/ContactsApp';
import { DialerApp } from './apps/DialerApp';
import { LauncherApp } from './apps/LauncherApp';

import '../public/css/w3.css';

/*
 * This file defines the entry point for all of the applications in this project. This "bootstrap" is intended to allow
 * the creation of many small, simple applications whilst avoiding boilerplate.
 * 
 * Each application has it's own "app.json" file, but each file shares the same HTML page. This file will check the 
 * UUID of the current application in order to determine which React component to create and add to the DOM.
 * 
 * For demo purposes, we also need to have multiple applications capable of handling the same intent. This is done by
 * making the demo applications skinnable, to create several similar applications that differ only in colour scheme.
 * Whilst these applications clearly share the same code, they should be assumed to be completely unrelated 
 * applications, likely made by different vendors, that are both capable of providing the same funcionality.
 */

var uuid: string, color: string;
var app: JSX.Element;

if (window.hasOwnProperty("fin")) {
    uuid = (fin.desktop.Application.getCurrent() as any).uuid;

    //Colours are used to simulate having multiple apps capable of handling the same intent.
    //In this sample they are re-skins of the same application, but in a real scenario they would be completely unrelated applications.
    color = uuid.split("-")[2];
    if (color) {
        //Remove the colour suffix from the application UUID
        uuid = uuid.slice(0, uuid.length - color.length - 1);
    } else {
        //Use default theme
        color = "blue-grey";
    }

    //Add an extra stylesheet to the document, to change the app's appearance
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = "https://www.w3schools.com/lib/w3-theme-" + color + ".css";
    document.getElementsByTagName('head')[0].appendChild(link);

    //Create root React component
    switch(uuid) {
        case "fdc3-launcher":
            app = <LauncherApp />;
            break;

        case "fdc3-blotter":
            app = <BlotterApp />;
            break;
        case "fdc3-charts":
            app = <ChartsApp />;
            break;
        case "fdc3-contacts":
            app = <ContactsApp />;
            break;
        case "fdc3-dialer":
            app = <DialerApp />;
            break;

        default:
            app = (<div>Unknown application uuid: "{uuid}". Add application to index.tsx</div>);
    }
} else {
    app = (<div>You cannot run this sample in the browser. Run this application through OpenFin by following the instructions in the readme.</div>);
}

ReactDOM.render(app, document.getElementById('react-app'));
