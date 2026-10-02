import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
const app = new Hono();

const mockProductIds = new Set([
  "celly-001",
  "celly-002",
  "celly-003",
  "celly-004",
  "celly-005",
  "celly-006",
]);

async function getProducts() {
  const products = (await kv.get("products")) ?? [];
  const realProducts = products.filter((product: any) => !mockProductIds.has(product.id));
  if (realProducts.length !== products.length) await kv.set("products", realProducts);
  return realProducts;
}

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
  const uploadedFiles = formData.getAll("files").filter((value): value is File => value instanceof File);
  const legacyFile = formData.get("file");
  const files = uploadedFiles.length ? uploadedFiles : legacyFile instanceof File ? [legacyFile] : [];
  if (!files.length) return c.json({ error: "Choose at least one image file to upload" }, 400);
  if (files.length > 8) return c.json({ error: "Upload no more than 8 images at a time" }, 400);
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  for (const file of files) {
    if (!extensions[file.type]) return c.json({ error: "Use JPG, PNG, or WebP images" }, 400);
    if (file.size > 5 * 1024 * 1024) return c.json({ error: "Each image must be 5 MB or smaller" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const paths: string[] = [];
  for (const file of files) {
    const path = `${crypto.randomUUID()}.${extensions[file.type]}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      if (paths.length) await supabase.storage.from("product-images").remove(paths);
      return c.json({ error: error.message }, 500);
    }
    paths.push(path);
  }
  const urls = paths.map((path) => supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
  return c.json({ urls, url: urls[0] }, 201);
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
  const products = await getProducts();
  return c.json({ products });
});

function offerIsLive(offer: any, now = Date.now()) {
  if (!offer.active) return false;
  const startsAt = offer.startsAt ? Date.parse(offer.startsAt) : null;
  const endsAt = offer.endsAt ? Date.parse(offer.endsAt) : null;
  return (startsAt === null || (Number.isFinite(startsAt) && startsAt <= now))
    && (endsAt === null || (Number.isFinite(endsAt) && endsAt >= now));
}

app.get("/make-server-f5814922/offers", async (c) => {
  const offers = (await kv.get("offers")) ?? [];
  return c.json({ offers: offers.filter((offer: any) => offerIsLive(offer)) });
});

app.get("/make-server-f5814922/admin/offers", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const offers = (await kv.get("offers")) ?? [];
  offers.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ offers });
});

app.post("/make-server-f5814922/admin/offers", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const input = await c.req.json();
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!title || !description) return c.json({ error: "Offer title and message are required" }, 400);
  if (title.length > 90 || description.length > 300) return c.json({ error: "Offer title or message is too long" }, 400);
  const offers = (await kv.get("offers")) ?? [];
  const offer = {
    id: crypto.randomUUID(),
    title,
    description,
    image: typeof input.image === "string" ? input.image.trim().slice(0, 1000) : "",
    discountLabel: typeof input.discountLabel === "string" ? input.discountLabel.trim().slice(0, 60) : "",
    promoCode: typeof input.promoCode === "string" ? input.promoCode.trim().slice(0, 40) : "",
    startsAt: typeof input.startsAt === "string" && input.startsAt ? input.startsAt : "",
    endsAt: typeof input.endsAt === "string" && input.endsAt ? input.endsAt : "",
    active: input.active !== false,
    createdAt: new Date().toISOString(),
  };
  offers.unshift(offer);
  await kv.set("offers", offers);
  return c.json({ offer }, 201);
});

app.put("/make-server-f5814922/admin/offers/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const input = await c.req.json();
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!title || !description) return c.json({ error: "Offer title and message are required" }, 400);
  if (title.length > 90 || description.length > 300) return c.json({ error: "Offer title or message is too long" }, 400);
  const offers = (await kv.get("offers")) ?? [];
  const existing = offers.find((offer: any) => offer.id === c.req.param("id"));
  if (!existing) return c.json({ error: "Offer not found" }, 404);
  const updated = {
    ...existing,
    title,
    description,
    image: typeof input.image === "string" ? input.image.trim().slice(0, 1000) : existing.image || "",
    discountLabel: typeof input.discountLabel === "string" ? input.discountLabel.trim().slice(0, 60) : "",
    promoCode: typeof input.promoCode === "string" ? input.promoCode.trim().slice(0, 40) : "",
    startsAt: typeof input.startsAt === "string" && input.startsAt ? input.startsAt : "",
    endsAt: typeof input.endsAt === "string" && input.endsAt ? input.endsAt : "",
    active: input.active !== false,
  };
  await kv.set("offers", offers.map((offer: any) => offer.id === updated.id ? updated : offer));
  return c.json({ offer: updated });
});

app.delete("/make-server-f5814922/admin/offers/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const offers = (await kv.get("offers")) ?? [];
  await kv.set("offers", offers.filter((offer: any) => offer.id !== c.req.param("id")));
  return c.json({ success: true });
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
  const images = Array.isArray(product.images) ? [...new Set(product.images.filter((image: any) => typeof image === "string" && image.trim()))] : [];
  if (images.length < 2 || images.length > 8) return c.json({ error: "Each product needs between two and eight images" }, 400);
  product.images = images;
  product.image = images[0];
  const products = await getProducts();
  await kv.set("products", [product, ...products]);
  return c.json({ product }, 201);
});

app.put("/make-server-f5814922/products/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const product = await c.req.json();
  const images = Array.isArray(product.images) ? [...new Set(product.images.filter((image: any) => typeof image === "string" && image.trim()))] : [];
  if (images.length < 2 || images.length > 8) return c.json({ error: "Each product needs between two and eight images" }, 400);
  product.images = images;
  product.image = images[0];
  const products = await getProducts();
  await kv.set("products", products.map((item: any) => item.id === c.req.param("id") ? product : item));
  return c.json({ product });
});

app.delete("/make-server-f5814922/products/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "Admin access required" }, 403);
  const products = await getProducts();
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
  const products = await getProducts();
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
