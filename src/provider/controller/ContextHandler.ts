import {injectable} from "inversify";
import {AppWindow} from "../model/AppWindow";
import {Context} from "../../client/main";

@injectable()
export class ContextHandler {
    public async send(app: AppWindow, context: Context): Promise<void> {
    }

    public async broadcast(context: Context): Promise<void> {
    }
}