Date.prototype.getUTCDOYZeroIndex = function () {
  var yearstart = new Date(this.getFullYear(), 0, 1);
  var timezoneOffset = yearstart.getTimezoneOffset();
  var onejan = new Date(this.getUTCFullYear(), 0, 1, -(timezoneOffset / 60));
  return Math.ceil((this.getTime() - onejan.getTime()) / 86400000) - 1;
};

function updateAge() {
  let today = new Date();
  let year = today.getUTCFullYear();
  var days = today.getUTCDOYZeroIndex().toString().padStart(3, 0);
  var hours = today.getUTCHours().toString().padStart(2, 0);
  var minutes = today.getUTCMinutes().toString().padStart(2, 0);
  var seconds = today.getUTCSeconds().toString().padStart(2, 0);
  var miliseconds = today.getUTCMilliseconds().toString().padStart(3, 0);
  let predictedUniverseAge = 13785000000;
  let holoceneEraOffset = 10000;

  let totalAgeYears = predictedUniverseAge + holoceneEraOffset + year;
  let yearsFormatted = totalAgeYears.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  document.getElementById("age").innerText = yearsFormatted + " yrs, " + days + " days, " + hours + " hrs, " + minutes + " mins, " + seconds + "." + miliseconds + " secs";
}

window.onload = updateAge;
window.setInterval(updateAge, 1);
