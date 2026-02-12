var shapes = 0;
var minSize = 40;
var maxSize = 60;

function addCircle() {
  var shapes = ["circle", "square"];
  var colors = ["red", "blue", "purple", "green", "orange", "darkred", "grey"];
  var color = colors[Math.floor(Math.random() * colors.length)];
  var size = Math.floor(Math.random() * (maxSize - minSize)) + minSize;
  var newline = '<div style="background-color:' + color + "; height: " + size + "px; width: " + size + 'px;" class="' + shapes[Math.floor(Math.random() * shapes.length)] + '"><div/>\n<p><p/>';
  document.getElementById("innerdiv").innerHTML += newline;
}

function updateCircles() {
  if ((window.innerHeight + window.pageYOffset) * 1.5 >= document.body.offsetHeight) {
    addCircle();
    shapes += 1;
  }
}

setInterval(updateCircles, 1);
