const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3000;

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== DATABASE =====
const db = new sqlite3.Database("./db.sqlite");

// ===== INIT TABLE =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      price INTEGER,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER,
      qty INTEGER,
      total INTEGER,
      status TEXT DEFAULT 'Diproses',
      created_at TEXT
    )
  `);

  // seed product
  db.get("SELECT COUNT(*) as c FROM products", (err, row) => {
    if (row.c === 0) {
      db.run(`
        INSERT INTO products (name,description,price,image) VALUES
        ('Milo 1kg','Serbuk cokelat bergizi',95000,'milo 1kg.png'),
        ('Milo Cereal 330gr','Cereal cokelat renyah',45000,'milo cereal.png'),
        ('Milo Cube 100gr','Cokelat kubus praktis',30000,'milo cube.jpeg')
      `);
    }
  });
});

// ===== ROUTES =====
app.get("/api/products", (req, res) => {
  db.all("SELECT * FROM products", (err, rows) => {
    res.json(rows);
  });
});

app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  db.run(
    "INSERT INTO users (username,password) VALUES (?,?)",
    [username, password],
    err => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [username, password],
    (err, row) => {
      res.json({ success: !!row, user: row });
    }
  );
});

// ===== CHECKOUT =====
app.post("/api/checkout", (req, res) => {
  console.log("CHECKOUT HIT", req.body);

  const { user_id, product_id, qty } = req.body;

  db.get(
    "SELECT * FROM products WHERE id=?",
    [product_id],
    (err, product) => {
      if (!product) {
        return res.json({ success: false });
      }

      const total = product.price * qty;

      db.run(
        `
        INSERT INTO orders 
        (user_id, product_id, qty, total, status, created_at)
        VALUES (?, ?, ?, ?, 'Diproses', datetime('now'))
        `,
        [user_id, product_id, qty, total],
        () => res.json({ success: true })
      );
    }
  );
});

// ===== ADMIN =====
app.get("/api/orders", (req, res) => {
  db.all(`
    SELECT orders.id, users.username, products.name, qty, total, status, created_at
    FROM orders
    JOIN users ON users.id = orders.user_id
    JOIN products ON products.id = orders.product_id
  `, (err, rows) => res.json(rows));
});

app.post("/api/update-order-status", (req, res) => {
  const { id, status } = req.body;
  db.run(
    "UPDATE orders SET status=? WHERE id=?",
    [status, id],
    () => res.json({ success: true })
  );
});

// ===== CRUD PRODUCT =====
app.post("/api/add-product", (req, res) => {
  const { name, description, price, image } = req.body;
  db.run(
    "INSERT INTO products (name,description,price,image) VALUES (?,?,?,?)",
    [name, description, price, image],
    () => res.json({ success: true })
  );
});

app.post("/api/update-product", (req, res) => {
  const { id, name, description, price, image } = req.body;
  db.run(
    "UPDATE products SET name=?,description=?,price=?,image=? WHERE id=?",
    [name, description, price, image, id],
    () => res.json({ success: true })
  );
});

app.post("/api/delete-product", (req, res) => {
  db.run(
    "DELETE FROM products WHERE id=?",
    [req.body.id],
    () => res.json({ success: true })
  );
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log("SERVER RUNNING ON http://localhost:" + PORT);
});
