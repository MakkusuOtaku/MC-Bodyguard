const mineflayer = require('mineflayer')

const bossName = "Makkusu_Otaku"; //Your name here.... unless?
const prefix = "Bodyguard";

const server = {
	address: "localhost",
	version: "1.16.4",
};

const botCount = 3;
const personalSpace = 4;

var offset = 0;
var bots = [];

var target;

function createBot() {
	let bot = mineflayer.createBot({
		host: server.address,
		username: `${prefix}_${bots.length}`,
		version: server.version,
		viewDistance: "tiny",
	});

	bot.id = bots.length;
	bot.direction = Math.PI*2/botCount*bots.length;

	bot.on('kicked', (reason, loggedIn) => console.log(reason, loggedIn));
	bot.on('error', err => console.log(err));

	bot.on('move', ()=>{
		let boss = bot.players[bossName];
		if (!boss) return;
		boss = boss.entity;
		if (!boss) return;

		offset = boss.yaw;
		let location;

		if (target) {
			location = target.position;
		} else {
			let x = Math.sin(bot.direction+offset)*personalSpace;
			let z = Math.cos(bot.direction+offset)*personalSpace;
			location = boss.position.offset(x, 0, z);
		}

		bot.lookAt(location);
		if (target) bot.attack(target);

		if (bot.entity.position.xzDistanceTo(location) > personalSpace) {
			bot.setControlState('forward', true);
			bot.setControlState('sprint', true);
			bot.setControlState('jump', bot.entity.isCollidedHorizontally);
		}
	});
	return(bot);
}

function mainChat(username, message) {
	if (username != bossName) return;
	let tokens = message.split(' ');

	switch(tokens[0]) {
		case 'kill':
			bots[0].chat("Received.");
			target = bots[0].nearestEntity((entity)=>{
				return(entity.displayName == tokens[1] || entity.username == tokens[1]);
			});
			console.log(target);
			break;
		case 'house':
			bots[0].chat("That was a different bot.");
			break;
	}
}

function populate() {
	bots.push(createBot());
	if (bots.length < botCount) {
		setTimeout(populate, 10000);
	} else {
		console.log("Ready!");
		bots[0].on('chat', mainChat);
		bots[0].on('entityGone', (entity)=>{
			if (entity != target) return;
			target = 0;
		});
		bots[0].on('entityHurt', (entity)=>{
			if (entity.username != bossName) return;

			//This needs work :/
			target = bots[0].nearestEntity((entity)=>{
				return(entity.username != bossName && !(entity.username||'').startsWith(prefix));
			});
		});
	}
}

populate();
