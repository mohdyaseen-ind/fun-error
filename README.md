# 🔥 FunErr

**Intelligent Node.js error wrapper with pattern detection and helpful debugging hints**

**Features** • **Installation** • **Usage** • **Error Coverage** • **Contributing**

---

## 📋 Overview

FunErr is an enhanced error reporting tool for Node.js that transforms cryptic stack traces into actionable debugging information. By analyzing error patterns and context, it provides:

- **Pattern Recognition**: Detects 80+ specific error scenarios
- **Contextual Hints**: Offers practical solutions for each error type
- **Enhanced Formatting**: Clear, color-coded terminal output
- **Zero Configuration**: Drop-in replacement for the `node` command

## ✨ Features

### Intelligent Error Detection
FunErr doesn't just display errors—it understands them. The pattern detection engine identifies specific failure modes across multiple categories:

- **Async/Promise Operations**: Unhandled rejections, missing await, double resolution
- **Module System**: Import/export issues, ESM vs CommonJS conflicts
- **Type Errors**: Undefined properties, null references, type mismatches
- **Network & I/O**: Connection failures, file system errors, permission issues
- **Syntax & Parsing**: Token errors, JSON parsing, regex validation
- **Database Operations**: Connection errors, query failures, constraint violations
- **Memory & Performance**: Stack overflows, memory leaks, buffer errors

### Clear, Actionable Output
Each error includes:
- **Error Type & Message**: What went wrong
- **Location**: File, line, and column number
- **Context**: Code snippet where available
- **Solution**: Specific fix recommendations
- **System Code**: For system-level errors (ENOENT, EADDRINUSE, etc.)

## 📦 Installation

### Global Installation (Recommended)
```bash
npm install -g fun-error
```

### Local Installation
```bash
npm install --save-dev fun-error
```

### Using npx
```bash
npx fun-error your-script.js
```
Note: npx will download and cache the package on first use.

## 🚀 Usage

### Basic Usage
Replace `node` with `funerr` in your command:

```bash
# Standard Node.js
node index.js

# With FunErr
funerr index.js
```

### With Arguments
All Node.js arguments and script parameters are supported:

```bash
funerr server.js --port 3000
funerr test.js --verbose --config ./config.json
```

### In package.json Scripts
```json
{
  "scripts": {
    "dev": "funerr server.js",
    "test": "funerr test/runner.js"
  }
}
```

## 📊 Output Comparison

### Standard Node.js Error
```
/Users/developer/project/app.js:14
    await fetchData();
    ^^^^^
SyntaxError: await is only valid in async functions and the top level bodies of modules
    at Object.compileFunction (node:vm:360:18)
    at wrapSafe (node:internal/modules/cjs/loader:1088:15)
    at Module._compile (node:internal/modules/cjs/loader:1123:27)
```

### FunErr Enhanced Output
```
 🔥 EMOTIONAL DAMAGE 🔥 
╔════════════════════════════════════════════════════════════════╗
║  SYNTAXERROR                                                   ║
╚════════════════════════════════════════════════════════════════╝

📍 Crime Scene: app.js:14:5
📝 What Broke:   "await is only valid in async functions"
📄 The Evidence: await fetchData();...

─────────────────────────────────────────────────────────────────
⏳  THE ROAST:
   You used 'await' outside an async function. Time doesn't work 
   like that, Einstein.

   await requires async context. This is JavaScript, not wish.com magic.

─────────────────────────────────────────────────────────────────
💡 HOW TO FIX (if you're capable):
   Wrap your code in: async function() { ... } or make the parent 
   function async.

┌────────────────────────────────────────────────────────────┐
│ This error was 100% preventable. You know that, right?   │
│ Want the boring Node error? Remove 'funerr' like a coward │
└────────────────────────────────────────────────────────────┘
```

## 🎯 Error Coverage

FunErr recognizes and provides specialized handling for 80+ error patterns:

### Async & Promises (6 patterns)
- Unhandled Promise Rejections
- await outside async context
- Missing await on async calls
- Double resolution attempts
- Missing catch handlers
- .then() on non-Promises

### Module System (7 patterns)
- MODULE_NOT_FOUND errors
- ESM vs CommonJS conflicts
- Import outside module context
- Missing/incorrect exports
- Named export not found
- Default export issues

### Type Errors (12 patterns)
- Undefined/null property access
- Not a function errors
- Not iterable errors
- Not a constructor errors
- Const reassignment
- Type conversion failures
- Reduce on empty arrays
- Frozen/sealed objects
- Circular JSON structures

### Network & I/O (13 patterns)
- EADDRINUSE (port in use)
- ENOENT (file not found)
- ECONNREFUSED (connection refused)
- ETIMEDOUT (timeout)
- EACCES/EPERM (permission denied)
- EISDIR/ENOTDIR (file/directory confusion)
- DNS resolution failures
- Socket errors
- Stream errors

### Syntax Errors (10 patterns)
- Unexpected tokens
- Missing brackets/parentheses
- Unexpected EOF
- Reserved word usage
- Strict mode violations
- Invalid destructuring
- Illegal return statements

### Database Errors (6 patterns)
- Connection failures (MongoDB, PostgreSQL)
- Duplicate key violations
- Table/column not found
- SQL syntax errors

### Memory & Performance (3 patterns)
- Stack overflow (infinite recursion)
- Out of memory errors
- Fatal errors

### Additional Categories
- JSON parsing errors
- Regular expression errors
- Buffer & encoding errors
- Crypto/security errors
- Worker/thread errors
- Stream errors
- Assertion failures

**Total: 80+ error patterns recognized and handled**

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Adding New Error Patterns

1. **Identify the Error**: Find a Node.js error that needs better handling
2. **Add Pattern Detection**: Update `detectPattern()` in the source
3. **Create Roast Entry**: Add helpful message and fix instructions
4. **Test**: Verify detection works correctly
5. **Submit PR**: Include example error and test case

### Contribution Guidelines

- Follow existing code style
- Add tests for new patterns
- Update documentation
- Keep error messages helpful and constructive
- Ensure backwards compatibility

### Example Contribution
```javascript
// In detectPattern()
if (msg.includes("your new error pattern")) {
  return "your_error_key";
}

// In getRoastAndHint()
your_error_key: {
  emoji: "🔥",
  roast: "Clear explanation of what went wrong",
  hint: "Specific steps to fix the issue",
  extraBurn: "Optional additional context"
}
```

## 📝 Changelog

### Version 2.0.0 (Latest)
- Expanded from 40+ to 80+ error patterns
- Added worker/thread error detection
- Added stream error handling
- Added crypto/security error patterns
- Improved location parsing accuracy
- Enhanced documentation

### Version 1.0.0
- Initial release
- 40+ error pattern detection
- Color-coded terminal output
- Source location tracking

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Inspired by the need for better developer experience in Node.js debugging
- Built with frustration, caffeine, and a desire to make error messages useful
- Thanks to all contributors and users who provided feedback

## 📞 Support

- Bug Reports: GitHub Issues
- Feature Requests: GitHub Discussions  
- Email: your.email@example.com

## ⭐ Show Your Support

If FunErr helps you debug faster, consider:
- Starring the repository
- Sharing on social media
- Writing about your experience
- Contributing to the project

---

**Made with 🔥 by Mohammed Yaseen**

*Because error messages should be helpful, not hostile*