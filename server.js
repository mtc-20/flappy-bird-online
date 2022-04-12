const envConfig = require("dotenv").config();
const express = require("express");
const ably = require("ably");
const gameChannelName = "flappy-bird";
let gameChannel;
let birdCount = 0;
let gameTicker;
let isGameTickerOn = false;
let gameStateObj;
let birds = {};
let highScore = 0;
let hiScoreNickname = "anony mouse";
let birdChannels = {};
let obstacleTimer = 0;
let topScoreChannel;
let topScoreChannelName = "flappy-top-score";

const app = express();
app.use(express.static("public"));

const realtime = new ably.Realtime(
	{key: process.env.ABLY_API_KEY,}
);

const uniqueId = function(){
	return "id-"+Math.random().toString(36).substring(2, 16)
}

app.get("/", (request, response) => {
	response.sendFile(__dirname + "/index.html")
});

app.get("/auth", function (req, res) {
	var tokenParams = {
		clientId: uniqueId(),
  };
	console.log("got new client " + tokenParams.clientId)
  realtime.auth.createTokenRequest(tokenParams, function (err, tokenRequest) {
    if (err) {
      res.status(500).send("Error requesting token: " + JSON.stringify(err));
    } else {
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(tokenRequest));
    }
  });
});

const listener = app.listen(process.env.PORT, () => {
	console.log("App is listening on port " + listener.address().port)
});

realtime.connection.once("connected", () => {
	topScoreChannel = realtime.channels.get(topScoreChannelName, {
		params: {rewind: 1}
	})
	topScoreChannel.subscribe("score", (msg) => {
		highScore = msg.data.score;
		hiScoreNickname = msg.data.nickname;
		topScoreChannel.unsubscribe();
	})
	gameChannel = realtime.channels.get(gameChannelName);
	gameChannel.presence.subscribe("enter", (msg) => {
		if(++birdCount === 1 && !isGameTickerOn){
			gameTicker = setInterval(startGameTick, 200);
			isGameTickerOn = true;
		}
		birds[msg.clientId] = {
			id: msg.clientId,
			left: 220,
			bottom: 100,
			isDead: false,
			nickname: msg.data.nickname,
			score: 0,
		};
		subscribeToPlayerInput(msg.clientId);
	});
	gameChannel.presence.subscribe('leave', (msg) => {
		if (birds[msg.clientId] != undefined) {
			birdCount--;
			birds[msg.clientId].isDead = true;
			setTimeout(() => {

				delete birds[msg.clientId];
			}, 500);

			if (birdCount < 1){
				console.log("STOPPING GAME TICK");
				isGameTickerOn= false;
				clearInterval(gameTicker);
			}
		}
	})
});

function subscribeToPlayerInput(id) {
	birdChannels[id] = realtime.channels.get("bird-position-"+id);
	birdChannels[id].subscribe("pos", (msg) => {
		if (birds[id]){
			birds[id].bottom = msg.data.bottom;
			birds[id].nickname = msg.data.nickname;
			birds[id].score = msg.data.score;
			if (msg.data.score > highScore) {
				highScore = msg.data.score;
				hiScoreNickname = msg.data.nickname;
				topScoreChannel.publish("score", {
					score: highScore,
					nickname: hiScoreNickname,
				});
			}
		}
	})
}


function startGameTick() {
	if (obstacleTimer === 0 || obstacleTimer === 3000) {
		obstacleTimer = 0;
		gameStateObj = {
			birds: birds, 
			highScore: highScore,
			hiScoreNickname: hiScoreNickname,
			launchObstacle: true,
			obstacleHeight:   Math.random()*60
		};
	} else {
		gameStateObj = {
			birds: birds, 
			highScore: highScore,
			hiScoreNickname: hiScoreNickname,
			launchObstacle: false,
			obstacleHeight:   "",

	};}
	obstacleTimer += 100;
	gameChannel.publish("game-state", gameStateObj);
}