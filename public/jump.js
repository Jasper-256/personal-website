let score = 0;
var highScore = localStorage.getItem("hi");
if (highScore === null) {
  highScore = "0";
}
document.getElementById("score").innerHTML = "HI " + highScore + " " + score;
let rotation = 0;
let threshold = 20;

let gameOver = false;
let sigChar = "j";

function move() {
  run();
  if (gameOver) {
    return;
  }
  let charOn1 = detChar("1");
  let track = document.getElementById("track").textContent;

  let first = "r"; // track.charAt(0);

  if ((rotation > threshold && Math.floor(Math.random() * 15) == 0) || score == 0) {
    // rotation == threshold) { // Math.floor(Math.random() * 2) + 8) {
    first = "|";
    rotation = 0;
  } else {
    first = "_";
  }

  track = track.slice(1, track.length);
  track = track + first;

  let upperTrack = track.split("");
  for (item in upperTrack) {
    if (upperTrack[item] == "_") {
      upperTrack[item] = "&nbsp";
    }
  }

  // replace = 17;
  // track = track.substr(0, replace) + "x" + track.substr(replace + 1);
  let gameOverLocal = false;

  if (charOn1 && track[16] == "|") {
    gameOverLocal = true;
  } else {
    gameOverLocal = false;
  }

  document.getElementById("track").innerHTML = track;
  document.getElementById("1").innerHTML = upperTrack.join("");
  rotation++;

  putChar("1", charOn1);

  score++;
  document.getElementById("score").innerHTML = "HI " + highScore + " " + score;

  if (gameOverLocal) {
    gameOverFunc();
  }
}

function gameOverFunc() {
  gameOver = true;
  document.getElementById("title").innerHTML = "Game Over";
  document.getElementById("button").innerHTML = "Play Again";
  document.getElementById("track").innerHTML = "________________________________________________________________________________________________________________________________";
  document.getElementById("1").innerHTML = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
  putChar("1", true);
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("hi", highScore);
  }
  score = 0;
}

let intervalMS = 40;
function run() {
  intervalMS = (1 / (score / 10 + 100)) * 2500 + 20;
  setTimeout(move, intervalMS);
}

function putChar(on, add) {
  let arr = document.getElementById(on).textContent.split("");
  if (add) {
    arr[16] = sigChar;
  } else {
    arr[16] = "&nbsp";
  }
  let str = arr.join("");
  document.getElementById(on).innerHTML = str;
}

function detChar(on) {
  let arr = document.getElementById(on).textContent.split("");
  if (arr[16] == sigChar) {
    return true;
  } else {
    return false;
  }
}

run();
putChar("1", true);

function jump1() {
  putChar("2", false);
  putChar("3", true);
}

function jump2() {
  putChar("3", false);
  putChar("2", true);
}

function jump3() {
  putChar("2", false);
  putChar("1", true);
}

document.onkeypress = function (e) {
  e = e || window.event;
  if (e.key == " " || String(e.key) == "Enter" || e.key == "j") {
    buttonClicked();
  }
};

function buttonClicked() {
  if (document.getElementById("title").innerText == "Game Over") {
    gameOver = false;
    document.getElementById("title").innerHTML = "Playing";
    document.getElementById("button").innerHTML = "Jump";
  } else {
    if (detChar("1")) {
      putChar("1", false);
      putChar("2", true);
      setTimeout(jump1, 200);
      setTimeout(jump2, 400);
      setTimeout(jump3, 600);
    }
  }
}
