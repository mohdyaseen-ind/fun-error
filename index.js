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
    /(SyntaxError|TypeError|ReferenceError|RangeError|EvalError|URIError|AggregateError|Error|UnhandledPromiseRejectionWarning|DeprecationWarning):\s*(.*)/;

  let type = "UnknownError";
  let message = "Something broke and it's definitely your fault.";
  let code = null;
  let file = null;
  let line = null;
  let column = null;

  // 1. Scan for Error Type & Message
  for (const l of lines) {
    const m = l.match(errorRegex);
    if (m) {
      type = m[1];
      message = m[2].trim();
      break;
    }
  }

  // 2. Check for "Module not found"
  if (stderrText.includes("MODULE_NOT_FOUND") || stderrText.includes("Cannot find module")) {
    type = "ModuleNotFoundError";
    code = "MODULE_NOT_FOUND";
    const m = stderrText.match(/Cannot find module '([^']+)'/);
    if (m) message = `Cannot find module '${m[1]}'`;
  }

  // 3. Scan for System Codes
  const codeMatch =
    stderrText.match(/\bcode: ['"]?([A-Z_]+)['"]?/) ||
    stderrText.match(/\b(E[A-Z0-9_]+)\b/) || 
    message.match(/\b(E[A-Z0-9_]+)\b/);
  if (codeMatch) code = codeMatch[1];

  // 4. Enhanced Location Detection
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

  // Fallback location search
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

// --------- 🎯 PATTERN DETECTOR ----------

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

  // === EXPRESS/HTTP ERRORS ===
  if (msg.includes("cannot set headers after they are sent")) return "headers_after_sent";
  if (msg.includes("request aborted")) return "request_aborted";
  if (msg.includes("write after end")) return "write_after_end";

  // === SYNTAX ERRORS ===
  if (msg.includes("unexpected token")) return "unexpected_token";
  if (msg.includes("missing )") || msg.includes("missing ) after argument list")) return "missing_paren";
  if (msg.includes("missing }")) return "missing_brace";
  if (msg.includes("unexpected end of")) return "unexpected_eof";
  if (msg.includes("invalid or unexpected token")) return "invalid_token";
  if (msg.includes("illegal return statement")) return "illegal_return";
  if (msg.includes("rest parameter") || msg.includes("spread")) return "spread_error";

  // === JSON ERRORS ===
  if (msg.includes("json at position") || 
      msg.includes("unexpected token") && (full.includes("json.parse") || msg.includes("json"))) {
    return "json_parse";
  }

  // === MODULE ERRORS ===
  if (msg.includes("cannot find module") || msg.includes("module_not_found")) {
    return "module_not_found";
  }
  if (msg.includes("require") && msg.includes("esm")) return "require_esm";
  if (msg.includes("import") && msg.includes("outside")) return "import_outside_module";
  if (msg.includes("export") && msg.includes("not defined")) return "export_error";

  // === RECURSION/MEMORY ERRORS ===
  if (msg.includes("maximum call stack size exceeded")) return "stack_overflow";
  if (msg.includes("out of memory") || msg.includes("heap")) return "memory_error";

  // === REGEX ERRORS ===
  if (msg.includes("invalid regular expression")) return "invalid_regex";
  if (msg.includes("unterminated character class")) return "regex_unterminated";

  // === CIRCULAR/DEPENDENCY ERRORS ===
  if (msg.includes("circular") || full.includes("circular")) return "circular_dependency";
  if (msg.includes("cyclic")) return "cyclic_reference";

  // === DATABASE/QUERY ERRORS ===
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) return "duplicate_key";
  if (msg.includes("econnrefused") && full.includes("mongo")) return "mongo_connection";
  if (msg.includes("econnrefused") && (full.includes("postgres") || full.includes("pg"))) return "postgres_connection";

  // === GENERIC FALLBACKS ===
  if (info.type === "SyntaxError") return "syntax_generic";
  if (info.type === "TypeError") return "type_generic";
  if (info.type === "ReferenceError") return "ref_generic";
  if (info.type === "RangeError") return "range_generic";

  return "generic";
}

// --------- 🔥 EXPANDED ROAST REGISTRY ----------

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

    // UNDEFINED/NULL
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

    // NETWORK/CONNECTION
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

    // EXPRESS/HTTP
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

    // SYNTAX
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

    // JSON
    json_parse: {
      emoji: "📉",
      roast: "JSON.parse exploded. That string is not JSON, it's unstructured chaos cosplaying as data.",
      hint: "Log the string before parsing. Fix quotes, commas, trailing commas, etc.",
      extraBurn: "That ain't JSON. That's a cry for help in curly braces."
    },

    // MODULES
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

    // RECURSION/MEMORY
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

    // REGEX
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

    // CIRCULAR/DEPENDENCY
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

    // DATABASE
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