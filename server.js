import { Database } from "bun:sqlite";

const db = new Database("db.sqlite");

// ===== DATABASE =====
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

db.run(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,
  price INTEGER,
  image TEXT
)`);

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
if (db.query("SELECT COUNT(*) c FROM products").get().c === 0) {
    db.run(`
  INSERT INTO products VALUES
  (NULL,'Milo 1kg','Serbuk cokelat bergizi',95000,'milo 1kg.png'),
  (NULL,'Milo Cereal 330gr','Cereal cokelat renyah',45000,'milo cereal.png'),
  (NULL,'Milo Cube 100gr','Cokelat kubus praktis',30000,'milo cube.jpeg')
  `);
}

// ===== SERVER =====
Bun.serve({
    port: 3000,
    async fetch(req) {
        console.log("REQUEST:", req.method, req.url);

        const url = new URL(req.url);

        // static
        if (url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.endsWith(".png") || url.pathname.endsWith(".jpeg")) {
            return new Response(Bun.file("./public" + (url.pathname === "/" ? "/index.html" : url.pathname)));
        }

        // get products
        if (url.pathname === "/api/products") {
            return Response.json(db.query("SELECT * FROM products").all());
        }
        // ADD PRODUCT
        if (url.pathname === "/api/add-product") {
            const d = await req.json();
            db.run(
                "INSERT INTO products (name,description,price,image) VALUES (?,?,?,?)",
                [d.name, d.description, d.price, d.image]
            );
            return Response.json({ success: true });
        }
        if (url.pathname === "/api/update-order-status" && req.method === "POST") {
            console.log("UPDATE STATUS HIT");

            let d;
            try {
                d = await req.json();
                console.log("DATA STATUS:", d);
            } catch (e) {
                return Response.json({ success: false, error: "JSON ERROR" });
            }

            db.run(
                "UPDATE orders SET status=? WHERE id=?",
                [d.status, d.id]
            );

            return Response.json({ success: true });
        }

        // UPDATE PRODUCT
        if (url.pathname === "/api/update-product") {
            const d = await req.json();
            db.run(
                "UPDATE products SET name=?, description=?, price=?, image=? WHERE id=?",
                [d.name, d.description, d.price, d.image, d.id]
            );
            return Response.json({ success: true });
        }

        // DELETE PRODUCT
        if (url.pathname === "/api/delete-product") {
            const d = await req.json();
            db.run("DELETE FROM products WHERE id=?", [d.id]);
            return Response.json({ success: true });
        }


        // register
        if (url.pathname === "/api/register") {
            const d = await req.json();
            db.run("INSERT INTO users VALUES(NULL,?,?)", [d.username, d.password]);
            return Response.json({ success: true });
        }

        // login
        if (url.pathname === "/api/login") {
            const d = await req.json();
            const user = db.query("SELECT * FROM users WHERE username=? AND password=?")
                .get(d.username, d.password);
            return Response.json({ success: !!user, user });
        }

        if (url.pathname === "/api/checkout" && req.method === "POST") {
            console.log("CHECKOUT HIT"); // ⬅️ DEBUG PENTING

            let d;
            try {
                d = await req.json();
                console.log("DATA MASUK:", d); // ⬅️ DEBUG
            } catch (e) {
                return new Response(
                    JSON.stringify({ success: false, error: "JSON ERROR" }),
                    { headers: { "Content-Type": "application/json" } }
                );
            }

            const product = db
                .query("SELECT * FROM products WHERE id = ?")
                .get(d.product_id);

            if (!product) {
                return Response.json({ success: false, error: "Produk tidak ditemukan" });
            }

            const total = product.price * d.qty;

            db.run(
                `INSERT INTO orders 
    (user_id, product_id, qty, total, status, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [d.user_id, d.product_id, d.qty, total, "Diproses"]
            );

            return Response.json({ success: true });
        }

        // admin orders
        if (url.pathname === "/api/orders") {
            return Response.json(
                db.query(`
      SELECT 
        orders.id,
        users.username,
        products.name,
        qty,
        total,
        status,
        created_at
      FROM orders
      JOIN users ON users.id = orders.user_id
      JOIN products ON products.id = orders.product_id
    `).all()
            );
        }




        return new Response("404");
    }
});
