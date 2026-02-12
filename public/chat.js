var $form = $("form#frm"),
  url = "https://script.google.com/macros/s/AKfycbz3Yrr44xbSHjfpBE-BPXvm7-EMuo-yPcWPz54iA7tSBHiVhag/exec";

$(document).on("click", "#submit-form", function (e) {
  var data = "Message=" + document.getElementById("frm").elements[0].value;
  if (document.getElementById("frm").elements[0].value == "") {
    return;
  }
  document.getElementById("status").innerHTML = "Sending...";
  document.getElementById("frm").elements[0].value = "";
  e.preventDefault();
  var jqxhr = $.ajax({
    url: url,
    method: "GET",
    dataType: "json",
    data: data, //$form.serializeObject(),
    success: function () {
      document.getElementById("status").innerHTML = "Sent!";
      setTimeout("sentTimedOut()", 1000);
      resetWorker();
    },
  });
});

function sentTimedOut() {
  document.getElementById("status").innerHTML = "";
}

var w;

function startWorker() {
  if (typeof Worker !== "undefined") {
    if (typeof w == "undefined") {
      w = new Worker("chat-worker.js");
    }
    w.onmessage = function (event) {
      document.getElementById("history").innerHTML = event.data;
      document.getElementById("frm").hidden = false;
    };
  } else {
    document.getElementById("history").innerHTML = "Sorry, your browser does not support web workers...";
  }
}

function stopWorker() {
  w.terminate();
  w = undefined;
}

function resetWorker() {
  stopWorker();
  startWorker();
}

window.onload = startWorker();
