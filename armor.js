// lists of armor items in order of preferences
const helmets = ["netherite_helmet", "diamond_helmet", "iron_helmet", "golden_helmet", "leather_helmet"];
const chestplates = ["netherite_chestplate", "diamond_chestplate", "iron_chestplate", "golden_chestplate", "leather_chestplate"];
const leggings = ["netherite_leggings", "diamond_leggings", "iron_leggings", "golden_leggings", "leather_leggings"];
const boots = ["netherite_boots", "diamond_boots", "iron_boots", "golden_boots", "leather_boots"];

// FIXME
async function equipArmorItem(bot, armorList, slot) {
    let bestIndex;

    for (item of bot.inventory.slots) {
        if (!item) continue;

        const index = armorList.indexOf(item.name);

        if ((index !== -1) && ((bestIndex === undefined) || (index < bestIndex))) {
            bestIndex = index;
        }
    }

    if (bestIndex !== undefined) {
        const itemName = armorList[bestIndex];
        const item = bot.registry.itemsByName[itemName];
        await bot.equip(item.id, slot).catch(()=>{});
    }
}

module.exports = (bot)=>{
	bot.armor = {};

	bot.armor.equip = async ()=>{
		await equipArmorItem(bot, helmets, "head");
        await equipArmorItem(bot, chestplates, "torso");
        await equipArmorItem(bot, leggings, "legs");
        await equipArmorItem(bot, boots, "feet");
	};

    bot.armor.equipFast = async ()=>{
        await Promise.all([
            equipArmorItem(bot, helmets, "head"),
            equipArmorItem(bot, chestplates, "torso"),
            equipArmorItem(bot, leggings, "legs"),
            equipArmorItem(bot, boots, "feet"),
        ]);
	};

	bot.commands.equiparmor = async ({ log })=>{
		await bot.armor.equip();
    };

    bot.on("playerCollect", async (collector, _collected)=>{
        if (!collector === bot.entity) return;

        await bot.armor.equip();
    });
};