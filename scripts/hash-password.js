// Usage: node scripts/hash-password.js "YourStrongPassword"
const bcrypt = require("bcryptjs");
const pw = process.argv[2];
if (!pw) {
  console.error('Provide a password, e.g.  node scripts/hash-password.js "Secret123!"');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 10);
console.log(hash);
