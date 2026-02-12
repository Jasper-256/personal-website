Date.prototype.getDozenalHours = function () {
  var hours = this.getHours();
  switch (hours) {
    case 10:
      return "X";
    case 11:
      return "E";
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
    case 21:
      return (hours - 2).toString();
    case 22:
      return "1X";
    case 23:
      return "1E";
    case 24:
      return "20";
    default:
      return hours.toString();
  }
};

function updateTime() {
  var today = new Date();

  var dozenalHours = today.getDozenalHours().padStart(2, 0);
  var minutes = today.getMinutes().toString().padStart(2, 0);
  var seconds = today.getSeconds().toString().padStart(2, 0);
  var miliseconds = today.getMilliseconds().toString().padStart(3, 0);

  if (document.getElementById("type").innerHTML == "big") {
    document.getElementById("time").innerHTML = dozenalHours + ":" + minutes;
  } else {
    document.getElementById("time").innerHTML = dozenalHours + ":" + minutes + ":" + seconds + "." + miliseconds;
  }
}

window.onload = updateTime;
window.setInterval(updateTime, 1);
