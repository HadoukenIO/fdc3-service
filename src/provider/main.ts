import { APIHandler } from "./APIHandler";
import { APITopic, TopicPayloadMap, TopicResponseMap } from "../client/internal";
import { actionHandlerMap } from "./APIMappings";

async function main(): Promise<void> {
    const apiManager: APIHandler<APITopic, TopicPayloadMap, TopicResponseMap> = new APIHandler();
    await apiManager.registerListeners(actionHandlerMap);
}

main();

