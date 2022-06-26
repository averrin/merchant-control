import {rarityPrices} from '../constants.js';

export function getRandomKey(collection) {
    let index = Math.floor(Math.random() * collection.size);
    let cntr = 0;
    for (let key of collection.keys()) {
        if (cntr++ === index) {
            return key;
        }
    }
}

export async function getRandomItems(rolltable) {
	const rolled = [];
	await rolltable.reset();
    const results = await game.betterTables.getBetterTableResults(rolltable);
	if (!results || results.length == 0) {
	    logger.error("roll failed", rolltable);
	    return rolled;
	}
	for (const result of results) {
        result.parent.reset();
	    let item = result.data;
	    let compendium = game.collections.get(item.collection)
	    if (!compendium) {
	        compendium = game.packs.get(item.collection)
 	        if (compendium) {
    		    const entry = compendium.index.getName(item.text);
    		    if (entry) {
      			    const eItem = await compendium.getDocument(entry._id);
      			    logger.info(eItem);
      			    rolled.push(eItem);
      			    continue;
		        } else {
		            const id = getRandomKey(compendium.index);
		            const rItem = compendium.index.get(id);
		            const eItem = await compendium.getDocument(rItem._id);
		            logger.info(id, rItem, eItem);
      			    rolled.push(eItem);
      			    continue;
		        }
	        }
	    } else {
	        for (let [_id, citem] of compendium.entries()) {
	            if (citem.data.name == item.text) {
      			    logger.info(cItem);
      			    rolled.push(cItem);
      			    continue;
	            }
	        }
	    }
	}
	return rolled;
}

export async function processItem(item, table, token, fix_prices) {
	if (!item || item == null) {console.warn("item is undefined"); return;}
	const embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()],
          	originalItem = embeddedItems.find(i => i.name === item.data.name);
	if (originalItem) {
		originalItem.data.data.quantity++;
		return {_id: originalItem.data._id, "data.quantity": originalItem.data.data.quantity+1};
	} else {
		let items = [];
		try {
			items = await token.actor.createEmbeddedDocuments("Item", [item.data]);
		} catch (e) {
			logger.warn("Addition failed");
			return;
		}
		if (items.length == 0) {
			logger.warn("Addition failed");
			return;
		}
		item = items[0];
        if(item && fix_prices && (item.data.data.price == 0 || item.data.data.price == null)) {
	        let rarity = item.data.data.rarity;
	        let newPriceRange = rarityPrices[rarity];
	        let newPrice = Math.ceil(Math.random()*(newPriceRange[1]-newPriceRange[0])+newPriceRange[0]);
            item.data.data.price = newPrice;
            await token.actor.updateEmbeddedDocuments('Item', [{_id: item.data._id, "data.price": newPrice}]);
        }
	}

}

export async function apply(token, tables, fix_prices, discount) {
    let lsAPI = game.modules.get("lootsheetnpc5e")?.public?.API;
    await clearInventory(token);

	let updates = []
	for (let table of tables) {
		let rolltable = game.tables.find(t => t.data.name === table.table);
		logger.info("rolling", table, rolltable);
		for (let i = 0; i < table.count; i++) {
			let items = await getRandomItems(rolltable);
			if (table.max_price > 0) {
				items = items.filter(i => i.data.data.price <= table.max_price > 0);
			}
			for (const item of items) {
				const r = await processItem(item, table, token, fix_prices);
				if (r) updates.push(r);
			}

    	}
		await token.actor.updateEmbeddedDocuments('Item', updates);
	}

    token.actor.update({"flags.lootsheetnpc5e.priceModifier.sell": 100-discount});
	await lsAPI?.makeObservable([token]);
}

export async function clearInventory(token) {
	let embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()];
    if (embeddedItems.length == 0) return;
	let ids = [];
	ids = embeddedItems.map(a => a.data._id);
	await token.actor.deleteEmbeddedDocuments("Item", ids);
}
