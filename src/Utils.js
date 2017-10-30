class Log {
  constructor() {
    this.level = (window.wevr && (window.wevr.logLevel != undefined))?window.wevr.logLevel:3;
  }

  info(message, server = false, echo = true) {
    console.info(message);
  }

  debug(message, server = false, echo = true) {
    console.debug(message);
  }

  trace(message, server = false, echo = true) {
    console.debug(message);
  }

  error(e, line) {
   try{
      console.error(e);
    } catch (error) {
    }
  }
}

export default new Log();

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