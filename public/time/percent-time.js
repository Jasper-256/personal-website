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
  var rounded_percent_time = Math.round(decimal_time * 10000000) / 100000;

  var end_cut_percent_time = rounded_percent_time.toFixed(5);
  var string_percent_time = end_cut_percent_time.toString().padStart(8, 0) + "%";

  document.getElementById("time").innerHTML = string_percent_time;
}

window.onload = updateTime;
window.setInterval(updateTime, 1);
