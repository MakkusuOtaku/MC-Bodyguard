const hawkeye = require('minecrafthawkeye');

function hasArrows(bot) {
	let arrowItem = bot.registry.itemsByName['arrow'];
	let arrows = bot.inventory.count(arrowItem.id);

	return arrows > 0;
}

function hasBow(bot) {
	let bowItem = bot.registry.itemsByName['bow'];
	return bot.inventory.count(bowItem.id) > 0;
}

async function shoot(bot, target) {
	await bot.hawkEye.oneShot(target, "bow");
};

module.exports = (bot)=>{
	bot.loadPlugin(hawkeye.default);
	bot.archery = {};

	bot.archery.canShoot = ()=>{
		return hasArrows(bot) && hasBow(bot);
	};

	bot.archery.hasArrows = ()=>{
		return hasArrows(bot);
	};

	bot.archery.hasBow = ()=>{
		return hasBow(bot);
	};

	bot.archery.shoot = async (target)=>{
		await shoot(bot, target);
	};

	bot.commands.shoot = async (targetName, { log })=>{
		const target = bot.getEntity(targetName);

		if (target) bot.archery.shoot(target);
		else log(`Couldn't find ${targetName}.`);
	};
};