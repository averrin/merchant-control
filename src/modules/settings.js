import { moduleId, SETTINGS } from '../constants.js';
import { foundry } from './foundry.js';

export let setting = key => {
    return game.settings.get(moduleId, key);
};

const debouncedReload = debounce(() => window.location.reload(), 100);
export function initSettings(app) {
    game.settings.register(moduleId, SETTINGS.SHOW, {
	    scope: "client",
	    config: false,
	    type: Boolean,
	    default: false,
    });

    foundry.settings.register(moduleId, SETTINGS.UI_SCALE, {
      name: 'UI scale',
      hint: 'If ui are too big or too small for your display. Requires refresh.',
      config: true,
      type: Number,
      default: 1,
      onChange: value => {
        debouncedReload();
      },
      range: {
        min: 0.1,
        max: 2,
        step: 0.01
      }
    });

    game.settings.register(moduleId, SETTINGS.FOLDER, {
      name: `Tables folder`,
      default: "Merchants",
      type: String,
      scope: 'client',
      config: true,
      hint: `Rolltables folder for suggestions`,
    });
}
