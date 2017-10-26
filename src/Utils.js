import $ from "jquery";

class Log {
  constructor() {
    this.level = (window.wevr && (window.wevr.logLevel != undefined))?window.wevr.logLevel:3;
  }

  debug(message, server = false, echo = true) {
    if (this.level > 2) {
      this.output(message, server, echo);
    }
  }

  trace(message, server = false, echo = true) {
    if (this.level > 3) {
      this.output(message, server, echo);
    }
  }

  output(message, server, echo) {
    if (server) {
      let name = window.wevr && window.wevr.id + "-" + (readCookie('name') || '[none]');
      $.get("log", {user: name, message: message});
    }

    if (echo) {
      console.log(message);
    }
  }
}

export default new Log();

function errorLog(e, line) {
  let name = window.wevr.id + "-" + (readCookie('name') || '[none]');

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
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}