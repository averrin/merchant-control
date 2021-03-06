import MainApplication from './view/MainApplication.js';

import { moduleId, SETTINGS } from "./constants.js";
import { initSettings, setting } from "./modules/settings.js";
import { logger } from "./modules/helpers.js";
import { initFoundry } from './modules/foundry.js';


const app = new MainApplication();

Hooks.once('init', async () => {
    initFoundry();
    initSettings(app);
});

Hooks.on('getSceneControlButtons', (buttons) => {
    if (game.user.isGM) {
        const tokenButton = buttons.find(b => b.name == "token");
        if (tokenButton) {
            tokenButton.tools.push({
                name: "merchant-control",
                title: "Merchant Control",
                icon: "fas fa-balance-scale",
                visible: game.user.isGm,
                onClick: () => {
                    app.toggle();
                },
                button: true
            });
        }
    }
});

Hooks.once('ready', async () => {
    if (game.user.isGM) {
        await app.start();
        if (setting(SETTINGS.SHOW)) app.show();

        logger.info("Started!")
    }
});
