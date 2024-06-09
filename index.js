const { fork } = require('child_process');
const readline = require("readline");

const hostName = "localhost";
const hostPort = 12345;

const bots = [];
const botsByName = {};

const autoSpawnBots = 1;
const spawnDelay = 5000;

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function sleep(time) {
    return new Promise(resolve=>setTimeout(resolve, time));
}

function spawnBot(botName) {
	const bot = fork("bot.js", [botName, hostName, hostPort]);

	bots.push(bot);
	botsByName[botName] = bot;

	/*bot.send({
		text: "Testing communication.",
		value: 200,
	});

	bot.on('message', (data) => {
		if (data.type === "status-report") {
			console.log(`${botName}: ${data.health}`);
		}
	});*/
}

async function spawnBots(amount=1) {
	for (let i = 0; i < amount; i++) {
		spawnBot(`guard_${bots.length}`);

		await sleep(spawnDelay);
	}
}

const COMMAND_FUNCTIONS = {
	"ping": ()=>{
		console.log("pong");
	},

	"spawn": (amount)=>{
		spawnBots(Number(amount));
	},
};

function runCommand(command) {
	const tokens = command.split(' ');

	if (tokens[0].startsWith('@')) {
		const botName = tokens[0].slice(1);
		const bot = botsByName[botName];

		if (!bot) {
			console.log(`Couldn't find bot named "${botName}".`);
			return;
		}

		bot.send({
			type: "command",
			command: tokens.slice(1),
		});

		return;
	}

	const commandFunction = COMMAND_FUNCTIONS[tokens[0]];

	if (!commandFunction) {
		console.log(`Unknown command: ${tokens[0]}`);
		return;
	}

	commandFunction(...tokens.slice(1));

	/*if (tokens[0] === "spawn") {
		spawnBots(tokens[1]);
	}*/
}

function inputLoop(command) {
    if (command) runCommand(command);
    reader.question(">", inputLoop);
}

async function main() {
	spawnBots(autoSpawnBots);
	inputLoop();
}

main();
