import {Application} from '../../client/directory';

export function checkCustomConfigField(app: Application, name: string): string | undefined {
    if (app.customConfig) {
        const customField = app.customConfig.find((field) => field.name === name);
        if (customField) {
            return customField.value;
        }
    }
    return undefined;
}
