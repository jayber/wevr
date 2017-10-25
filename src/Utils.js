import $ from "jquery";

export default function log (message, server = false, echo = true ) {
  if (server) {
    let name = window.wevr.id + "-" + (readCookie('name') || '[none]');
    $.get("log", {user: name, message: message});
  }
  if (echo) {
    console.log(message);
  }
}

function errorLog (e, line) {
  let name =  window.wevr.id + "-" + (readCookie('name') || '[none]');

  var stack = line;
  var data;
  if (e.error) {
    stack = e.error.stack;
    data = {user: name, message: e.error.message, stack: stack};
  } else if (e.message) {
    if (e.stack) {
      stack = e.stack;
    }
    data = {user: name, message: e.message, stack: stack};
  } else {
    if (!stack) {
      stack = "[no stack available]"
    }
    data = {user: name, message: e, stack: stack};
  }
  $.get("error", data);

  console.error(JSON.stringify(data));
}


function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}