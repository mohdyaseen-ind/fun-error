#!/usr/bin/env node

const { spawn } = require("node:child_process");

// --------- 🎨 ANSI COLORS ---------
const RST = "\x1b[0m";
const RED = "\x1b[1;31m";
const GRN = "\x1b[1;32m";
const YEL = "\x1b[1;33m";
const CYN = "\x1b[1;36m";
const MAG = "\x1b[1;35m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const BG_RED = "\x1b[41m\x1b[37m";
const BG_YEL = "\x1b[43m\x1b[30m";

// --------- 🕵️ ENHANCED ERROR PARSER ----------

function parseNodeError(stderrText) {
  const lines = stderrText.split("\n");

  const errorRegex =
    /(SyntaxError|TypeError|ReferenceError|RangeError|EvalError|URIError|AggregateError|Error|UnhandledPromiseRejectionWarning|DeprecationWarning|AssertionError):\s*(.*)/;

  let type = "UnknownError";
  let message = "Something broke and it's definitely your fault.";
  let code = null;
  let file = null;
  let line = null;
  let column = null;

  for (const l of lines) {
    const m = l.match(errorRegex);
    if (m) {
      type = m[1];
      message = m[2].trim();
      break;
    }
  }

  if (stderrText.includes("MODULE_NOT_FOUND") || stderrText.includes("Cannot find module")) {
    type = "ModuleNotFoundError";
    code = "MODULE_NOT_FOUND";
    const m = stderrText.match(/Cannot find module '([^']+)'/);
    if (m) message = `Cannot find module '${m[1]}'`;
  }

  const codeMatch =
    stderrText.match(/\bcode: ['"]?([A-Z_]+)['"]?/) ||
    stderrText.match(/\b(E[A-Z0-9_]+)\b/) || 
    message.match(/\b(E[A-Z0-9_]+)\b/);
  if (codeMatch) code = codeMatch[1];

  const stackLines = lines.filter(l => 
    l.trim().startsWith("at ") && 
    !l.includes("node:internal") && 
    !l.includes("node_modules")
  );

  if (stackLines.length > 0) {
    const locMatch = stackLines[0].match(/\(([^)]+):(\d+):(\d+)\)/) || 
                     stackLines[0].match(/at ([^:]+):(\d+):(\d+)/);
    if (locMatch) {
      file = locMatch[1].split("/").pop();
      line = locMatch[2];
      column = locMatch[3];
    }
  }

  if (!file) {
    const fallbackMatch = stderrText.match(/([^\s(]+\.js):(\d+):(\d+)/);
    if (fallbackMatch) {
      file = fallbackMatch[1].split("/").pop();
      line = fallbackMatch[2];
      column = fallbackMatch[3];
    }
  }

  return { type, message, file, line, column, code, fullText: stderrText };
}

// --------- 🎯 EXPANDED PATTERN DETECTOR ----------

function detectPattern(info) {
  const msg = info.message.toLowerCase();
  const full = info.fullText.toLowerCase();

  // === ASYNC/PROMISE ERRORS ===
  if (full.includes("unhandledpromiserejection") || 
      msg.includes("unhandled promise rejection")) {
    return "unhandled_promise";
  }
  if (msg.includes("await is only valid in async")) {
    return "await_outside_async";
  }
  if (msg.includes("async function") && msg.includes("did you mean")) {
    return "forgot_await";
  }
  if (msg.includes("promise") && msg.includes("catch")) {
    return "missing_catch";
  }
  if (msg.includes("promise") && msg.includes("resolved")) {
    return "double_resolve";
  }
  if (msg.includes("then") && msg.includes("not a function")) {
    return "then_not_function";
  }

  // === UNDEFINED/NULL ERRORS ===
  if (msg.includes("cannot read properties of undefined") ||
      msg.includes("cannot read property") && msg.includes("undefined")) {
    return "undefined_property";
  }
  if (msg.includes("cannot read properties of null") ||
      msg.includes("cannot read property") && msg.includes("null")) {
    return "null_property";
  }
  if (msg.includes("undefined is not a function")) {
    return "undefined_function";
  }
  if (msg.includes("is not defined")) return "not_defined";
  if (msg.includes("cannot access") && msg.includes("before initialization")) {
    return "tdz_error";
  }

  // === TYPE ERRORS ===
  if (msg.includes("is not a function")) return "not_a_function";
  if (msg.includes("is not iterable")) return "not_iterable";
  if (msg.includes("is not a constructor")) return "not_constructor";
  if (msg.includes("cannot set property") || msg.includes("cannot set properties")) {
    return "cannot_set_property";
  }
  if (msg.includes("assignment to constant")) return "const_reassignment";
  if (msg.includes("cannot convert") || msg.includes("invalid array length")) {
    return "type_conversion";
  }
  if (msg.includes("reduce of empty array")) return "reduce_empty";
  if (msg.includes("object is not extensible")) return "not_extensible";
  if (msg.includes("cannot delete property")) return "cannot_delete";
  if (msg.includes("circular structure")) return "circular_json";

  // === NETWORK/CONNECTION ERRORS ===
  if (info.code === "EADDRINUSE") return "port_in_use";
  if (info.code === "ENOENT") return "file_missing";
  if (info.code === "ECONNREFUSED") return "conn_refused";
  if (info.code === "ETIMEDOUT") return "timeout";
  if (info.code === "ECONNRESET") return "conn_reset";
  if (info.code === "ENOTFOUND") return "dns_error";
  if (info.code === "EACCES" || info.code === "EPERM") return "permission_denied";
  if (info.code === "EMFILE") return "too_many_files";
  if (info.code === "EEXIST") return "file_exists";
  if (info.code === "EISDIR") return "is_directory";
  if (info.code === "ENOTDIR") return "not_directory";
  if (info.code === "ENOTEMPTY") return "dir_not_empty";
  if (info.code === "EPIPE") return "broken_pipe";
  if (info.code === "ENETUNREACH") return "network_unreachable";
  if (info.code === "EHOSTUNREACH") return "host_unreachable";
  if (info.code === "ERR_SOCKET_BAD_PORT") return "bad_port";

  // === EXPRESS/HTTP ERRORS ===
  if (msg.includes("cannot set headers after they are sent")) return "headers_after_sent";
  if (msg.includes("request aborted")) return "request_aborted";
  if (msg.includes("write after end")) return "write_after_end";
  if (msg.includes("socket hang up")) return "socket_hangup";
  if (msg.includes("bad request")) return "bad_request";
  if (msg.includes("payload too large")) return "payload_too_large";

  // === SYNTAX ERRORS ===
  if (msg.includes("unexpected token")) return "unexpected_token";
  if (msg.includes("missing )") || msg.includes("missing ) after argument list")) return "missing_paren";
  if (msg.includes("missing }")) return "missing_brace";
  if (msg.includes("unexpected end of")) return "unexpected_eof";
  if (msg.includes("invalid or unexpected token")) return "invalid_token";
  if (msg.includes("illegal return statement")) return "illegal_return";
  if (msg.includes("rest parameter") || msg.includes("spread")) return "spread_error";
  if (msg.includes("unexpected reserved word")) return "reserved_word";
  if (msg.includes("duplicate parameter")) return "duplicate_param";
  if (msg.includes("strict mode")) return "strict_mode";
  if (msg.includes("invalid destructuring")) return "bad_destructuring";

  // === JSON ERRORS ===
  if (msg.includes("json at position") || 
      msg.includes("unexpected token") && (full.includes("json.parse") || msg.includes("json"))) {
    return "json_parse";
  }
  if (msg.includes("unexpected end of json")) return "json_incomplete";

  // === MODULE ERRORS ===
  if (msg.includes("cannot find module") || msg.includes("module_not_found")) {
    return "module_not_found";
  }
  if (msg.includes("require") && msg.includes("esm")) return "require_esm";
  if (msg.includes("import") && msg.includes("outside")) return "import_outside_module";
  if (msg.includes("export") && msg.includes("not defined")) return "export_error";
  if (msg.includes("must use import to load")) return "must_use_import";
  if (msg.includes("named export") && msg.includes("not found")) return "named_export_missing";
  if (msg.includes("default export")) return "default_export_error";

  // === RECURSION/MEMORY ERRORS ===
  if (msg.includes("maximum call stack size exceeded")) return "stack_overflow";
  if (msg.includes("out of memory") || msg.includes("heap")) return "memory_error";
  if (msg.includes("fatal error")) return "fatal_error";

  // === REGEX ERRORS ===
  if (msg.includes("invalid regular expression")) return "invalid_regex";
  if (msg.includes("unterminated character class")) return "regex_unterminated";
  if (msg.includes("invalid group")) return "regex_invalid_group";
  if (msg.includes("nothing to repeat")) return "regex_nothing_to_repeat";

  // === CIRCULAR/DEPENDENCY ERRORS ===
  if (msg.includes("circular") || full.includes("circular")) return "circular_dependency";
  if (msg.includes("cyclic")) return "cyclic_reference";

  // === DATABASE/QUERY ERRORS ===
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) return "duplicate_key";
  if (msg.includes("econnrefused") && full.includes("mongo")) return "mongo_connection";
  if (msg.includes("econnrefused") && (full.includes("postgres") || full.includes("pg"))) return "postgres_connection";
  if (msg.includes("relation") && msg.includes("does not exist")) return "table_not_exists";
  if (msg.includes("column") && msg.includes("does not exist")) return "column_not_exists";
  if (msg.includes("syntax error") && full.includes("sql")) return "sql_syntax";

  // === ARRAY/OBJECT ERRORS ===
  if (msg.includes("invalid array length")) return "invalid_array_length";
  if (msg.includes("negative array length")) return "negative_array_length";
  if (msg.includes("cannot create property")) return "frozen_object";
  if (msg.includes("sealed object")) return "sealed_object";

  // === ENCODING/BUFFER ERRORS ===
  if (msg.includes("invalid encoding")) return "invalid_encoding";
  if (msg.includes("buffer") && msg.includes("too large")) return "buffer_too_large";
  if (msg.includes("invalid buffer size")) return "invalid_buffer";

  // === CRYPTO/SECURITY ERRORS ===
  if (msg.includes("digest") && msg.includes("not supported")) return "unsupported_digest";
  if (msg.includes("key derivation failed")) return "key_derivation_failed";
  if (msg.includes("decrypt") && msg.includes("failed")) return "decryption_failed";

  // === WORKER/THREAD ERRORS ===
  if (msg.includes("worker") && msg.includes("terminated")) return "worker_terminated";
  if (msg.includes("worker") && msg.includes("communication")) return "worker_communication";
  if (msg.includes("atomics") && msg.includes("not allowed")) return "atomics_not_allowed";

  // === STREAM ERRORS ===
  if (msg.includes("premature close")) return "stream_premature_close";
  if (msg.includes("stream is not writable")) return "stream_not_writable";
  if (msg.includes("stream is not readable")) return "stream_not_readable";

  // === ASSERTION ERRORS ===
  if (info.type === "AssertionError") return "assertion_failed";

  // === DEPRECATED WARNINGS ===
  if (full.includes("deprecationwarning")) return "deprecation_warning";

  // === GENERIC FALLBACKS ===
  if (info.type === "SyntaxError") return "syntax_generic";
  if (info.type === "TypeError") return "type_generic";
  if (info.type === "ReferenceError") return "ref_generic";
  if (info.type === "RangeError") return "range_generic";
  if (info.type === "URIError") return "uri_error";
  if (info.type === "EvalError") return "eval_error";

  return "generic";
}

// --------- 🔥 MASSIVELY EXPANDED ROAST REGISTRY ----------

function getRoastAndHint(info) {
  const pattern = detectPattern(info);
  
  const roastDB = {
    // ASYNC/PROMISE
    unhandled_promise: {
      emoji: "💀",
      roast: "Unhandled promise rejection detected. Your async code just ghosted you harder than your last Tinder match.",
      hint: "Always .catch() your promises or use try/catch with async/await. Promises aren't self-cleaning.",
      extraBurn: "Pro tip: Unhandled rejections crash your app in production. This is a feature, not a bug."
    },
    await_outside_async: {
      emoji: "⏳",
      roast: "You used 'await' outside an async function. Time doesn't work like that, Einstein.",
      hint: "Wrap your code in: async function() { ... } or make the parent function async.",
      extraBurn: "await requires async context. This is JavaScript, not wish.com magic."
    },
    forgot_await: {
      emoji: "😴",
      roast: "You called an async function but forgot 'await'. It returned a Promise, not the value. Classic amateur move.",
      hint: "Add 'await' before async function calls: const result = await myFunc();",
      extraBurn: "Getting a [Promise object] instead of data? Yeah, that's what forgetting await looks like."
    },
    missing_catch: {
      emoji: "🎣",
      roast: "Promise rejected and you had no safety net. Hope you enjoy uncaught exceptions at 3am.",
      hint: "Add .catch(err => ...) or wrap in try/catch. Promises aren't self-managing adults.",
      extraBurn: "Error handling is optional. Until production. Then it's mandatory with a side of regret."
    },
    double_resolve: {
      emoji: "🔄",
      roast: "You tried to resolve a Promise twice. Promises are commitment-phobes, they only commit once.",
      hint: "Each Promise can only be resolved/rejected once. Check your logic flow.",
      extraBurn: "Once a Promise makes up its mind, that's it. Unlike your last relationship."
    },
    then_not_function: {
      emoji: "⛓️",
      roast: ".then() is not a function because what you're calling it on is NOT a Promise. Detective work needed.",
      hint: "Make sure the function you're calling actually returns a Promise.",
      extraBurn: "Chaining .then() on non-Promises. That's not how promises work. Or chains. Or anything."
    },

    // UNDEFINED/NULL ERRORS
    undefined_property: {
      emoji: "💀",
      roast: "EMOTIONAL DAMAGE! You tried to .property on undefined. It has literally nothing for you.",
      hint: "Check it first: if (obj) or use optional chaining obj?.property",
      extraBurn: "Undefined said 'I literally have nothing' and you STILL tried to take from it. Bold."
    },
    null_property: {
      emoji: "🕳️",
      roast: "Reading properties of NULL. That's not minimalism, that's just broken.",
      hint: "Check for null: if (obj !== null) before accessing properties, or use obj?.property",
      extraBurn: "Null is the programming equivalent of 'read at 3:47pm'. It has NOTHING for you."
    },
    undefined_function: {
      emoji: "🧨",
      roast: "undefined is not a function. You can't call what doesn't exist. This isn't Hogwarts.",
      hint: "Log it first: console.log(typeof yourThing). Check your imports/exports.",
      extraBurn: "Calling undefined like it's a function. Manifesting through sheer delusion is not a paradigm."
    },
    not_defined: {
      emoji: "❓",
      roast: "Variable is not defined. You're referencing variables from parallel universes where your code works.",
      hint: "Declare variables with let/const/var before using them. Check for typos.",
      extraBurn: "Using variables that don't exist. This is coding, not creative writing."
    },
    tdz_error: {
      emoji: "⏰",
      roast: "Temporal Dead Zone violation! You accessed a let/const before initialization. Time is a construct, but this error is real.",
      hint: "Move the variable declaration BEFORE you use it, or use var if you hate yourself.",
      extraBurn: "TDZ errors mean you're living in the future. Unfortunately, your code isn't."
    },

    // TYPE ERRORS
    not_a_function: {
      emoji: "🧨",
      roast: "EMOTIONAL DAMAGE! You called something a function. Narrator: It was not a function.",
      hint: "Log it first: console.log(typeof yourThing). Check your imports/exports.",
      extraBurn: "Treating non-functions like functions. Bold strategy. Terrible execution."
    },
    not_iterable: {
      emoji: "🔁",
      roast: "You tried to loop over something that cannot be looped. This is why we can't have nice things.",
      hint: "Only arrays, strings, Sets, Maps are iterable. Check your data type.",
      extraBurn: "for...of loop took one look at your data and said 'I don't know her' and dipped."
    },
    not_constructor: {
      emoji: "🏗️",
      roast: "You tried to 'new' something that's not a constructor. Not everything can be instantiated, chief.",
      hint: "Not everything can be instantiated. Arrow functions can't be constructors.",
      extraBurn: "This isn't Build-A-Bear workshop. You can't just 'new' everything you see."
    },
    cannot_set_property: {
      emoji: "🚫",
      roast: "Cannot set property on undefined/null. Setting vibes on nothing doesn't work in code either.",
      hint: "Initialize the object first: obj = {} before setting properties.",
      extraBurn: "You're trying to furnish a house that doesn't exist. Build the foundation first."
    },
    const_reassignment: {
      emoji: "🔒",
      roast: "You tried to reassign a const. That's... literally the opposite of const.",
      hint: "Use let or var if you need to reassign. const means constant, genius.",
      extraBurn: "const = constant. It's right there in the name. English is hard, I know."
    },
    type_conversion: {
      emoji: "⚙️",
      roast: "Type conversion failed. You can't force incompatible types to be friends. This isn't couples therapy.",
      hint: "Check your values before converting — parseInt, Number, toString need valid input.",
      extraBurn: "JavaScript coercion has limits. You found them. Congratulations?"
    },
    reduce_empty: {
      emoji: "📉",
      roast: "Called reduce on an empty array without an initial value. That's like asking for directions in an empty room.",
      hint: "Provide an initial value: array.reduce(fn, initialValue) or check array.length first.",
      extraBurn: "Reduce needs something to reduce. Shocking concept, I know."
    },
    not_extensible: {
      emoji: "🧊",
      roast: "Object is not extensible. Someone sealed it. It's in witness protection from your bad decisions.",
      hint: "Can't add properties to sealed/frozen objects. Use Object.isExtensible() to check.",
      extraBurn: "This object said 'no new friends' and meant it."
    },
    cannot_delete: {
      emoji: "🗑️",
      roast: "Cannot delete property. That property has tenure and you can't fire it.",
      hint: "Some properties are non-configurable. Check with Object.getOwnPropertyDescriptor().",
      extraBurn: "Not everything can be deleted. Like this error message from your memory."
    },
    circular_json: {
      emoji: "♾️",
      roast: "Cannot stringify circular structure. Your object references itself like a philosophical paradox.",
      hint: "Use JSON.stringify with a replacer function, or restructure your data to avoid self-reference.",
      extraBurn: "Your data structure is having an existential crisis."
    },

    // NETWORK/CONNECTION ERRORS
    port_in_use: {
      emoji: "🔌",
      roast: "Port's taken. Just like your dreams of being a 10x developer.",
      hint: "Kill the process: lsof -ti:PORT | xargs kill -9, or just pick a different port.",
      extraBurn: "Imagine thinking port 3000 is ONLY yours. Main character syndrome much?"
    },
    file_missing: {
      emoji: "👻",
      roast: "EMOTIONAL DAMAGE! That file doesn't exist. You're coding fan fiction.",
      hint: "Check the file path. Relative paths depend on your current working directory (cwd).",
      extraBurn: "Pro tip: Files need to exist BEFORE you reference them. Revolutionary concept, I know."
    },
    conn_refused: {
      emoji: "📵",
      roast: "Connection refused. The server looked at your request and chose violence.",
      hint: "Make sure the server is actually running and check your host/port are correct.",
      extraBurn: "Even localhost doesn't want to talk to you right now."
    },
    timeout: {
      emoji: "⏳",
      roast: "Request timed out. Even the packets gave up waiting for your code to make sense.",
      hint: "Increase timeout, check network connection, or fix whatever's taking forever.",
      extraBurn: "Your code is so slow, Internet Explorer is embarrassed for you."
    },
    conn_reset: {
      emoji: "🔌",
      roast: "Connection reset. Server rage-quit mid-conversation like a toxic Discord mod.",
      hint: "Could be server crash, firewall, or network instability. Check server logs.",
      extraBurn: "The server said 'I'm done' and hung up on your request. That's cold."
    },
    dns_error: {
      emoji: "🌐",
      roast: "DNS lookup failed. That domain doesn't exist (or your internet is as dead as your code quality).",
      hint: "Check spelling, make sure you're online, and verify the URL is legit.",
      extraBurn: "Can't find the domain. Did you just make up a URL and hope for the best?"
    },
    permission_denied: {
      emoji: "🔒",
      roast: "PERMISSION DENIED. Even your computer knows you're not ready for this.",
      hint: "Check file permissions (chmod), or run with proper privileges. Avoid sudo unless necessary.",
      extraBurn: "The OS said 'no' harder than your last code review."
    },
    too_many_files: {
      emoji: "📂",
      roast: "Too many open files. You're hoarding file descriptors like a digital dragon on a treasure pile.",
      hint: "Close files/connections when done. Increase ulimit if legitimately needed.",
      extraBurn: "Your app opened files and forgot they existed. Marie Kondo would be horrified."
    },
    file_exists: {
      emoji: "📁",
      roast: "File already exists. You can't create what's already real. Philosophy 101 failed you.",
      hint: "Delete it first, rename it, or use a different filename.",
      extraBurn: "Trying to create duplicate files. Next you'll try to divide by zero for fun."
    },
    is_directory: {
      emoji: "📁",
      roast: "EISDIR: That's a directory, not a file. Learn the difference, it might save you.",
      hint: "You're trying to read/write a directory as if it's a file. Check your paths.",
      extraBurn: "Confusing files and folders. Your file system is judging you right now."
    },
    not_directory: {
      emoji: "📄",
      roast: "ENOTDIR: That's a file, not a directory. The opposite problem from last time. Consistency!",
      hint: "You're treating a file like a folder. Double-check your path logic.",
      extraBurn: "Can't mkdir a file. Can't cd into a file. These are the rules."
    },
    dir_not_empty: {
      emoji: "📦",
      roast: "Directory not empty. Can't delete what's full. Life lesson AND code lesson.",
      hint: "Use fs.rm with {recursive: true} or delete contents first.",
      extraBurn: "Trying to delete non-empty folders. The file system has abandonment issues."
    },
    broken_pipe: {
      emoji: "🚰",
      roast: "EPIPE: Broken pipe. You wrote to a stream that's already closed. It ghosted you.",
      hint: "Check if streams are still open before writing. Handle 'close' events.",
      extraBurn: "Writing to closed streams. That's sending texts after being blocked."
    },
    network_unreachable: {
      emoji: "🌐",
      roast: "Network unreachable. Are you on a plane? In a tunnel? Underwater? Or just offline?",
      hint: "Check your internet connection. Verify you're not behind a restrictive firewall.",
      extraBurn: "No network, no service, no sympathy from me."
    },
    host_unreachable: {
      emoji: "🏝️",
      roast: "Host unreachable. The server is on a deserted island with no WiFi.",
      hint: "The host exists but routing failed. Check firewall rules and network config.",
      extraBurn: "You can't reach the server. It can't reach you. Match NOT made in heaven."
    },
    bad_port: {
      emoji: "🚪",
      roast: "Bad port number. Ports are 1-65535. You chose... poorly.",
      hint: "Use a valid port number between 1 and 65535. Preferably > 1024 for non-root.",
      extraBurn: "Invalid port number. Were you just keyboard-smashing?"
    },

    // EXPRESS/HTTP ERRORS
    headers_after_sent: {
      emoji: "📬",
      roast: "You tried to set headers after sending the response. That ship has sailed, captain.",
      hint: "Only call res.send/json/end ONCE. Return after sending to stop execution.",
      extraBurn: "Setting headers after response is like texting 'wait I have more to say' after being blocked."
    },
    request_aborted: {
      emoji: "🚫",
      roast: "Request aborted. Client said 'nah' and yeeted the connection into the void.",
      hint: "Handle client disconnects gracefully. Check req.on('close', ...) events.",
      extraBurn: "Client ghosted your server faster than you ghost the gym."
    },
    write_after_end: {
      emoji: "📝",
      roast: "You tried to write after ending the response. The door is closed. Move on.",
      hint: "Don't call res.write() after res.end(). Pick one and commit.",
      extraBurn: "res.end() means THE END. Not 'jk one more thing'. Learn boundaries."
    },
    socket_hangup: {
      emoji: "📞",
      roast: "Socket hang up. The connection ended abruptly like your attention span during documentation.",
      hint: "Client/server closed the connection prematurely. Add error handlers.",
      extraBurn: "Connection dropped faster than your GPA in sophomore year."
    },
    bad_request: {
      emoji: "❌",
      roast: "400 Bad Request. Your request was so malformed, the server couldn't even.",
      hint: "Check your request body, headers, and URL parameters. Something's wrong.",
      extraBurn: "The server looked at your request and immediately filed a restraining order."
    },
    payload_too_large: {
      emoji: "📦",
      roast: "Payload too large. Your request is chonky. Too chonky. The server said no.",
      hint: "Reduce request size or increase server's bodyParser limit.",
      extraBurn: "Request so thicc the server needed a forklift. And still said no."
    },

    // SYNTAX ERRORS
    unexpected_token: {
      emoji: "✂️",
      roast: "Unexpected token. JS took one look at your syntax and filed a restraining order.",
      hint: "Look for missing commas, brackets, or quotes near that line.",
      extraBurn: "One stray character ruined your entire file. That's the butterfly effect of incompetence."
    },
    missing_paren: {
      emoji: "🧠",
      roast: "Missing closing parenthesis. You opened it and ghosted it. Commitment issues in code form.",
      hint: "Every ( needs a ). Count them manually if your editor won't help.",
      extraBurn: "Even your brackets are experiencing abandonment issues."
    },
    missing_brace: {
      emoji: "🧱",
      roast: "Missing closing brace. Commitment issues detected. Therapy might help.",
      hint: "Every { needs a }. Use an IDE with bracket matching.",
      extraBurn: "Your code has the structural integrity of a house of cards in a hurricane."
    },
    unexpected_eof: {
      emoji: "📄",
      roast: "File ended mid-thought. Did your cat walk across the keyboard and hit save?",
      hint: "You probably have unclosed brackets or parentheses somewhere above.",
      extraBurn: "This code has the narrative structure of a sneeze."
    },
    invalid_token: {
      emoji: "🚨",
      roast: "Invalid or unexpected token. That character doesn't belong there, like pineapple on pizza.",
      hint: "Could be a weird Unicode character or syntax you copy-pasted wrong.",
      extraBurn: "Copy-pasting from StackOverflow without reading. A tale as old as time."
    },
    illegal_return: {
      emoji: "🚪",
      roast: "Illegal return statement. You can't return from global scope. This isn't a buffet.",
      hint: "return only works inside functions. Move it into a function.",
      extraBurn: "Returning from nowhere. Your code has an existential crisis."
    },
    spread_error: {
      emoji: "📤",
      roast: "Spread/rest operator misuse. You're spreading chaos, not arrays.",
      hint: "Syntax is ...array for spread, or ...args in function params for rest.",
      extraBurn: "Three dots shouldn't cause this much confusion. It's not Morse code."
    },
    reserved_word: {
      emoji: "⛔",
      roast: "Unexpected reserved word. You can't use 'if', 'const', 'class' etc. as variable names. They're RESERVED.",
      hint: "Avoid using JavaScript keywords as identifiers. Pick literally any other name.",
      extraBurn: "Using reserved words as variables. Next you'll name your kid 'function'."
    },
    duplicate_param: {
      emoji: "👥",
      roast: "Duplicate parameter name. You named two params the same thing. Identity crisis much?",
      hint: "Each parameter needs a unique name. This isn't Pokemon, you can't catch duplicates.",
      extraBurn: "Two params, one name. One survives, one dies. Hunger Games: Parameter Edition."
    },
    strict_mode: {
      emoji: "👮",
      roast: "Strict mode violation. JavaScript's hall monitor caught you breaking the rules.",
      hint: "Remove 'use strict' or fix the violation. Strict mode doesn't tolerate your shenanigans.",
      extraBurn: "Strict mode is JavaScript saying 'not on my watch'. And it meant it."
    },
    bad_destructuring: {
      emoji: "💥",
      roast: "Invalid destructuring. You tried to destructure something that can't be destructured. Chaos.",
      hint: "Check you're destructuring objects/arrays properly: {a,b} for objects, [a,b] for arrays.",
      extraBurn: "Destructuring gone wrong. You deconstructed your code's will to live."
    },

    // JSON ERRORS
    json_parse: {
      emoji: "📉",
      roast: "JSON.parse exploded. That string is not JSON, it's unstructured chaos cosplaying as data.",
      hint: "Log the string before parsing. Fix quotes, commas, trailing commas, etc.",
      extraBurn: "That ain't JSON. That's a cry for help in curly braces."
    },
    json_incomplete: {
      emoji: "📃",
      roast: "Unexpected end of JSON input. Your JSON is incomplete, like your understanding of it.",
      hint: "The JSON is truncated or missing closing braces. Check the entire string.",
      extraBurn: "JSON so broken even JSON.parse gave up mid-parse."
    },

    // MODULE ERRORS
    module_not_found: {
      emoji: "📦",
      roast: "MODULE NOT FOUND. You copy-pasted imports without installing anything, didn't you?",
      hint: "Run: npm install <package-name>, and verify your package.json.",
      extraBurn: "Importing libraries you never installed is called 'wishful thinking', not programming."
    },
    require_esm: {
      emoji: "📦",
      roast: "You tried to require() an ES module. Welcome to 2024, we use import now.",
      hint: "Use import instead, or add 'type': 'module' to package.json.",
      extraBurn: "require() is so 2015. Let it go. Move on. Embrace import."
    },
    import_outside_module: {
      emoji: "📦",
      roast: "import used outside a module. Node doesn't recognize this as ESM. Configuration is key, bud.",
      hint: "Add 'type': 'module' to package.json or use .mjs extension.",
      extraBurn: "Using import without module config. That's like driving without a license."
    },
    export_error: {
      emoji: "📦",
      roast: "Export not defined. You exported something that doesn't exist. Selling air, basically.",
      hint: "Check spelling and make sure the variable/function is actually declared.",
      extraBurn: "Can't export what you never created. That's fraud, not code."
    },
    must_use_import: {
      emoji: "📦",
      roast: "Must use import to load ES Module. require() won't cut it anymore, boomer.",
      hint: "Switch to import syntax or convert the package to CommonJS.",
      extraBurn: "ESM only accepts import. Get with the times."
    },
    named_export_missing: {
      emoji: "🏷️",
      roast: "Named export not found. You're importing something that was never exported. Invisible imports.",
      hint: "Check the module's exports. Use 'export { thing }' or 'export const thing'.",
      extraBurn: "Importing things that don't exist. Manifesting doesn't work in code either."
    },
    default_export_error: {
      emoji: "🎯",
      roast: "Default export issue. Either it doesn't exist or you're importing it wrong.",
      hint: "Use 'import thing from' for default exports, 'import { thing }' for named.",
      extraBurn: "Default exports are straightforward. Yet here we are."
    },

    // RECURSION/MEMORY ERRORS
    stack_overflow: {
      emoji: "🌀",
      roast: "STACK OVERFLOW! Infinite recursion speedrun any%. You played yourself.",
      hint: "Add a base case to your recursion, or stop calling functions in circles.",
      extraBurn: "Your function called itself so many times it developed an existential crisis."
    },
    memory_error: {
      emoji: "💾",
      roast: "Out of memory. Your code is eating RAM like it's free real estate at a Black Friday sale.",
      hint: "You're probably creating huge arrays, memory leaks, or infinite loops.",
      extraBurn: "Chrome would be proud. You've achieved peak memory consumption."
    },
    fatal_error: {
      emoji: "☠️",
      roast: "FATAL ERROR. Node said 'I'm out' and took your process with it. This is BAD.",
      hint: "Usually memory-related. Check for memory leaks, huge allocations, or corrupted native code.",
      extraBurn: "Fatal errors mean Node gave up on you. That's rock bottom."
    },

    // REGEX ERRORS
    invalid_regex: {
      emoji: "🔤",
      roast: "Invalid regular expression. Your regex is having an identity crisis.",
      hint: "Escape special characters properly: \\. \\* \\+ and test your pattern.",
      extraBurn: "Regex is hard. But this isn't regex. This is alphabet soup."
    },
    regex_unterminated: {
      emoji: "🔤",
      roast: "Unterminated regex. You started a pattern and abandoned it like New Year's resolutions.",
      hint: "Close your regex properly: /pattern/flags or use new RegExp().",
      extraBurn: "Even your regex has commitment issues."
    },
    regex_invalid_group: {
      emoji: "🔤",
      roast: "Invalid regex group. Your capturing groups are more confused than you are.",
      hint: "Check your parentheses and group syntax. Use (?:...) for non-capturing.",
      extraBurn: "Regex groups require balance. Clearly not your strong suit."
    },
    regex_nothing_to_repeat: {
      emoji: "🔤",
      roast: "Nothing to repeat in regex. You put a quantifier (+, *, ?) before anything to quantify.",
      hint: "Quantifiers need something to quantify. Put them AFTER the pattern.",
      extraBurn: "Repeating nothing repeatedly. That's just... nothing."
    },

    // CIRCULAR/DEPENDENCY ERRORS
    circular_dependency: {
      emoji: "♻️",
      roast: "Circular dependency detected. File A imports B imports A. Ouroboros code eating itself.",
      hint: "Restructure your imports. Extract shared code to a third file.",
      extraBurn: "Your code structure is a paradox. M.C. Escher would be confused."
    },
    cyclic_reference: {
      emoji: "♻️",
      roast: "Cyclic object reference. You created an infinite loop of self-referential sadness.",
      hint: "Don't make objects reference themselves. Use WeakMap if you need cycles.",
      extraBurn: "Your object is stuck in an existential loop. Very postmodern. Still broken."
    },

    // DATABASE ERRORS
    duplicate_key: {
      emoji: "🔑",
      roast: "Duplicate key error. That record already exists, and it's judging you.",
      hint: "Check for existing records before inserting, or update instead of insert.",
      extraBurn: "Trying to insert duplicates. Next you'll try to invent gravity twice."
    },
    mongo_connection: {
      emoji: "🍃",
      roast: "MongoDB connection refused. Is MongoDB even running, or is this wishful thinking?",
      hint: "Start MongoDB: mongod or brew services start mongodb-community",
      extraBurn: "Can't connect to a database that isn't running. Revolutionary debugging technique."
    },
    postgres_connection: {
      emoji: "🐘",
      roast: "PostgreSQL connection refused. Database left you on read. It's not you, it's definitely you.",
      hint: "Start Postgres: brew services start postgresql or check connection string.",
      extraBurn: "Even the elephant wants nothing to do with your queries."
    },
    table_not_exists: {
      emoji: "📊",
      roast: "Table/relation does not exist. You're querying tables from your imagination.",
      hint: "Check table name spelling, run migrations, or create the table first.",
      extraBurn: "Querying non-existent tables. Fan fiction, database edition."
    },
    column_not_exists: {
      emoji: "📋",
      roast: "Column does not exist. That field is as real as your productivity today.",
      hint: "Check column names in your schema. Case-sensitive in some databases.",
      extraBurn: "Selecting columns that don't exist. Bold strategy, terrible execution."
    },
    sql_syntax: {
      emoji: "📝",
      roast: "SQL syntax error. Your query is grammatically incorrect in the language of databases.",
      hint: "Check your SQL syntax. Missing commas, wrong keywords, or typos.",
      extraBurn: "SQL syntax errors. Even the database is correcting your grammar."
    },

    // ARRAY/OBJECT ERRORS
    invalid_array_length: {
      emoji: "📏",
      roast: "Invalid array length. Arrays have limits. You found them. Congrats?",
      hint: "Array length must be a positive integer. Check your math.",
      extraBurn: "Creating arrays of invalid size. Math is hard, arrays are harder."
    },
    negative_array_length: {
      emoji: "➖",
      roast: "Negative array length? Arrays can't have negative length. This isn't quantum physics.",
      hint: "Array lengths must be >= 0. Check your calculations.",
      extraBurn: "Negative arrays exist only in your imagination and nowhere else."
    },
    frozen_object: {
      emoji: "🧊",
      roast: "Object is frozen. Someone called Object.freeze() and it's permanent. Let it go.",
      hint: "Frozen objects can't be modified. Clone it first if you need changes.",
      extraBurn: "Trying to modify frozen objects. Elsa would be proud. Your code isn't."
    },
    sealed_object: {
      emoji: "🔒",
      roast: "Object is sealed. No new properties allowed. It's on a permanent diet.",
      hint: "Sealed objects can modify existing props but not add new ones.",
      extraBurn: "Sealed objects said 'no new properties' and will die on that hill."
    },

    // ENCODING/BUFFER ERRORS
    invalid_encoding: {
      emoji: "🔤",
      roast: "Invalid encoding. That encoding doesn't exist. Did you just make it up?",
      hint: "Use valid encodings: utf8, ascii, base64, hex, binary, etc.",
      extraBurn: "Making up encodings. Creative, but wrong."
    },
    buffer_too_large: {
      emoji: "💾",
      roast: "Buffer too large. You're trying to create a buffer bigger than Node's limit. Ambition: 10/10, Execution: 0/10.",
      hint: "Node has buffer size limits. Stream large data instead of buffering.",
      extraBurn: "Buffer so big even your RAM filed a complaint."
    },
    invalid_buffer: {
      emoji: "💾",
      roast: "Invalid buffer size. Buffers have size limits and rules. You broke both.",
      hint: "Check your buffer allocation size and ensure it's a valid positive integer.",
      extraBurn: "Invalid buffer. Your memory management skills need management."
    },

    // CRYPTO/SECURITY ERRORS
    unsupported_digest: {
      emoji: "🔐",
      roast: "Digest algorithm not supported. That hash doesn't exist in this dimension.",
      hint: "Use supported algorithms: sha256, sha512, md5, etc. Check crypto.getHashes().",
      extraBurn: "Using non-existent hash algorithms. Very secure. Very broken."
    },
    key_derivation_failed: {
      emoji: "🔑",
      roast: "Key derivation failed. Your encryption keys are having an identity crisis.",
      hint: "Check your key derivation parameters, salt, and iterations.",
      extraBurn: "Can't derive keys. Your crypto is having a mid-life crisis."
    },
    decryption_failed: {
      emoji: "🔓",
      roast: "Decryption failed. Wrong key, wrong algorithm, or wrong life choices.",
      hint: "Verify encryption/decryption key match and algorithm is correct.",
      extraBurn: "Decryption failed. Not even the data wants to talk to you."
    },

    // WORKER/THREAD ERRORS
    worker_terminated: {
      emoji: "👷",
      roast: "Worker terminated unexpectedly. Your worker thread rage-quit like a toxic teammate.",
      hint: "Check worker code for errors. Workers can crash independently.",
      extraBurn: "Worker threads quitting on you. Even parallel processes can't stand your code."
    },
    worker_communication: {
      emoji: "📡",
      roast: "Worker communication error. Parent and worker can't talk. Family therapy needed.",
      hint: "Check postMessage syntax and message handlers on both sides.",
      extraBurn: "Parent-worker communication breakdown. It's like Thanksgiving dinner but worse."
    },
    atomics_not_allowed: {
      emoji: "⚛️",
      roast: "Atomics not allowed. Shared memory operations blocked. Sharing isn't always caring.",
      hint: "Atomics require SharedArrayBuffer and proper environment setup.",
      extraBurn: "Atomic operations blocked. Your threading is having boundary issues."
    },

    // STREAM ERRORS
    stream_premature_close: {
      emoji: "🌊",
      roast: "Stream closed prematurely. It ended before finishing. Story of your last project.",
      hint: "Handle 'close' and 'error' events. Don't assume streams finish successfully.",
      extraBurn: "Premature stream closure. Performance issues aren't just for humans."
    },
    stream_not_writable: {
      emoji: "📝",
      roast: "Stream is not writable. You can't write to a read-only stream. Basic streams, bro.",
      hint: "Check if stream is writable before writing. Use writable.writable property.",
      extraBurn: "Writing to non-writable streams. Reading comprehension: 0/10."
    },
    stream_not_readable: {
      emoji: "📖",
      roast: "Stream is not readable. Can't read from write-only streams. Directions unclear?",
      hint: "Verify stream type before reading. Check readable.readable property.",
      extraBurn: "Reading from non-readable streams. Instructions unclear, stream stuck in limbo."
    },

    // ASSERTION/TEST ERRORS
    assertion_failed: {
      emoji: "✅",
      roast: "Assertion failed. Your test expected one thing, got another. Reality check failed.",
      hint: "Check expected vs actual values. Your code doesn't match your assumptions.",
      extraBurn: "Failed assertion. When code meets expectations, someone's gotta lose."
    },

    // DEPRECATION
    deprecation_warning: {
      emoji: "⚠️",
      roast: "Deprecation warning. You're using deprecated APIs like a time traveler from 2015.",
      hint: "Update to the newer API. Deprecated means 'will break soon'.",
      extraBurn: "Using deprecated features. Your code has the shelf life of milk in July."
    },

    // GENERIC FALLBACKS
    syntax_generic: {
      emoji: "📚",
      roast: "Syntax error so bad, Brendan Eich felt a disturbance in the Force.",
      hint: "Read the line number carefully. JavaScript is case-sensitive and picky.",
      extraBurn: "Your code failed English AND Computer Science at the same time."
    },
    type_generic: {
      emoji: "🛑",
      roast: "TypeError: You're forcing things together like a bad rom-com. They're incompatible.",
      hint: "Console.log the variables and check their types before operations.",
      extraBurn: "JavaScript isn't a dating app. You can't force bad matches to work."
    },
    ref_generic: {
      emoji: "🤷",
      roast: "ReferenceError: You're calling variables from an alternate dimension where your code works.",
      hint: "Make sure the variable/function exists in the current scope before using it.",
      extraBurn: "Spoiler alert: That dimension doesn't exist."
    },
    range_generic: {
      emoji: "♾️",
      roast: "Value out of range. You went full send and flew past the boundaries of sanity.",
      hint: "Check array indices, string lengths, or numeric bounds.",
      extraBurn: "JavaScript has limits. You found them. Congrats, I guess?"
    },
    uri_error: {
      emoji: "🌐",
      roast: "URIError: Your URL encoding/decoding failed. URLs have rules. You broke them.",
      hint: "Check encodeURI/decodeURI usage. Some characters need special handling.",
      extraBurn: "URL encoding failed. Even the internet doesn't want your links."
    },
    eval_error: {
      emoji: "⚠️",
      roast: "EvalError. You used eval(). eval is evil. This is your punishment.",
      hint: "Stop using eval(). Just... stop. There's always a better way.",
      extraBurn: "eval() errors are karma for using eval() in the first place."
    },
    generic: {
      emoji: "💥",
      roast: "Your code is a war crime against computer science. Even StackOverflow gave up on you.",
      hint: "Debug it yourself. Use console.log like a caveman discovering fire.",
      extraBurn: "This error is so unique, it deserves its own Wikipedia page."
    }
  };

  const data = roastDB[pattern] || roastDB["generic"];
  return data;
}

// --------- 📊 CONTEXT EXTRACTION ----------

function extractErrorContext(stderrText, info) {
  const lines = stderrText.split("\n");
  const codeSnippet = lines.find(l => l.trim() && !l.includes("at ") && !l.includes("Error:"));
  
  return codeSnippet ? codeSnippet.trim().substring(0, 80) : null;
}

// ------------------- CLI LOGIC -------------------

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
${BG_YEL} FunErr ${RST} ${BOLD}Error Messages That Actually Help (And Roast You)${RST}

${BOLD}USAGE:${RST}
  ${CYN}funerr <file.js> [args...]${RST}
  ${CYN}funerr node <file.js> [args...]${RST}

${BOLD}EXAMPLES:${RST}
  ${DIM}funerr app.js${RST}
  ${DIM}funerr server.js --port 3000${RST}
  ${DIM}funerr node test.js${RST}

${BOLD}NEW: Now covers 80+ error types!${RST}
  `);
  process.exit(1);
}

let cmd = "node";
let cmdArgs = args;

if (args[0] === "node") {
  cmdArgs = args.slice(1);
}

const child = spawn(cmd, cmdArgs, {
  stdio: ["inherit", "pipe", "pipe"],
});

let stderrChunks = [];
let stdoutHadContent = false;

child.stdout.on("data", (chunk) => {
  stdoutHadContent = true;
  process.stdout.write(chunk);
});

child.stderr.on("data", (chunk) => {
  stderrChunks.push(chunk.toString());
});

child.on("close", (exitCode) => {
  if (exitCode === 0) {
    process.exit(0);
    return;
  }

  const rawError = stderrChunks.join("");
  
  if (!rawError.trim()) {
    console.error(`${RED}Process exited with code ${exitCode} but no error details.${RST}`);
    process.exit(exitCode);
    return;
  }

  const info = parseNodeError(rawError);
  const { roast, hint, emoji, extraBurn } = getRoastAndHint(info);
  const context = extractErrorContext(rawError, info);

  if (stdoutHadContent) {
    console.log("");
  }

  // Header with maximum emotional damage
  console.log(`\n${BG_RED} ${BOLD} 🔥 EMOTIONAL DAMAGE 🔥 ${RST}`);
  console.log(`${RED}${BOLD}╔════════════════════════════════════════════════════════════════╗${RST}`);
  console.log(`${RED}${BOLD}║${RST}  ${info.type.toUpperCase().padEnd(59)} ${RED}${BOLD}║${RST}`);
  console.log(`${RED}${BOLD}╚════════════════════════════════════════════════════════════════╝${RST}`);
  
  // Location
  if (info.file) {
    const loc = info.column 
      ? `${info.file}:${info.line}:${info.column}` 
      : `${info.file}:${info.line}`;
    console.log(`\n${MAG}📍 Crime Scene:${RST} ${BOLD}${loc}${RST}`);
  }
  
  // Error message
  console.log(`${MAG}📝 What Broke:${RST}   ${YEL}"${info.message}"${RST}`);
  
  // Code snippet if available
  if (context && context.length > 0) {
    console.log(`${DIM}${MAG}📄 The Evidence:${RST}${DIM} ${context}...${RST}`);
  }

  // Code if system error
  if (info.code) {
    console.log(`${MAG}⚙️  Error Code:${RST}  ${BOLD}${info.code}${RST} ${DIM}(Google this if you're brave)${RST}`);
  }

  // Divider
  console.log(`\n${RED}${'─'.repeat(65)}${RST}`);
  
  // Main Roast (CAPS for extra damage)
  console.log(`${emoji}  ${RED}${BOLD}THE ROAST:${RST}`);
  console.log(`   ${RED}${roast}${RST}`);
  
  // Extra burn if available
  if (extraBurn) {
    console.log(`   ${DIM}${extraBurn}${RST}`);
  }
  
  // Divider
  console.log(`\n${CYN}${'─'.repeat(65)}${RST}`);
  
  // Hint (actually helpful)
  console.log(`${CYN}${BOLD}💡 HOW TO FIX (if you're capable):${RST}`);
  console.log(`   ${hint}`);
  
  // Savage footer
  console.log(`\n${DIM}┌────────────────────────────────────────────────────────────┐${RST}`);
  console.log(`${DIM}│${RST} This error was 100% preventable. You know that, right?   ${DIM}│${RST}`);
  console.log(`${DIM}│${RST} Want the boring Node error? Remove 'funerr' like a coward ${DIM}│${RST}`);
  console.log(`${DIM}└────────────────────────────────────────────────────────────┘${RST}\n`);

  process.exit(exitCode);
});