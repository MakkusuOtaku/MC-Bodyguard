const mineflayer = require('mineflayer');
const fs = require('fs');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const meleePlugin = require('./melee.js');
const archeryPlugin = require('./archery.js');

if (process.argv.length < 5) process.exit();

const [botName, hostName, hostPort] = process.argv.slice(2);

const LINE_BREAKS = /\r?\n/g;

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

bot.getEntity = (name)=>{
	return bot.nearestEntity((entity)=>{
		return entity.displayName === name || entity.username === name;
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

	let enemy = bot.nearestEntity((entity)=>{
		if (entity.kind !== "Hostile mobs") return false;
		if (entity.position.distanceTo(guardedPlayer.entity.position) < 16) return true;
		if (entity.position.distanceTo(bot.entity.position) < 8) return true;
	});

	if (enemy) {
		await attackEnemy(enemy);
		return;
	}

	let goal = new goals.GoalFollow(guardedPlayer.entity, 4);
	await bot.pathfinder.goto(goal);
}

bot.commands = {
	"continue": async ()=>{
		guarding = true;
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

bot.on('entityGone', (entity)=>{
	const targetIndex = targetList.indexOf(entity);

	if (targetIndex === -1) return;
	
	targetList.splice(targetIndex, 1);
});