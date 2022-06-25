<script>
    export let elementRoot;
    import '../styles/main.scss';
    import { v4 as uuidv4 } from 'uuid';
    import Select from 'svelte-select';

    import { XIcon } from "@rgossiaux/svelte-heroicons/solid";
    import {logger} from '../modules/helpers.js';
    import {setting} from '../modules/settings.js';
    import {moduleId, SETTINGS, rarityPrices} from '../constants.js';
    import { ApplicationShell }   from '@typhonjs-fvtt/runtime/svelte/component/core';
    import { onDestroy } from 'svelte';

    import {tokensStore, currentScene}          from '../modules/stores.js';

    import { getContext } from 'svelte';
    const { application } = getContext('external');
    const position = application.position;
    position.scale = game.settings.get(moduleId, SETTINGS.UI_SCALE);

    let availableTables = []
    for (let table of game.tables) {
	    if (table.folder && table.folder.data.name == setting(SETTINGS.FOLDER)) {
            availableTables.push(table.data.name);
        }
    }

    let selection;
    const unsubscribe2 = tokensStore.subscribe(async (value) => {
        if (value.length > 0) {
            selection = value[0];
        }
    });
    onDestroy(unsubscribe2);

    const unsubscribe3 = currentScene.subscribe(scene => {
    });
    onDestroy(unsubscribe3);
    let isMerchant;
    $: isMerchant = selection?.document.actor.sheet.options.classes.includes('lsnpc');

    let lsAPI = game.modules.get("lootsheetnpc5e")?.public?.API;
    let discount = 0;

    async function convert() {
        if (!lsAPI) return;
        await lsAPI.convertToken(selection, 'merchant');
	    await lsAPI.makeObservable([selection]);
        isMerchant = selection?.document.actor.sheet.options.classes.includes('lsnpc');
    }

    async function saveTables() {
        await globalThis.debounce(selection?.document.update({'flags.merchant-control-tables': tables}), 100);
    }

    async function addTable() {
        tables = [{id: uuidv4(), count: 0, table: ''}, ...tables]
        await saveTables();
    }

    import SortableList from 'svelte-sortable-list';
    let tables = [];
    $: tables = selection?.document.data.flags['merchant-control-tables'] || [];

    const sortTables = async (ev) => {
        let sorted = ev.detail.filter(a => a);
        if (sorted.length == tables.length) {
            tables = sorted;
            await saveTables();
        }
    };

	async function handleSelect(event, tableSpec) {
	    tableSpec.table = event.detail.value;
        await saveTables();
	}
	async function handleClear(event, tableSpec) {
	    tableSpec.table = '';
        await saveTables();
	}
	async function deleteAction(e, tableSpec) {
        tables = tables.filter(t => t.id != tableSpec.id);
        await saveTables();
	}
    // $: globalThis.debounce(selection?.document.update({'flags.merchant-control-tables': tables}), 100);

    const groupBy = (i) => i.group;

    async function getRandomItem(rolltable) {
	    await rolltable.reset();
        const results = await game.betterTables.getBetterTableResults(rolltable);
	    if (!results) {
	        logger.error("roll failed");
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
      			    logger.info(eItem);
			        return eItem;
		        }
	        }
	    } else {
	        for (let [_id, citem] of compendium.entries()) {
	            if (citem.data.name == item.text) {
      			    logger.info(cItem);
	                return citem;
	            }
	        }
	    }
	    logger.error("roll failed", item);
	    return null;
    }

    const isLootable = (item) => !['class', 'spell', 'feat'].includes(item.type);

    let fix_prices = true;
    async function apply() {
        await saveTables();
        let token = selection;
        await clearInventory(token);

	    let updates = []
	    for (let table of tables) {
		    let rolltable = game.tables.find(t => t.data.name === table.table);
		    logger.info("rolling", table, rolltable);
			for (let i = 0; i < table.count; i++) {
				let item = await getRandomItem(rolltable);
				let t = 0;
				while (t < 5 && item && (table.max_price > 0 && item.data.data.price > table.max_price)) {
					item = await getRandomItem(rolltable);
				}
				if (!item || item == null || (table.max_price > 0 && item.data.data.price > table.max_price)) {console.warn("item is undefined or overpriced"); continue;}
				const embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()],
          				originalItem = embeddedItems.find(i => i.name === item.data.name);
				if (originalItem) {
				    updates.push({_id: originalItem.data._id, "data.quantity": originalItem.data.data.quantity+1});
				} else {
					let items = [];
					try {
					    items = await token.actor.createEmbeddedDocuments("Item", [item.data]);
					} catch (e) {
					    logger.warn("Addition failed");
					    continue;
					}
					if (items.length == 0) {
					    logger.warn("Addition failed");
					    continue;
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
		    await token.actor.updateEmbeddedDocuments('Item', updates);
	    }

        token.actor.update({"flags.lootsheetnpc5e.priceModifier.sell": 100-discount});
	    await lsAPI?.makeObservable([selection]);
    }

    async function clearInventory(token) {
	    let embeddedItems = [...token.actor.getEmbeddedCollection('Item').values()];
        if (embeddedItems.length == 0) return;
	    let ids = [];
	    ids = embeddedItems.map(a => a.data._id);
	    await token.actor.deleteEmbeddedDocuments("Item", ids);
    }
    let coins = {};
    $: if(selection) coins = Object.entries(selection?.document.actor.getRollData().currency);

    function toggleType() {
        let type = selection.document.actor.data.flags.lootsheetnpc5e.lootsheettype;
        type = {Loot: "Merchant", Merchant: "Loot"}[type]
        selection.document.actor.update({"flags.lootsheetnpc5e.lootsheettype": type});
    }

    function updateCurrency() {
        selection.actor.update({ 'data.currency': selection?.document.actor.getRollData().currency });
    }
</script>


<svelte:options accessors={true}/>

<ApplicationShell bind:elementRoot>
    <main class="merchant-control-ui p-2">
        {#if selection}
            <div class="ui-card ui-card-side bg-base-100 shadow-xl">
              <figure>
                  <img class="h-[64px]" style="border: none;" src="{selection.data.img}" alt="Selected image">
              </figure>
              <div class="ui-card-body p-[20px]">
                <h2 class="ui-card-title">
                    {selection.data.name}
                    <span class="ui-badge"
                        class:ui-badge-ghost={selection.data.hidden}
                        class:ui-badge-success={!selection.data.hidden}
                        on:click={() => selection.document.update({hidden: !selection.data.hidden})}
                    >
                        {selection.data.hidden ? 'hidden' : 'visible'}
                    </span>

                    {#if isMerchant}
                        <span class="ui-badge ui-badge-secondary"
                            on:click={toggleType}
                        >
                            {selection.document.actor.data.flags.lootsheetnpc5e.lootsheettype}
                        </span>
                    {/if}

                    <button class="ui-btn ui-btn-link ui-btn-ghost w-16 ui-btn-xs" on:click={() => selection.document.actor.sheet.render(true)}>Edit</button>
                </h2>
                <p>
                    <span class="mx-1 flex flex-row">
                        {#each coins as coin}
                            <label class="ui-input-group mx-1">
                                <span class="ui-{coin[0]}">{coin[0]}</span>
                                <input type="number"
                                    bind:value={selection.document.actor.data.data.currency[coin[0]]}
                                    on:blur={updateCurrency}
                                    placeholder="0"
                                    class="ui-input ui-input-xs"
                                    style="border-color: #ddd; width: 3rem;" />
                            </label>
                        {/each}
                    </span>
                </p>
              </div>
            </div>
            {#if lsAPI && !isMerchant}
                <button class="ui-btn my-1" on:click={convert}>Set Merchant sheet</button>
            {/if}

            <button class="ui-btn ui-btn-outline ui-btn-primary my-1" on:click={e => addTable()}>Add Table</button>

            <SortableList 
                list={tables} 
                key="id"
                let:item
                let:index={index}
                on:sort={sortTables}
            >
                <div class="flex flex-row bg-white rounded-xl shadow-lg p-2 items-center space-x-2 cursor-move">
	                <Select items={availableTables} {groupBy}
	                    value={item.table}
	                    on:select={e => handleSelect(e, item)}
	                    on:clear={e => handleClear(e, item)}/>
                    <label class="ui-input-group">
                        <span>Count</span>
                        <input type="number"
                            bind:value={tables[index].count}
                            placeholder="0"
                            class="ui-input w-40 ui-input-lg"
                            style="height: 40px;border-color: #ddd;font-size: 16px; padding-left: 12px;" />
                    </label>

                    <label class="ui-input-group">
                        <span class="w-28">Max gp</span>
                        <input type="number"
                            bind:value={tables[index].max_price}
                            placeholder="0"
                            class="ui-input w-40 ui-input-lg"
                            style="height: 40px;border-color: #ddd;font-size: 16px; padding-left: 12px;" />
                    </label>

                    <button class="ui-btn ui-btn-outline ui-btn-error ui-btn-square" on:click={e => deleteAction(e, item)}>
                        <XIcon class="h-8 w-8"/>
                    </button>
                </div>
            </SortableList>
            {#if tables.length > 0}
                <div class="ui-form-control flex flex-row bg-white rounded-xl shadow-lg p-2 items-center space-x-2">

                {#if lsAPI}
                    <label class="ui-input-group w-64">
                        <span class="w-40">Discount %</span>
                        <input type="number"
                            bind:value={discount}
                            placeholder="0"
                            class="ui-input w-40 ui-input-lg"
                            style="height: 40px;border-color: #ddd;font-size: 16px; padding-left: 12px;" />
                    </label>
                {/if}

                  <label class="ui-label cursor-pointer">
                    <span class="ui-label-text">Fix zero prices</span> 
                    <input type="checkbox" class="ui-toggle ui-toggle-accent" style="border: 1px solid #ccc;" bind:checked={fix_prices} />
                  </label>

                </div>

                <button class="ui-btn my-1" on:click={apply}>Apply</button>
            {/if}


        {:else}
            <div class="p-4">Please select an NPC</div>
        {/if}
    </main>
</ApplicationShell>
