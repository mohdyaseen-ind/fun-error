# 🔥 fun-error

> Error messages that actually help you **and** hurt your feelings.

`fun-error` is a Node.js CLI that wraps `node` and turns boring stack traces into:

- A clean, colorful **EMOTIONAL DAMAGE** panel  
- Parsed info: **error type, file, line, column, code**
- A **custom roast** based on the actual error
- A **real fix hint**, not just “something went wrong”

No raw stacktrace. No noise. Just pain + guidance.

---

## 🚀 Install

```bash
npm install -g fun-error

This gives you a global CLI:

funerr


⸻

🏃‍♂️ Usage

Run your files with funerr instead of node:

funerr app.js
funerr server.js --port 3000
funerr node script.js   # also works

Use in package.json scripts:

{
  "scripts": {
    "dev": "funerr server.js",
    "start": "funerr app.js"
  }
}

Then:

npm run dev


⸻

🧠 What it shows

On error, you’ll see something like:

 🔥 EMOTIONAL DAMAGE 🔥
╔════════════════════════════════════════════════════════════════╗
║  TYPEERROR                                                      ║
╚════════════════════════════════════════════════════════════════╝

📍 Crime Scene:  app.js:12:15
📝 What Broke:   "Cannot read properties of undefined (reading 'map')"
📄 The Evidence: const result = obj.map(x => x)...

⚙️  Error Code:  ETYPE (Google this if you're brave)

── THE ROAST ─────────────────────────────────────────────────────
💀 EMOTIONAL DAMAGE! You tried to .property on undefined.
   Undefined said "I literally have nothing" and you still asked for more.

💡 HOW TO FIX (if you're capable):
   Check it first: if (obj) or use optional chaining obj?.property

The original Node error is hidden on purpose.
If you want the old boring output → use node instead.

⸻

🎯 Types of errors it understands

fun-error doesn’t just pattern-match one or two things — it has a big internal map of error patterns and custom roasts.

It can uniquely detect and respond to errors like:
	•	Async / Promise issues
	•	Unhandled promise rejections
	•	await used outside async
	•	Forgot await on async calls
	•	Type & value chaos
	•	Accessing properties on undefined / null
	•	"x is not a function" / "undefined is not a function"
	•	"x is not iterable" / "x is not a constructor"
	•	Reassigning const
	•	Invalid type conversions / array length issues
	•	Network & system errors (via code)
	•	EADDRINUSE (port already in use)
	•	ENOENT (file/path not found)
	•	ECONNREFUSED, ECONNRESET, ETIMEDOUT, ENOTFOUND
	•	EACCES / EPERM (permission denied)
	•	EMFILE (too many open files)
	•	EEXIST (file already exists)
	•	HTTP / Express-style problems
	•	Cannot set headers after they are sent
	•	write after end
	•	Request aborted
	•	Syntax & parsing
	•	Unexpected tokens
	•	Missing ) / }
	•	Unexpected end of input
	•	Invalid / unexpected token
	•	Illegal return
	•	Spread/rest misuse
	•	JSON, modules, and deps
	•	JSON.parse explosions
	•	Cannot find module / MODULE_NOT_FOUND
	•	require() vs ESM/import issues
	•	Circular / cyclic references
	•	Recursion / memory / regex
	•	Maximum call stack size exceeded
	•	Out-of-memory-ish messages
	•	Invalid / unterminated regex

Anything that doesn’t fit a known pattern still gets:
	•	A generic roast
	•	A generic hint on how to start debugging

⸻

⚠️ When NOT to use it
	•	When you need the full raw stacktrace
	•	In production logs (this is for dev only)
	•	Inside tooling that parses Node’s native error format

For serious debugging, swap back to:

node app.js

For chaos and motivation:

funerr app.js


⸻

👤 Author

Built by Yaseen —
because debugging should feel like a meme, not a mental breakdown.