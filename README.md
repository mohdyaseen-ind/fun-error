# 🔥 Fun-Error
### Error Messages That Hurt Your Feelings But Fix Your Code.

---

## 📖 The Story: Why I Built This

I was tired. 

Tired of staring at `undefined is not a function`. Tired of asking my teachers what a stack trace meant, only to get a sigh and a "read the console" in response. Tired of development feeling like a sterile, painful chore.

Coding should be fun. It should be creative. And when you mess up (which you will), it shouldn't just crash silently—it should roast you, teach you, and make you laugh through the pain.

**FunErr** turns your terminal into a savage coding partner. It doesn't just show errors; it detects **40+ specific failure patterns**, insults your coding skills, and then actually tells you how to fix it.

---

## 🚀 Installation

You can install it globally to use it anywhere:

```bash
npm install -g fun-error
````

Or run it directly with `npx`:

```bash
npx funerr index.js
```

-----

## 🎮 Usage

Stop running `node index.js`. Start running:

```bash
funerr index.js
```

Works with arguments too:

```bash
funerr server.js --port 3000
```

-----

## ⚡ What Does It Look Like?

### ❌ The Boring Way (Standard Node)

```text
/Users/dev/project/app.js:14
    await fetchData();
    ^^^^^
SyntaxError: await is only valid in async functions
    at Object.compileFunction (node:vm:360:18)
    at wrapSafe (node:internal/modules/cjs/loader:1088:15)
```

### ✅ The FunErr Way (Emotional Damage Mode)

```text
 🔥 EMOTIONAL DAMAGE 🔥 
╔════════════════════════════════════════════════════════════════╗
║  SYNTAXERROR                                                   ║
╚════════════════════════════════════════════════════════════════╝

📍 Crime Scene: app.js:14

📝 What Broke: "await is only valid in async functions"

⚙️  Error Code: SYNTAX_ERROR (Google this if you're brave)

─────────────────────────────────────────────────────────────────
⏳  THE ROAST:
   You used 'await' outside an async function. Time doesn't work 
   like that, Einstein.

   await requires async context. This is JavaScript, not wish.com magic.

─────────────────────────────────────────────────────────────────
💡 HOW TO FIX (if you're capable):
   Wrap your code in: async function() { ... } or make the parent function async.

┌────────────────────────────────────────────────────────────┐
│ This error was 100% preventable. You know that, right?     │
└────────────────────────────────────────────────────────────┘
```

-----

## 🧠 The Brains (It's not just random insults)

FunErr doesn't just read the error name. It uses a **Pattern Detector** to analyze the context of your crash. It currently supports **40+ specific scenarios**, including:

### 💀 Async & Promises

  * **Ghosting:** Unhandled Promise Rejections.
  * **Time Travel:** Using `await` outside async.
  * **The Amnesiac:** Calling async functions without `await`.

### 📦 Modules & Imports

  * **The Faker:** Importing modules you never installed (`MODULE_NOT_FOUND`).
  * **The Boomer:** Using `require` in ES Modules.
  * **The Fraud:** Exporting variables that don't exist.

### 🚫 Types & Nulls

  * **The Void:** Trying to read properties of `null` or `undefined`.
  * **The Imposter:** Calling something that isn't a function.
  * **The Stubborn:** Trying to reassign a `const`.

### 🌐 Network & Systems

  * **The Squatter:** `EADDRINUSE` (Port already in use).
  * **The Ghost:** `ENOENT` (File doesn't exist).
  * **The Rejection:** `ECONNREFUSED` (Database/Server down).

### 🍝 Syntax Spaghetti

  * **The Dropout:** Missing parentheses, brackets, or braces.
  * **The Typo:** Unexpected tokens.
  * **The Mess:** Malformed JSON parsing.

-----

## 🤝 Contributing

Got a new error that made you cry? Found a way to roast developers even harder?

1.  Fork the repo.
2.  Submit a PR.

## 📄 License

MIT. Do whatever you want with it. Just don't blame me when your ego gets bruised.

```
```