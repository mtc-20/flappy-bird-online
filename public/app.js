console.log('Fetching Client token from auth server...')
// const realtime = new Ably.Realtime({
	//     authURL: '/auth'
	// });
	
	const realtime = new Ably.Realtime({ authUrl: '/auth' });
	console.log('Received token.')

document.addEventListener('DOMContentLoaded', ()=> {
	const sky = document.querySelector('.sky');
	const bird = document.querySelector('.bird')
	const gameDisplay = document.querySelector('.game-container')
	const ground = document.querySelector('.ground')
	const scoreLabel = document.getElementById('score-label')
	const scoreList = document.getElementById('score-list')
	const topScoreLabel = document.getElementById('top-label')

	let birdLeft = 220
	let birdBottom = 100
	let gravity = 2
	let isGameOver = false
	let gap = 420
	let score = 0;
	let gameStarted = false;

	let randomAssign = Math.floor(Math.random() * 5)
	const nicknames=["anony mouse", "babo onzle", "crook odile", "don key", "elle pfand"]
	let myNickname= nicknames[randomAssign];
	console.log("My nickname... " + myNickname)
	let highScore = 0;
	let hiScoreNickname = "anony mouse"
	let myClientID;
	let myPublishChannel;
	let gameChannel;
	let gameChannelName = "flappy-bird";
	let gameTimerID;
	let allBirds = {};
	let obstacleTimers = []
	let topScoreChannel;
	let topScoreChannelName = "flappy-top-score"


	
	document.addEventListener('keydown', function (e) {
		if (e.code == "Space" && e.target == document.body){
			e.preventDefault();
		}
	});
	
	realtime.connection.once("connected", () =>{
		// Set up channel with clientID to publish pose
		myClientID = realtime.auth.clientId;
		myPublishChannel= realtime.channels.get("bird-position-"+ myClientID);
		
		// Get topscore channel //
		topScoreChannel = realtime.channels.get(topScoreChannelName, {
			params: {rewind: 1},
		});
		topScoreChannel.subscribe((msg)=>{
			highScore = msg.data.score,
			hiScoreNickname = msg.data.nickname,
			topScoreLabel.innerHTML = "Top score - " + highScore + "pts by " + hiScoreNickname;
			topScoreChannel.unsubscribe()
		})

		// Get main game-state channel
		gameChannel = realtime.channels.get(gameChannelName);

		// Start game only on click
		gameDisplay.onclick = function() {
			if (!gameStarted) {
				gameStarted = true;
				gameChannel.presence.enter({
					nickname: myNickname,
				});
				ground.classList.add('ground-moving');
				ground.classList.remove('ground')
				sendPositionUpdates();
				console.log("Going in")
				showOtherBirds();

				document.addEventListener('keydown', control);
				gameTimerID = setInterval(startGame, 200);
			}
		};
	})



	function startGame() {
		birdBottom -= gravity
		bird.style.bottom = birdBottom + 'px'
		bird.style.left = birdLeft + 'px';
		for (item in allBirds) {
			if (allBirds[item].targetBottom) {
				let tempBottom = parseInt(allBirds[item].el.style.bottom);
				tempBottom += (allBirds[item].targetBottom - tempBottom) * 0.5;
				allBirds[item].el.style.bottom = tempBottom + 'px'; 
			}
		}
		//  End game if bird goes below ground
		if(birdBottom < -10) {
			gameOver();
			isGameOver = true;
		}

	}


	function control(e) {
		if (e.keyCode === 32) {
			e.preventDefault()
			jump()
		}
	}

	function jump() {
		bird.style.backgroundImage="url(bird2.png)";
		if(birdBottom < 500) birdBottom += 45
		bird.style.bottom = birdBottom + 'px'
		// console.log(birdBottom)
		setTimeout(function() {
			bird.style.backgroundImage="url(bird1.png)";
		}, 100)

		
	}

	

	function generateObstacle(randomHeight) {
		if (!isGameOver) {
			let obstacleLeft = 500
			let obstacleBottom = randomHeight

			const obstacle = document.createElement('div')
			const topObstacle = document.createElement('div')
			obstacle.classList.add('obstacle')
			topObstacle.classList.add('topObstacle')
			gameDisplay.appendChild(obstacle)
			gameDisplay.appendChild(topObstacle)
			obstacle.style.left = obstacleLeft + 'px'
			obstacle.style.bottom = obstacleBottom + 'px'
			topObstacle.style.left = obstacleLeft + 'px'
			topObstacle.style.bottom = obstacleBottom + gap + 'px'

			function moveObstacle() {
				obstacleLeft -= 2
				obstacle.style.left = obstacleLeft + 'px'
				topObstacle.style.left = obstacleLeft + 'px'
				if (obstacleLeft === -40) {
					clearInterval(timerID)
					gameDisplay.removeChild(obstacle)
					gameDisplay.removeChild(topObstacle)
					score += 10;
					setTimeout(()=>{
						sortLeaderboard();
					}, 200)
				} 

				if (
					obstacleLeft > 200 && obstacleLeft < 280 && birdLeft === 220 && birdBottom < obstacleBottom+150 ||
					obstacleLeft > 200 && obstacleLeft < 280 && birdLeft === 220 && birdBottom + 25 > obstacleBottom+gap-138 || 
					birdBottom === 0 
					) {
						for (timer in obstacleTimers) {
							clearInterval(obstacleTimers[timer])
						}
						gameOver();
						sortLeaderboard();
						isGameOver = true;
						clearInterval(timerID)
				}
			}
			let timerID = setInterval(moveObstacle, 20)
			obstacleTimers.push(timerID);
		}
		
	}
	

	function gameOver() {
		clearInterval(gameTimerID)
		console.log('Game Over!')
		isGameOver = true
		ground.classList.add('ground');
		ground.classList.remove('ground-moving');
		document.removeEventListener('keydown', control)
		console.log('Score: '+score);
		gameChannel.presence.leave();
		gameChannel.detach();
		realtime.connection.close();
	}


	function sendPositionUpdates() {
		let publishTimer = setInterval(() => {
			myPublishChannel.publish("pos", {
				bottom: parseInt(bird.style.bottom),
				nickname: myNickname,
				score: score,
			});

			if (isGameOver) {
				clearInterval(publishTimer);
				myPublishChannel.detach();
			}
		}, 100);
	}

	function showOtherBirds() {
		gameChannel.subscribe("game-state", (msg) => {
			for(let item in msg.data.birds) {
				if (item != myClientID){
					let newBottom = msg.data.birds[item].bottom;
					let newLeft = msg.data.birds[item].left;
					let isDead = msg.data.birds[item].isDead;
					// If other bird is still alive
					if (allBirds[item] && !isDead) {
						allBirds[item].targetBottom = newBottom;
						allBirds[item].left = newLeft;
						allBirds[item].isDead = msg.data.birds[item].isDead;
						allBirds[item].nickname = msg.data.birds[item].nickname;
						console.log("other name:" + msg.data)
						allBirds[item].score = msg.data.birds[item].score;
					}
					// If other bird is dead
					else if (allBirds[item] && isDead) {
						sky.removeChild(allBirds[item].el);
						delete allBirds[item];
					}
					// If other bird newly joined
					 else {
						if (!isGameOver) {
							allBirds[item] = {};
							allBirds[item].el = document.createElement("div");
							allBirds[item].el.classList.add("other-bird");
							sky.appendChild(allBirds[item].el);
							console.log("creating other")
							allBirds[item].el.style.bottom = newBottom + "px";
							allBirds[item].el.style.left = newLeft + 'px';
							allBirds[item].isDead = msg.data.isDead;
							allBirds[item].nickname = msg.data.nickname;
							allBirds[item].score = msg.data.score;
						}
					}
					
				} else if (item == myClientID) {
					// console.log(item)
					allBirds[item] = msg.data.birds[item];
				}
			}

			if (msg.data.highScore > highScore) {
				highScore = msg.data.highScore;
				hiScoreNickname = msg.data.hiScoreNickname;
				topScoreLabel.innerHTML = "Top Score - " + highScore + " by " + hiScoreNickname;
			}
			// console.log("obst" + msg.data.launchObstacle)
			if (msg.data.launchObstacle == true && !isGameOver) {
				generateObstacle(msg.data.obstacleHeight);
			}
		})
	}

	function sortLeaderboard() {
		scoreLabel.innerHTML = "Score: "+score;
		let listItems = "";
		let leaderboard = new Array();
		for (let item in allBirds) {
			leaderboard.push({
				nickname: allBirds[item].nickname,
				score: allBirds[item].score,
			});
		}
		// Sort based on score
		leaderboard.sort((a,b) => {
			b.score - a.score;
		});

		leaderboard.forEach((bird) => {
			listItems += "<li class='score-item'><span class='name'>" + bird.nickname + " </span><span class='points'>" + bird.score + " pts</span></li>";
		});
		console.log(leaderboard);
		scoreList.innerHTML = listItems;
	}
});