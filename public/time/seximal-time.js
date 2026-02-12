function updateTime() {
  var date = new Date();

  var hours = date.getHours();
  var hoursday = hours / 24;

  var minutes = date.getMinutes();
  var minutesday = minutes / 1440;

  var seconds = date.getSeconds();
  var secondsday = seconds / 86400;

  var milliseconds = date.getMilliseconds();
  var millisecondsday = milliseconds / 86400000;

  var decimal_time = hoursday + minutesday + secondsday + millisecondsday;

  var seximal_time = decimal_time.toString(6);

  var seximal_time_round = seximal_time.padEnd(25, 0).slice(2);
  var seximal_time_formated = seximal_time_round.slice(0, 2) + ":" + seximal_time_round.slice(2, 4) + ":" + seximal_time_round.slice(4, 6) + "." + seximal_time_round.slice(6, 8);

  document.getElementById("time").innerHTML = seximal_time_formated;
}

window.onload = updateTime;
window.setInterval(updateTime, 1);
