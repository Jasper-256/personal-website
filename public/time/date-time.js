Date.prototype.getDOY = function () {
  var today = new Date();
  var onejan = new Date(this.getFullYear(), 0, 1);
  var todayOffsetMins = -today.getTimezoneOffset();
  var onejanOffsetMins = -onejan.getTimezoneOffset();
  var onejanTimezoneOffsetMins = onejanOffsetMins - todayOffsetMins;

  var onejanFinal = new Date(this.getFullYear(), 0, 1, 0, onejanTimezoneOffsetMins);
  return Math.ceil((this - onejanFinal) / 86400000);
};

function updateTime() {
  var today = new Date();

  var year = today.getFullYear().toString();
  var month = (today.getMonth() + 1).toString().padStart(2, 0);
  var day = today.getDate().toString().padStart(2, 0);
  var daynum = today.getDOY().toString().padStart(3, 0);
  var hours = today.getHours().toString().padStart(2, 0);
  var minutes = today.getMinutes().toString().padStart(2, 0);
  var seconds = today.getSeconds().toString().padStart(2, 0);
  var miliseconds = today.getMilliseconds().toString().padStart(3, 0);

  document.getElementById("time").innerHTML = year + "-" + daynum + "  " + hours + ":" + minutes + ":" + seconds + "." + miliseconds;
}

window.onload = updateTime;
window.setInterval(updateTime, 1);
