require("dotenv").config();
const mysql = require("mysql2");

console.log("HOST:", process.env.DB_HOST);
console.log("USER:", process.env.DB_USER);
console.log("DB:", process.env.DB_NAME);

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error("Connection failed:", err);
    return;
  }

  console.log("✅ MySQL Connected Successfully");
  connection.end();
});
