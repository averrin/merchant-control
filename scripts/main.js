class MerchantControl {
  static ID = 'merchant-control';

  static FLAGS = {
    SETTINGS: "settings"
  }

  static SETTINGS = {
    BUTTON: "button",
    PRICES: "prices",
    LOOTSHEET: "lootsheet",
    BROWSER: "browser",
    FOLDER: "folder",
  }

  static TEMPLATES = {
    MAIN: `modules/${this.ID}/templates/main.hbs`
  }

  /**
   * A small helper function which leverages developer mode flags to gate debug logs.
   * 
   * @param {boolean} force - forces the log even if the debug flag is not on
   * @param  {...any} args - what to log
   */
  static log(force, ...args) {  
    const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(this.ID);

    if (shouldLog) {
      console.log(this.ID, '|', ...args);
    }
  }

    static init() {
        Hooks.once("init", this.foundryInit);
        Hooks.once("ready", this.foundryReady);
        Hooks.on('getSceneControlButtons', this.attachSceneControlButtons);
        Hooks.on('controlToken', this.onControlToken);
    }

    static foundryInit() {
        game.settings.register(MerchantControl.ID, MerchantControl.SETTINGS.BUTTON, {
          name: `Show button`,
          default: true,
          type: Boolean,
          scope: 'client',
          config: true,
          hint: `Button in the left tool bar`,
        });

        game.settings.register(MerchantControl.ID, MerchantControl.SETTINGS.FOLDER, {
          name: `Tables folder`,
          default: "Merchants",
          type: String,
          scope: 'client',
          config: true,
          hint: `Rolltables folder for suggestions`,
        });

        game.settings.register(MerchantControl.ID, MerchantControl.SETTINGS.LOOTSHEET, {
          name: `Loot Sheet NPC 5e integration`,
          default: false,
          type: Boolean,
          scope: 'client',
          config: true,
          hint: `Optional. Requires Loot Sheet NPC 5e module.`,
        });

        game.settings.register(MerchantControl.ID, MerchantControl.SETTINGS.BROWSER, {
          name: `Compendium Browser enhancements`,
          default: false,
          type: Boolean,
          scope: 'client',
          config: true,
          hint: `Optional. Requires Compendium Browser module. Add more filters & item export`,
        });

        const rarityPrices = {
            common: [50, 500],
            uncommon: [500, 1000],
            rare: [5000, 10000],
            "vary rare": [50000, 100000],
            legendary: [250000, 500000],
        };

        game.settings.register(MerchantControl.ID, MerchantControl.SETTINGS.PRICES, {
          name: `Prices`,
          default: JSON.stringify(rarityPrices),
          type: Object,
          scope: 'client',
          config: true,
          hint: `Price ranges for items with zero price`,
        });

        game.settings.register(MerchantControl.ID, MerchantControl.SETTINGS.BUTTON, {
          name: `Show button`,
          default: true,
          type: Boolean,
          scope: 'client',
          config: true,
          hint: `Button in the left tool bar`,
          // onChange: () => ui.players.render()
        });
    }

    static onControlToken(token, selected) {
        const selectedTokens = canvas.tokens.controlled;
        MerchantControl.log(false, selectedTokens.length);

        let u = game.users.get(game.userId);
        let data = u.getFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS);
        data.selected = selectedTokens.length;
        (async () => {
            await u.setFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS, data);
            MerchantControl.window.render();
        })();
    }

    static foundryReady() {
        game.users.get(game.userId)?.setFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS, {
            clear: false,
            fix_prices: true,
            discount: 0,
            max_price: 0,
            tables: [
                {name: "", count: 0},
            ],
            availableTables: [],
            selected: 0,
        });

        if (!game.settings.get(MerchantControl.ID, MerchantControl.SETTINGS.BROWSER)) {
            return
        }
        setTimeout(() => {
            if (game.compendiumBrowser) {
                game.compendiumBrowser.addItemFilter(game.i18n.localize("CMPBrowser.general"), "Price", 'data.price', 'numberCompare');
                game.compendiumBrowser.addItemFilter("Magic Items", "Attunement", 'data.attunement', 'select', ["Not Required", "Required"]);

                game.exportBrowser = MerchantControl.exportBrowser;

                Hooks.on('renderCompendiumBrowser', (cb, html) => {
                    MerchantControl.log(false, "browser rendered");
                    const items = html.find(`[data-tab="item"] .list-area`);
                    items.append("<button onclick='game.exportBrowser()' style='flex:0;margin:6px;'>Export as Roll Table</button>");
                });
            } else {
                MerchantControl.log(true, "Compendium Browser isnt installed");
            }
        }, 2500);
    }

    static exportBrowser() {
        let tableName = "Exported items";

        new Dialog({
	        title: "Export items from Compendium Browser",
	        content: `<form><input type=text id=tableName value="${tableName}"></form>`,
	        buttons: {one: {
		        label: "Export",
		        callback: (html) => {
			        tableName = html.find("#tableName")[0].value;
			        (async () => {await MerchantControl.exportItems(tableName);})();
		        }
	        }}
        },{width: 300}).render(true);

    }

    static async exportItems(tableName) {
        let citems = await game.compendiumBrowser.loadAndFilterItems("item", (i, f) => f && console.log(`Loaded: ${i}`));

        citems = Object.values(citems).map(item => ({
                  type: CONST.TABLE_RESULT_TYPES.COMPENDIUM,
                  collection: item.compendium,
                  text: item.name,
                  img: item.img,
                  weight: 1,
                  range: [1, 1]
                }));
        let table = await RollTable.create({
            name: tableName,
            results: citems
          });
        table.normalize();
        console.log("Export finished");
        ui.notifications.info(`Rolltable ${tableName} with ${table.results.size} entries was generated.`);
    }

    static attachSceneControlButtons(buttons) {
        if (!game.settings.get(MerchantControl.ID, MerchantControl.SETTINGS.BUTTON)) {
            return;
        }

        let tokenButton = buttons.find(b => b.name == "token");
        if (tokenButton) {
            tokenButton.tools.push({
                name: "mc-ui",
                title: "Merchant Control",
                icon: "fas fa-balance-scale",
                visible: game.user.isGm,
                onClick: () => MerchantControl.open(),
                button: true
            });
        }
    }

    static open() {
        this.log(false, "Open");
        MerchantControl.window = new MerchantControlWindow();
        MerchantControl.window.render(true, { userId: game.userId })
    }

}

class MerchantControlWindow extends FormApplication {
  static get defaultOptions() {
    const defaults = super.defaultOptions;
  
    const overrides = {
      closeOnSubmit: false,
      height: 'auto',
      id: 'merchant-control',
      submitOnChange: false,
      template: MerchantControl.TEMPLATES.MAIN,
      title: 'Merchant Control',
      userId: game.userId,
    };
  
    const mergedOptions = foundry.utils.mergeObject(defaults, overrides);
    
    return mergedOptions;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.on('click', "[data-action]", this._handleButtonClick.bind(this));
  }

  async _handleButtonClick(event) {
    await this.submit();
    const clickedElement = $(event.currentTarget);
    const action = clickedElement.data().action;
    let data = game.users.get(game.userId)?.getFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS);
    if (action == "add-table") {
        data.tables.push({name: "", count: 0});
    } else if (action == "remove-table") {
        const id = clickedElement.data().id;
        data.tables.splice(id, 1);
        MerchantControl.log(false, 'new tables list', {tables: data.tables});
    } else if (action == "exec") {
        await this.giveItems();
    } else if (action == "update") {
        this.updateItems();
    } else if (action == "close") {
        this.close();
    }
    
    await game.users.get(game.userId)?.setFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS, data);
    MerchantControl.log(false, 'Button Clicked!', {action});
    await this.submit();
    this.render();
  }

  async _updateObject(event, formData) {
    const expandedData = foundry.utils.expandObject(formData);
    let data = game.users.get(game.userId)?.getFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS);

    // await ToDoListData.updateUserToDos(this.options.userId, expandedData);
    MerchantControl.log(false, 'saving', expandedData);

    let n = 0;
    expandedData.tables = [];
    for (let table of data.tables) {

        let name = expandedData[`table-name-${n}`];
        let count = expandedData[`num-items-${n}`];
        expandedData.tables.push({name, count});
        n++;
    }

    await game.users.get(game.userId)?.setFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS, expandedData);

    this.render();
  }

  getData(options) {
    const tableFolder = game.settings.get(MerchantControl.ID, MerchantControl.SETTINGS.FOLDER);
    const lootsheet = game.settings.get(MerchantControl.ID, MerchantControl.SETTINGS.LOOTSHEET);

    let availableTables = []
    for (let table of game.tables) {
	    if (table.folder && table.folder.data.name == tableFolder) {
            availableTables.push(table.data.name);
        }
    }
    const rarityPrices = JSON.parse(game.settings.get(MerchantControl.ID, MerchantControl.SETTINGS.PRICES));

    let data = game.users.get(game.userId)?.getFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS);
    data.availableTables = availableTables;
    data.rarityPrices = rarityPrices;
    data.lootsheet = lootsheet;
    return data;
  }

async clearInventory(token) {
	let embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()];
    if (embeddedItems.length == 0) return;
	let ids = [];
	ids = embeddedItems.map(a => a.data._id);
	await token.actor.deleteEmbeddedDocuments("Item", ids);
}

async getRandomItem(rolltable) {
	await rolltable.reset();
    const results = await game.betterTables.getBetterTableResults(rolltable);
	if (!results) {
	    console.error("roll failed");
	    return null;
	}
	let item = results[0].data;
	let compendium = game.collections.get(item.collection)
	if (!compendium) {
	    compendium = game.packs.get(item.collection)
 	    if (compendium) {
    		    const entry = compendium.index.getName(item.text);
    		    if (entry) {
      			    let eItem = await compendium.getDocument(entry._id);
			    MerchantControl.log(false, `rolled: ${item.text} == ${item}`);
			    return eItem;
		    }
	    }
	} else {
	    for (let [_id, citem] of compendium.entries()) {
	        if (citem.data.name == item.text) {
			    MerchantControl.log(false, `rolled: ${item.text} == ${citem}`);
	            return citem;
	        }
	    }
	}
    MerchantControl.log(false, '=========')
	MerchantControl.log(false, "roll failed");
	MerchantControl.log(false, item);
    MerchantControl.log(false, '=========')
}

async updateItems() {
    let data = game.users.get(game.userId)?.getFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS);
    const selectedTokens = canvas.tokens.controlled;

	let multiplier = 1;
    multiplier -= data.discount/100;

	for (let token of selectedTokens) {
	    const embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()];
	    let updates = []
	    let remove = []
	    for (let item of embeddedItems) {
            item.data.data.price = item.data.data.price*multiplier
	        MerchantControl.log(false, `${item.data.data.price} > ${data.max_price}`);
	        if (data.max_price > 0 && item.data.data.price > data.max_price) {
	            remove.push(item.data._id);
	        } else {
	            updates.push({_id: item.data._id, "data.price": item.data.data.price});
	        }
	    }
        await token.actor.updateEmbeddedDocuments('Item', updates);
        MerchantControl.log(false, remove);
        await token.actor.deleteEmbeddedDocuments('Item', remove);
    }
    if (data.lootsheet && data.convert_sheet) {
	    const API = game.modules.get("lootsheetnpc5e")?.public?.API;
	    selectedTokens.forEach(e => API.convertToken(e, data.sheet_type));
	    await API.makeObservable(selectedTokens);
    }
}

async giveItems() {
    let data = game.users.get(game.userId)?.getFlag(MerchantControl.ID, MerchantControl.FLAGS.SETTINGS);
    const selectedTokens = canvas.tokens.controlled;

	if(data.clear) selectedTokens.forEach(e => this.clearInventory(e));
	let updates = []
	for (let table of data.tables) {
		let rolltable = game.tables.find(t => t.data.name === table.name);
		for (let token of selectedTokens) {
			for (let i = 0; i < table.count; i++) {
				let item = await this.getRandomItem(rolltable);
				let t = 0;
				while (t < 5 && item && (data.max_price > 0 && item.data.data.price > data.max_price)) {
					item = await this.getRandomItem(rolltable);
				}
				if (!item || item == null || (data.max_price > 0 && item.data.data.price > data.max_price)) {console.warn("item is undefined or overpriced"); continue;}
				const embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()],
          				originalItem = embeddedItems.find(i => i.name === item.data.name);
				if (originalItem) {
				    updates.push({_id: originalItem.data._id, "data.quantity": originalItem.data.data.quantity+1});
				} else {
					// MerchantControl.log(false, item);
					let items = [];
					try {
					    items = await token.actor.createEmbeddedDocuments("Item", [item.data]);
					} catch (e) {
					    console.warn("Addition failed");
					    continue;
					}
					if (items.length == 0) {
					    console.warn("Addition failed");
					    continue;
					}
					item = items[0];
                    if(item && data.fix_prices && (item.data.data.price == 0 || item.data.data.price == null)) {
	                    let rarity = item.data.data.rarity;
	                    let newPriceRange = rarityPrices[rarity];
	                    let newPrice = Math.ceil(Math.random()*(newPriceRange[1]-newPriceRange[0])+newPriceRange[0]);
                        MerchantControl.log(false, `${rarity}, ${newPriceRange}, ${newPrice}`);
                        item.data.data.price = newPrice;
                        await token.actor.updateEmbeddedDocuments('Item', [{_id: item.data._id, "data.price": newPrice}]);
                    } else {
                        /* MerchantControl.log(false, '=========')
					    MerchantControl.log(false, item);
					    MerchantControl.log(false, `${data.fix_prices} ${item.data.data.price}`);
                        MerchantControl.log(false, '=========') */
                    }
				    if(item) {
				        let multiplier = 1;
                        multiplier -= data.discount/100;
				        updates.push({_id: item.data._id, "data.price": item.data.data.price*multiplier});
                    }
				}
    		}
		    await token.actor.updateEmbeddedDocuments('Item', updates);
		}
	}

	selectedTokens.forEach(async e => await this.addCurrency(data, e));

    if (data.lootsheet && data.convert_sheet) {
	    const API = game.modules.get("lootsheetnpc5e").public.API;
	    selectedTokens.forEach(e => API.convertToken(e, data.sheet_type));
	    await API.makeObservable(selectedTokens);
	}
}
    async addCurrency(data, token) {
        if (data.currency == "") return;
        let count = (await (new Roll(data.currency)).roll({ async: true })).total;
		MerchantControl.log(false, `adding ${count} gp`);
        let currencyData = duplicate(token.actor.data.data.currency);
        currencyData.gp += count;
        await token.actor.update({ 'data.currency': currencyData });
    }
}

/**
 * Register our module's debug flag with developer mode's custom hook
 */
Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MerchantControl.ID);
});

MerchantControl.init();
