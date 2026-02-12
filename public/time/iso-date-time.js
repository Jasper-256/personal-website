function updateTime() {
  var today = new Date();

  var year = today.getUTCFullYear().toString();
  var month = (today.getUTCMonth() + 1).toString().padStart(2, 0);
  var day = today.getUTCDate().toString().padStart(2, 0);
  var hours = today.getUTCHours().toString().padStart(2, 0);
  var minutes = today.getUTCMinutes().toString().padStart(2, 0);
  var seconds = today.getUTCSeconds().toString().padStart(2, 0);
  var miliseconds = today.getUTCMilliseconds().toString().padStart(3, 0);

  document.getElementById("time_long").innerHTML = year + "-" + month + "-" + day + "T" + hours + ":" + minutes + ":" + seconds + "." + miliseconds + "Z";
  document.getElementById("time_short").innerHTML = year + month + day + "T" + hours + minutes + seconds + "." + miliseconds + "Z";
}

window.onload = updateTime;
window.setInterval(updateTime, 1);
