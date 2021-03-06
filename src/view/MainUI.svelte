<svelte:options accessors={true} />

<script>
   export let elementRoot;
   import "../styles/main.scss";
   import { v4 as uuidv4 } from "uuid";
   import Select from "svelte-select";

   import { XIcon } from "@rgossiaux/svelte-heroicons/solid";
   import { logger } from "../modules/helpers.js";
   import { apply } from "../modules/logic.js";
   import { setting } from "../modules/settings.js";
   import { moduleId, SETTINGS } from "../constants.js";
   import { ApplicationShell } from "@typhonjs-fvtt/runtime/svelte/component/core";
   import { onDestroy } from "svelte";
   import Sortable from "./components/Sortable.svelte";
   import FaArrowsAlt from "svelte-icons/fa/FaArrowsAlt.svelte";

   import { tokensStore, currentScene } from "../modules/stores.js";

   import { getContext } from "svelte";
   const { application } = getContext("external");
   const position = application.position;
   position.scale = game.settings.get(moduleId, SETTINGS.UI_SCALE);

   let availableTables = [];
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

   const unsubscribe3 = currentScene.subscribe((scene) => {});
   onDestroy(unsubscribe3);
   let isMerchant;
   $: isMerchant = selection?.document.actor.sheet.options.classes.includes("lsnpc");

   let lsAPI = game.modules.get("lootsheetnpc5e")?.public?.API;
   let discount = 0;

   async function convert() {
      if (!lsAPI) return;
      await lsAPI.convertToken(selection, "merchant");
      await lsAPI.makeObservable([selection]);
      isMerchant = selection?.document.actor.sheet.options.classes.includes("lsnpc");
   }

   async function saveTables() {
      await globalThis.debounce(selection?.document.update({ "flags.merchant-control-tables": tables }), 100);
   }

   async function addTable() {
      tables = [{ id: uuidv4(), count: 0, table: "" }, ...tables];
      await saveTables();
   }

   let tables = [];
   $: tables = selection?.document.data.flags["merchant-control-tables"] || [];

   const sortTables = async (ev) => {
      let sorted = ev.detail.filter((a) => a);
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
      tableSpec.table = "";
      await saveTables();
   }
   async function deleteAction(e, tableSpec) {
      tables = tables.filter((t) => t.id != tableSpec.id);
      await saveTables();
   }
   // $: globalThis.debounce(selection?.document.update({'flags.merchant-control-tables': tables}), 100);

   const groupBy = (i) => i.group;

   const isLootable = (item) => !["class", "spell", "feat"].includes(item.type);

   let fix_prices = true;
   let coins = {};
   $: if (selection) coins = Object.entries(selection?.document.actor.getRollData().currency);

   function toggleType() {
      let type = selection.document.actor.data.flags.lootsheetnpc5e.lootsheettype;
      type = { Loot: "Merchant", Merchant: "Loot" }[type];
      selection.document.actor.update({ "flags.lootsheetnpc5e.lootsheettype": type });
   }

   function updateCurrency() {
      selection.actor.update({ "data.currency": selection?.document.actor.getRollData().currency });
   }

   async function applyTables() {
      await saveTables();
      apply(selection, tables, fix_prices, discount);
   }
</script>

<ApplicationShell bind:elementRoot>
   <main class="merchant-control-ui ui-p-2" id="merchant-control">
      {#if selection}
         <div class="ui-card ui-card-side ui-bg-base-100 ui-shadow-xl">
            <figure>
               <img class="ui-h-[64px]" style="border: none;" src={selection.data.img} alt="Selected image" />
            </figure>
            <div class="ui-card-body ui-p-[20px]">
               <h2 class="ui-card-title">
                  {selection.data.name}
                  <span
                     class="ui-badge"
                     class:ui-badge-ghost={selection.data.hidden}
                     class:ui-badge-success={!selection.data.hidden}
                     on:click={() => selection.document.update({ hidden: !selection.data.hidden })}
                  >
                     {selection.data.hidden ? "hidden" : "visible"}
                  </span>

                  {#if isMerchant}
                     <span class="ui-badge ui-badge-secondary" on:click={toggleType}>
                        {selection.document.actor.data.flags.lootsheetnpc5e.lootsheettype}
                     </span>
                  {/if}

                  <button
                     class="ui-btn ui-btn-link ui-btn-ghost ui-w-16 ui-btn-xs"
                     on:click={() => selection.document.actor.sheet.render(true)}>Edit</button
                  >
               </h2>
               <p>
                  <span class="ui-mx-1 ui-flex ui-flex-row">
                     {#each coins as coin}
                        <label class="ui-input-group ui-mx-1">
                           <span class="ui-{coin[0]}">{coin[0]}</span>
                           <input
                              type="number"
                              bind:value={selection.document.actor.data.data.currency[coin[0]]}
                              on:blur={updateCurrency}
                              placeholder="0"
                              class="ui-input ui-input-xs"
                              style="border-color: #ddd; width: 3rem;"
                           />
                        </label>
                     {/each}
                  </span>
               </p>
            </div>
         </div>
         {#if lsAPI && !isMerchant}
            <button class="ui-btn ui-my-1" on:click={convert}>Set Merchant sheet</button>
         {/if}

         <button class="ui-btn ui-btn-outline ui-btn-primary ui-my-1" on:click={(e) => addTable()}>Add Table</button>

         <Sortable items={tables} let:item let:index on:change={sortTables} options={{ handle: ".handle" }}>
            <div
               class="ui-flex ui-flex-row ui-bg-white ui-rounded-xl ui-shadow-lg ui-p-2 ui-items-center ui-gap-3 ui-cursor-move ui-my-1"
            >
               <button
                  class="ui-btn ui-btn-square ui-btn-ghost handle ui-justify-self-start ui-cursor-move"
                  style="color: #46525d; padding: 8px"
                  title="move"
               >
                  <FaArrowsAlt />
               </button>

               <Select
                  items={availableTables}
                  {groupBy}
                  value={item.table}
                  on:select={(e) => handleSelect(e, item)}
                  on:clear={(e) => handleClear(e, item)}
               />
               <label class="ui-input-group">
                  <span>Count</span>
                  <input
                     type="number"
                     bind:value={tables[index].count}
                     placeholder="0"
                     class="ui-input ui-w-40 ui-input-lg"
                     style="height: 40px;border-color: #ddd;font-size: 16px; padding-left: 12px;"
                  />
               </label>

               <label class="ui-input-group">
                  <span class="ui-w-28">Max gp</span>
                  <input
                     type="number"
                     bind:value={tables[index].max_price}
                     placeholder="0"
                     class="ui-input ui-w-40 ui-input-lg"
                     style="height: 40px;border-color: #ddd;font-size: 16px; padding-left: 12px;"
                  />
               </label>

               <button class="ui-btn ui-btn-outline ui-btn-error ui-btn-square" on:click={(e) => deleteAction(e, item)}>
                  <XIcon class="ui-h-8 ui-w-8" />
               </button>
            </div>
         </Sortable>
         {#if tables.length > 0}
            <div
               class="ui-form-control ui-flex ui-flex-row ui-bg-white ui-rounded-xl ui-shadow-lg ui-p-2 ui-items-center ui-space-x-2"
            >
               {#if lsAPI}
                  <label class="ui-input-group ui-w-64">
                     <span class="ui-w-40">Discount %</span>
                     <input
                        type="number"
                        bind:value={discount}
                        placeholder="0"
                        class="ui-input ui-w-40 ui-input-lg"
                        style="height: 40px;border-color: #ddd;font-size: 16px; padding-left: 12px;"
                     />
                  </label>
               {/if}

               <label class="ui-label ui-cursor-pointer">
                  <span class="ui-label-text">Fix zero prices</span>
                  <input
                     type="checkbox"
                     class="ui-toggle ui-toggle-accent"
                     style="border: 1px solid #ccc;"
                     bind:checked={fix_prices}
                  />
               </label>
            </div>

            <button class="ui-btn ui-my-1" on:click={applyTables}>Apply</button>
         {/if}
      {:else}
         <div class="ui-p-4">Please select an NPC</div>
      {/if}
   </main>
</ApplicationShell>
