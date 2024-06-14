const mineflayer = require('mineflayer');
const fs = require('fs');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

const meleePlugin = require('./melee.js');
const archeryPlugin = require('./archery.js');
const armorPlugin = require('./armor.js');

if (process.argv.length < 5) process.exit();

const [botName, hostName, hostPort] = process.argv.slice(2);

const LINE_BREAKS = /\r?\n/g;
const HUNGER_LIMIT = 5;

const bossList = fs.readFileSync("boss-list.txt", "utf8").split(LINE_BREAKS);
const targetList = fs.readFileSync("target-list.txt", "utf8").split(LINE_BREAKS);

let defaultMove;
let guardedPlayer;
let guarding = true;

function getPathDuration(path) {
	return path.cost; // TODO: calculate duration of path (in seconds)
}

const bot = mineflayer.createBot({
    username: botName,
    host: hostName,
    port: hostPort,
    viewDistance: "tiny",
});

bot.on('kicked', console.log);
bot.on('error', console.log);

bot.loadPlugin(pathfinder);
bot.loadPlugin(meleePlugin);
bot.loadPlugin(archeryPlugin);
bot.loadPlugin(armorPlugin);

bot.getEntity = (name)=>{
	return bot.nearestEntity((entity)=>{
		return entity.displayName === name || entity.username === name;
	});
}

function findThreat() {
	return bot.nearestEntity((entity)=>{
		if (entity.kind !== "Hostile mobs" && !targetList.includes(entity.username)) return false;

		const distanceFromBot = entity.position.distanceTo(bot.entity.position);

		if (distanceFromBot < 8) return true;

		if (!guardedPlayer || !guardedPlayer.entity) return false;

		const distanceFromPlayer = entity.position.distanceTo(guardedPlayer.entity.position);

		if (distanceFromPlayer < 16) return true;
	});
}

function findAttacker(position=bot.entity.position) {
	return bot.nearestEntity((entity)=>{
		if (bossList.includes(entity.username)) return false;

		const distance = entity.position.distanceTo(position);

		if (distance < 5) return true;
	});
}

async function attackEnemy(enemy) {
	const pos = bot.entity.position;
	const enemyGoal = new goals.GoalNear(pos.x, pos.y, pos.z, 4);
	const pathToBot = bot.pathfinder.getPathFromTo(defaultMove, enemy.position, enemyGoal);

	let path = pathToBot.next().value.result;

	while (path.status === 'partial') {
		path = pathToBot.next().value.result;
	}

	const timeToArrival = getPathDuration(path);
	const timeToDrawBow = 4;

	if (bot.archery.canShoot() && timeToArrival > timeToDrawBow) {
		await bot.archery.shoot(enemy);
	} else {
		let goal = new goals.GoalFollow(enemy, 4);

		await bot.pathfinder.goto(goal);

		await bot.melee.equip();
		await bot.melee.punch(enemy);
	}
}

async function loop() {
	if (!guarding) return;

	const enemy = findThreat();

	if (enemy) {
		await attackEnemy(enemy);
		return;
	}

	let goal = new goals.GoalFollow(guardedPlayer.entity, 4);
	await bot.pathfinder.goto(goal);
}

async function eatFood(log=sendMessage) {
	if (bot.food === 20) {
		log(`too full to eat`);
		return;
	}

	for (food of bot.registry.foodsArray) {
		const amount = bot.inventory.count(food.id);

		if (amount === 0) continue;

		log(`found ${amount} ${food.displayName}`);
		
		await bot.equip(food.id);

		await bot.consume();

		log(`ate 1 ${food.displayName}`);

		return;
	}

	log("out of food");
}

bot.commands = {
	"continue": async ()=>{
		guarding = true;
	},

	"eat": async ({ log })=>{
		await eatFood(log);
	},

	"guard": async (username, { log })=>{
		const player = bot.players[username];

		if (!player) {
			log(`Player "${username}" does not exist.`);
			return;
		}

		guardedPlayer = player;
	},

	"ping": async ({ log })=>{
		log("pong");
	},

	"status": async ({ log })=>{
		log(`❤${bot.health} 🥕${bot.food}`);
	},

	"stop": async ({ log })=>{
		log("Stopping.");
		bot.pathfinder.setGoal(null);
		guarding = false;
	},
};

async function runCommand(tokens, user, log) {
	const commandFunction = bot.commands[tokens[0]];

	if (!commandFunction) {
		log("Unknown command.");
		return;
	}

    await commandFunction(...tokens.slice(1), {
    	user: user,
		log: log,
    });
}

function sendMessage(text) {
	process.send({
		type: "message",
		text: text,
	});
}

process.on('message', (data)=>{
	if (data.type === "command") {
		runCommand(data.command, user="admin", log=sendMessage);
		return;
	}

	console.log(`${botName} recieved unknown message: `, data);
});

bot.once("spawn", async ()=>{
	bot.chat("I'm a robot.");
	
	defaultMove = new Movements(bot);
	bot.pathfinder.setMovements(defaultMove);

	// find a boss
	while (true) {
		let foundBoss = bot.nearestEntity((entity)=>{
			return bossList.includes(entity.username);
		});

		if (foundBoss) {
			guardedPlayer = bot.players[foundBoss.username];
			break;
		}

		const enemy = findThreat();
		if (enemy) await attackEnemy(enemy);

		await bot.waitForTicks(5);
	}

	// protect boss
	while (true) {
		await bot.waitForTicks(1);
		await loop();
	}
});

bot.on("chat", async (username, message)=>{
	if (!bossList.includes(username)) return;

	const tokens = message.split(' ');

	await runCommand(tokens, user=username, log=bot.chat);
});

bot.on("whisper", async (username, message)=>{
	if (!bossList.includes(username)) return;

	const tokens = message.split(' ');

	await runCommand(tokens, user=username, log=(text)=>bot.whisper(username, text));
});

bot.on("health", async ()=>{
	if (bot.food > HUNGER_LIMIT) return;

	sendMessage(`hunger has reached ${bot.food}!`);

	await eatFood();
});

bot.on("entityGone", (entity)=>{
	const targetIndex = targetList.indexOf(entity.username);

	if (targetIndex === -1) return;
	
	targetList.splice(targetIndex, 1);
});

bot.on("entityHurt", (entity)=>{
	let attacked = false;

	if (entity === bot.entity) attacked = true;

	if (guardedPlayer && guardedPlayer.entity) {
		if (entity === guardedPlayer.entity) attacked = true;
	}

	if (attacked) {
		sendMessage(`${entity.username} was hurt!`);

		const attacker = findAttacker(bot.entity.position);

		if (attacker && !targetList.includes(attacker.username)) {
			targetList.push(attacker.username);
		}
	}
});