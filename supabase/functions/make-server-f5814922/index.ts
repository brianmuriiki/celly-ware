import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-f5814922/health", (c) => {
  return c.json({ status: "ok" });
});

const defaultProducts = [
  { id: "celly-001", name: "Zuri Floral Maxi", category: "Dresses", price: 2850, image: "https://images.unsplash.com/photo-1625646741211-711bdd65c570?auto=format&fit=crop&w=900&q=85", description: "A graceful, easy-moving floral maxi made for your best days.", sizes: ["S", "M", "L", "XL"], featured: true },
  { id: "celly-002", name: "Nia Statement Set", category: "Dresses", price: 3200, image: "https://images.unsplash.com/photo-1709809081557-78f803ce93a0?auto=format&fit=crop&w=900&q=85", description: "Bold colour, relaxed tailoring and an unforgettable silhouette.", sizes: ["S", "M", "L"], featured: true },
  { id: "celly-003", name: "Amani City Heels", category: "Shoes", price: 2400, image: "https://images.unsplash.com/photo-1686319521522-e8891b3d5769?auto=format&fit=crop&w=900&q=85", description: "Polished heels with a steady fit for day-to-night confidence.", sizes: ["37", "38", "39", "40", "41"] },
  { id: "celly-004", name: "Safi Teal Jumpsuit", category: "Dresses", price: 2950, image: "https://images.unsplash.com/photo-1485570661444-73b3f0ff9d2f?auto=format&fit=crop&w=900&q=85", description: "A clean, confident one-piece with a beautifully fluid drape.", sizes: ["S", "M", "L", "XL"], featured: true },
  { id: "celly-005", name: "Imani Rouge Dress", category: "Dresses", price: 2650, image: "https://images.unsplash.com/photo-1560869576-0fe77ff7f9f4?auto=format&fit=crop&w=900&q=85", description: "A rich red occasion dress designed to make an entrance.", sizes: ["S", "M", "L"] },
  { id: "celly-006", name: "Malaika Blue Midi", category: "Dresses", price: 2500, image: "https://images.unsplash.com/photo-1623013736455-1b8d79cc0b5f?auto=format&fit=crop&w=900&q=85", description: "An elegant blue midi with a flattering, timeless shape.", sizes: ["M", "L", "XL"] },
];

async function authenticatedUser(c: any) {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data } = await supabase.auth.getUser(token);
  return data.user;
}

async function requireAdmin(c: any) {
  const user = await authenticatedUser(c);
  // app_metadata is controlled by trusted server-side tooling; user_metadata can be edited by the account owner.
  const role = user?.app_metadata?.role;
  return user && role === "admin" ? user : null;
}

app.get("/make-server-f5814922/admin/verify", async (c) => {
  const user = await requireAdmin(c);
  if (!user) return c.json({ error: "Admin access required" }, 403);
  return c.json({ success: true, email: user.email });
});

app.post("/make-server-f5814922/product-images", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);

  const formData = await c.req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return c.json({ error: "Choose an image to upload" }, 400);
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[file.type];
  if (!extension) return c.json({ error: "Use a JPG, PNG, or WebP image" }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: "Images must be 5 MB or smaller" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return c.json({ error: error.message }, 500);
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return c.json({ url: data.publicUrl }, 201);
});

async function sendOrderNotification(order: any): Promise<boolean> {
  const itemLines = order.items.map((item: any) =>
    `${item.quantity} x ${item.name} (size ${item.size}) — KSh ${item.price.toLocaleString("en-KE")}`
  ).join("\n");
  const text = [
    `A new Celly-Ware order was placed.`,
    `Order: ${order.id}`,
    `Customer: ${order.name}`,
    `Email: ${order.customerEmail || "Not provided"}`,
    `Phone: ${order.phone}`,
    `Delivery location: ${order.location}`,
    order.note ? `Order note: ${order.note}` : "",
    "",
    "Items:",
    itemLines,
    "",
    `Total: KSh ${order.total.toLocaleString("en-KE")}`,
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://formspree.io/f/mljdyrvw", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        _subject: `New Celly-Ware order ${order.id}`,
        name: order.name,
        email: order.customerEmail || "Not provided",
        phone: order.phone,
        location: order.location,
        order_id: order.id,
        total: `KSh ${order.total.toLocaleString("en-KE")}`,
        items: itemLines,
        message: text,
      }),
    });
    if (!response.ok) {
      console.error("Formspree order notification failed:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not submit order to Formspree:", error);
    return false;
  }
}

app.get("/make-server-f5814922/products", async (c) => {
  let products = await kv.get("products");
  if (!products) {
    products = defaultProducts;
    await kv.set("products", products);
  }
  return c.json({ products });
});

app.post("/make-server-f5814922/newsletter", async (c) => {
  const body = await c.req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "A valid email address is required" }, 400);
  }
  await kv.set(`newsletter:${email}`, { email, createdAt: new Date().toISOString() });
  return c.json({ success: true }, 201);
});

app.post("/make-server-f5814922/products", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const product = await c.req.json();
  const products = (await kv.get("products")) ?? defaultProducts;
  await kv.set("products", [product, ...products]);
  return c.json({ product }, 201);
});

app.put("/make-server-f5814922/products/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const product = await c.req.json();
  const products = (await kv.get("products")) ?? defaultProducts;
  await kv.set("products", products.map((item: any) => item.id === c.req.param("id") ? product : item));
  return c.json({ product });
});

app.delete("/make-server-f5814922/products/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const products = (await kv.get("products")) ?? defaultProducts;
  await kv.set("products", products.filter((item: any) => item.id !== c.req.param("id")));
  return c.json({ success: true });
});

app.post("/make-server-f5814922/orders", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Please sign in before ordering" }, 401);
  const order = await c.req.json();
  if (!order.name || !order.phone || !order.location || !Array.isArray(order.items) || !order.items.length) {
    return c.json({ error: "Missing order details" }, 400);
  }
  const products = (await kv.get("products")) ?? defaultProducts;
  const items = [];
  for (const requested of order.items) {
    const product = products.find((item: any) => item.id === requested.id);
    const quantity = Number(requested.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || !product.sizes.includes(requested.size)) {
      return c.json({ error: "One or more order items are invalid" }, 400);
    }
    items.push({ ...product, size: requested.size, quantity });
  }
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const id = crypto.randomUUID();
  const savedOrder = {
    name: String(order.name).trim(),
    phone: String(order.phone).trim(),
    location: String(order.location).trim(),
    note: typeof order.note === "string" ? order.note.trim() : "",
    items,
    total,
    id,
    customerId: user.id,
    customerEmail: user.email,
    status: "new",
    createdAt: new Date().toISOString(),
  };
  await kv.set(`order:${Date.now()}:${id}`, savedOrder);
  const notificationSent = await sendOrderNotification(savedOrder);
  return c.json({ id, success: true, notificationSent }, 201);
});

app.get("/make-server-f5814922/orders", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const orders = await kv.getByPrefix("order:");
  const statuses = await kv.getByPrefix("order-status:");
  const statusById = new Map(statuses.map((entry: any) => [entry.id, entry.status]));
  for (const order of orders) order.status = statusById.get(order.id) ?? order.status ?? "new";
  orders.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ orders });
});

app.get("/make-server-f5814922/my-orders", async (c) => {
  const user = await authenticatedUser(c);
  if (!user) return c.json({ error: "Please sign in to view your orders" }, 401);
  const [allOrders, statuses] = await Promise.all([
    kv.getByPrefix("order:"),
    kv.getByPrefix("order-status:"),
  ]);
  const statusById = new Map(statuses.map((entry: any) => [entry.id, entry.status]));
  const orders = allOrders
    .filter((order: any) => order.customerId === user.id)
    .map((order: any) => ({
      ...order,
      status: statusById.get(order.id) ?? order.status ?? "new",
    }))
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ orders });
});

app.patch("/make-server-f5814922/orders/:id/status", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const { status } = await c.req.json();
  const allowedStatuses = ["new", "confirmed", "packed", "dispatched", "delivered", "cancelled"];
  if (!allowedStatuses.includes(status)) return c.json({ error: "Invalid order status" }, 400);
  const id = c.req.param("id");
  const order = (await kv.getByPrefix("order:")).find((entry: any) => entry.id === id);
  if (!order) return c.json({ error: "Order not found" }, 404);
  await kv.set(`order-status:${id}`, { id, status, updatedAt: new Date().toISOString() });
  return c.json({ id, status, success: true });
});

app.get("/make-server-f5814922/newsletter", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const subscribers = await kv.getByPrefix("newsletter:");
  subscribers.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ subscribers });
});

Deno.serve(app.fetch);
