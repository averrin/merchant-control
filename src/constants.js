export const moduleId = "merchant-control";

// import { foundry } from '../modules/foundry.js';
// import { moduleId, SETTINGS } from '../constants.js';

export const SETTINGS = {
    SHOW: "show",
    UI_SCALE: "ui-scale",
    FOLDER: "folder",
};

export const HOOKS = [
    'controlToken',
    'updateToken',
    'updateActor',
    'targetToken',

    'canvasReady',
    'createToken',
    'deleteToken',
    'deleteActor',
    // 'renderTokenActionHUD',
];

export const rarityPrices = {
    common: [50, 500],
    uncommon: [500, 1000],
    rare: [5000, 10000],
    "vary rare": [50000, 100000],
    legendary: [250000, 500000],
};
