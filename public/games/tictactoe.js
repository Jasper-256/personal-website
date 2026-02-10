function pointer(sq, isPointer) {
  if (isPointer) {
    document.getElementById(sq + "a").className = "pointer";
    document.getElementById(sq + "b").className = "pointer";
    document.getElementById(sq + "c").className = "pointer";
  } else {
    document.getElementById(sq + "a").className = "";
    document.getElementById(sq + "b").className = "";
    document.getElementById(sq + "c").className = "";
  }
}

function x(sq) {
  document.getElementById(sq + "a").innerHTML = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
  document.getElementById(sq + "b").innerHTML = "&nbsp&nbsp\\/&nbsp&nbsp";
  document.getElementById(sq + "c").innerHTML = "&nbsp&nbsp/\\&nbsp&nbsp";
  pointer(sq, false);
}

function o(sq) {
  document.getElementById(sq + "a").innerHTML = "&nbsp&nbsp__&nbsp&nbsp";
  document.getElementById(sq + "b").innerHTML = "&nbsp|&nbsp&nbsp|&nbsp";
  document.getElementById(sq + "c").innerHTML = "&nbsp|__|&nbsp";
  pointer(sq, false);
}

function r(sq) {
  document.getElementById(sq + "a").innerHTML = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
  document.getElementById(sq + "b").innerHTML = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
  document.getElementById(sq + "c").innerHTML = "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp";
  pointer(sq, true);
}

function q(sq) {
  if (document.getElementById(sq + "a").innerHTML == "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" && document.getElementById(sq + "b").innerHTML == "&nbsp;&nbsp;\\/&nbsp;&nbsp;" && document.getElementById(sq + "c").innerHTML == "&nbsp;&nbsp;/\\&nbsp;&nbsp;") {
    return "x";
  } else if (document.getElementById(sq + "a").innerHTML == "&nbsp;&nbsp;__&nbsp;&nbsp;" && document.getElementById(sq + "b").innerHTML == "&nbsp;|&nbsp;&nbsp;|&nbsp;" && document.getElementById(sq + "c").innerHTML == "&nbsp;|__|&nbsp;") {
    return "o";
  } else {
    return "r";
  }
}

let youFirst = true;
let gameOver = false;
let playerMark = "x";
let aiMark = "o";
const MSG_PLAYER_WINS = "Ummm... You just won. Computer is extremely confused.";
const MSG_COMPUTER_WINS = "Computer wins";
const MSG_DRAW = "Draw";

function playerPlace(sq) {
  if (playerMark === "x") x(sq); else o(sq);
}

function aiPlace(sq) {
  if (aiMark === "x") x(sq); else o(sq);
}

function c(sq) {
  if (q(sq) == "r" && gameOver == false) {
    check();

    playerPlace(sq);

    check();

    ai();

    check();

    if (!gameOver) {
      document.getElementById("status").innerHTML = "Your turn (" + playerMark.toUpperCase() + ")";
    }
  }
}

// Checks if a square is goable (empty) or not
function goable(sq) {
  if (q(sq) == "r") {
    sqToGo = sq;
    return true;
  } else {
    return false;
  }
}

let sqToGo = 5;

// AI! (Not really...)
function ai() {
  if (gameOver == true) {
    return;
  }

  sqToGo = Math.floor(Math.random() * 9) + 1;

  // Goes for corner square
  if (q(1) == "r" || q(3) == "r" || q(7) == "r" || q(9) == "r") {
    let leave = false;

    while (!leave) {
      let temp = Math.floor(Math.random() * 4) + 1;
      switch (temp) {
        case 1:
          goable(1);
          if (goable(1)) {
            leave = true;
          }
          break;
        case 2:
          goable(3);
          if (goable(3)) {
            leave = true;
          }
          break;
        case 3:
          goable(7);
          if (goable(7)) {
            leave = true;
          }
          break;
        case 4:
          goable(9);
          if (goable(9)) {
            leave = true;
          }
          break;
      }
    }
  }

  if ((q(1) == playerMark && q(9) == playerMark) || (q(3) == playerMark && q(7) == playerMark)) {
    if (q(2) == "r" || q(4) == "r" || q(6) == "r" || q(8) == "r") {
      let leave = false;

      while (!leave) {
        let temp = Math.floor(Math.random() * 4) + 1;
        switch (temp) {
          case 1:
            goable(2);
            if (goable(2)) {
              leave = true;
            }
            break;
          case 2:
            goable(4);
            if (goable(4)) {
              leave = true;
            }
            break;
          case 3:
            goable(6);
            if (goable(6)) {
              leave = true;
            }
            break;
          case 4:
            goable(8);
            if (goable(8)) {
              leave = true;
            }
            break;
        }
      }
    }
  }

  let cornersToGo = [];
  if (q(2) == playerMark) {
    cornersToGo.push(1);
    cornersToGo.push(3);
  }
  if (q(4) == playerMark) {
    cornersToGo.push(1);
    cornersToGo.push(7);
  }

  if (q(6) == playerMark) {
    cornersToGo.push(3);
    cornersToGo.push(9);
  }

  if (q(8) == playerMark) {
    cornersToGo.push(7);
    cornersToGo.push(9);
  }

  while (cornersToGo.length != 0) {
    let randomCorner = Math.floor(Math.random() * cornersToGo.length);
    goable(cornersToGo[randomCorner]);
    cornersToGo.splice(randomCorner, 1);
  }

  // goable(1);
  // goable(3);
  // goable(7);
  // goable(9);

  goable(5);

  // Horizontal
  if (q(1) == playerMark && q(2) == playerMark) {
    goable(3);
  }
  if (q(4) == playerMark && q(5) == playerMark) {
    goable(6);
  }
  if (q(7) == playerMark && q(8) == playerMark) {
    goable(9);
  }

  // Vertical
  if (q(1) == playerMark && q(4) == playerMark) {
    goable(7);
  }
  if (q(2) == playerMark && q(5) == playerMark) {
    goable(8);
  }
  if (q(3) == playerMark && q(6) == playerMark) {
    goable(9);
  }

  // Cross
  if (q(1) == playerMark && q(5) == playerMark) {
    goable(9);
  }
  if (q(3) == playerMark && q(5) == playerMark) {
    goable(7);
  }

  // Horizontal
  if (q(2) == playerMark && q(3) == playerMark) {
    goable(1);
  }
  if (q(5) == playerMark && q(6) == playerMark) {
    goable(4);
  }
  if (q(8) == playerMark && q(9) == playerMark) {
    goable(7);
  }

  // Vertical
  if (q(4) == playerMark && q(7) == playerMark) {
    goable(1);
  }
  if (q(5) == playerMark && q(8) == playerMark) {
    goable(2);
  }
  if (q(6) == playerMark && q(9) == playerMark) {
    goable(3);
  }

  // Cross
  if (q(5) == playerMark && q(9) == playerMark) {
    goable(1);
  }
  if (q(5) == playerMark && q(7) == playerMark) {
    goable(3);
  }

  // Horizontal
  if (q(1) == playerMark && q(3) == playerMark) {
    goable(2);
  }
  if (q(4) == playerMark && q(6) == playerMark) {
    goable(5);
  }
  if (q(7) == playerMark && q(9) == playerMark) {
    goable(8);
  }

  // Vertical
  if (q(1) == playerMark && q(7) == playerMark) {
    goable(4);
  }
  if (q(2) == playerMark && q(8) == playerMark) {
    goable(5);
  }
  if (q(3) == playerMark && q(9) == playerMark) {
    goable(6);
  }

  // Cross
  if (q(1) == playerMark && q(9) == playerMark) {
    goable(5);
  }
  if (q(3) == playerMark && q(7) == playerMark) {
    goable(5);
  }

  // Horizontal
  if (q(1) == aiMark && q(2) == aiMark) {
    goable(3);
  }
  if (q(4) == aiMark && q(5) == aiMark) {
    goable(6);
  }
  if (q(7) == aiMark && q(8) == aiMark) {
    goable(9);
  }

  // Vertical
  if (q(1) == aiMark && q(4) == aiMark) {
    goable(7);
  }
  if (q(2) == aiMark && q(5) == aiMark) {
    goable(8);
  }
  if (q(3) == aiMark && q(6) == aiMark) {
    goable(9);
  }

  // Cross
  if (q(1) == aiMark && q(5) == aiMark) {
    goable(9);
  }
  if (q(3) == aiMark && q(5) == aiMark) {
    goable(7);
  }

  // Horizontal
  if (q(2) == aiMark && q(3) == aiMark) {
    goable(1);
  }
  if (q(5) == aiMark && q(6) == aiMark) {
    goable(4);
  }
  if (q(8) == aiMark && q(9) == aiMark) {
    goable(7);
  }

  // Vertical
  if (q(4) == aiMark && q(7) == aiMark) {
    goable(1);
  }
  if (q(5) == aiMark && q(8) == aiMark) {
    goable(2);
  }
  if (q(6) == aiMark && q(9) == aiMark) {
    goable(3);
  }

  // Cross
  if (q(5) == aiMark && q(9) == aiMark) {
    goable(1);
  }
  if (q(5) == aiMark && q(7) == aiMark) {
    goable(3);
  }

  // Horizontal
  if (q(1) == aiMark && q(3) == aiMark) {
    goable(2);
  }
  if (q(4) == aiMark && q(6) == aiMark) {
    goable(5);
  }
  if (q(7) == aiMark && q(9) == aiMark) {
    goable(8);
  }

  // Vertical
  if (q(1) == aiMark && q(7) == aiMark) {
    goable(4);
  }
  if (q(2) == aiMark && q(8) == aiMark) {
    goable(5);
  }
  if (q(3) == aiMark && q(9) == aiMark) {
    goable(6);
  }

  // Cross
  if (q(1) == aiMark && q(9) == aiMark) {
    goable(5);
  }
  if (q(3) == aiMark && q(7) == aiMark) {
    goable(5);
  }

  if (q(1) == "r" && q(2) == "r" && q(3) == "r" && q(4) == "r" && q(5) == "r" && q(6) == "r" && q(7) == "r" && q(8) == "r" && q(9) == "r") {
    sqToGo = Math.floor(Math.random() * 9) + 1;
  }

  if (q(sqToGo) == "r") {
    aiPlace(sqToGo);
  } else {
    ai();
    return;
  }
}

// Clear the bord
function clr() {
  r(1);
  r(2);
  r(3);
  r(4);
  r(5);
  r(6);
  r(7);
  r(8);
  r(9);
  youFirst = !youFirst;
  gameOver = false;
  if (youFirst) {
    playerMark = "x";
    aiMark = "o";
  } else {
    playerMark = "o";
    aiMark = "x";
  }
  document.getElementById("status").innerHTML = "Your turn (" + playerMark.toUpperCase() + ")";
  if (!youFirst) {
    ai();
  }
  check();
}

// Checking for conditions (wins)
function check() {
  checkForDraws();
  checkForXWins();
  checkForOWins();
  checkClear();
}

function checkClear() {}

function checkForDraws() {
  if (q(1) != "r" && q(2) != "r" && q(3) != "r" && q(4) != "r" && q(5) != "r" && q(6) != "r" && q(7) != "r" && q(8) != "r" && q(9) != "r") {
    document.getElementById("status").innerHTML = MSG_DRAW;
    gameOver = true;
  }
}

function checkForXWins() {
  let l = "x";

  // Horizontal
  if (q(1) == l && q(2) == l && q(3) == l) {
    xWins();
  }
  if (q(4) == l && q(5) == l && q(6) == l) {
    xWins();
  }
  if (q(7) == l && q(8) == l && q(9) == l) {
    xWins();
  }

  // Vertical
  if (q(1) == l && q(4) == l && q(7) == l) {
    xWins();
  }
  if (q(2) == l && q(5) == l && q(8) == l) {
    xWins();
  }
  if (q(3) == l && q(6) == l && q(9) == l) {
    xWins();
  }

  // Cross
  if (q(1) == l && q(5) == l && q(9) == l) {
    xWins();
  }
  if (q(3) == l && q(5) == l && q(7) == l) {
    xWins();
  }
}

function checkForOWins() {
  let l = "o";

  // Horizontal
  if (q(1) == l && q(2) == l && q(3) == l) {
    oWins();
  }
  if (q(4) == l && q(5) == l && q(6) == l) {
    oWins();
  }
  if (q(7) == l && q(8) == l && q(9) == l) {
    oWins();
  }

  // Vertical
  if (q(1) == l && q(4) == l && q(7) == l) {
    oWins();
  }
  if (q(2) == l && q(5) == l && q(8) == l) {
    oWins();
  }
  if (q(3) == l && q(6) == l && q(9) == l) {
    oWins();
  }

  // Cross
  if (q(1) == l && q(5) == l && q(9) == l) {
    oWins();
  }
  if (q(3) == l && q(5) == l && q(7) == l) {
    oWins();
  }
}

function clearPointers() {
  pointer(1, false);
  pointer(2, false);
  pointer(3, false);
  pointer(4, false);
  pointer(5, false);
  pointer(6, false);
  pointer(7, false);
  pointer(8, false);
  pointer(9, false);
}

function xWins() {
  gameOver = true;
  document.getElementById("status").innerHTML = playerMark === "x" ? MSG_PLAYER_WINS : MSG_COMPUTER_WINS;
  clearPointers();
}

function oWins() {
  gameOver = true;
  document.getElementById("status").innerHTML = playerMark === "o" ? MSG_PLAYER_WINS : MSG_COMPUTER_WINS;
  clearPointers();
}
