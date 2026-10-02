import { useEffect, useMemo, useState } from "react";
import { projectId, publicAnonKey } from "../utils/supabase/info";

const productCategories = [
  "Dresses",
  "Tops",
  "Trousers",
  "Skirts",
  "Jeans",
  "Shorts",
  "Jumpsuits",
  "Co-ords",
  "Outerwear",
  "Shoes",
  "Accessories",
] as const;
type Category = (typeof productCategories)[number];
type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  image: string;
  images?: string[];
  description: string;
  sizes: string[];
  featured?: boolean;
};
type StoreOffer = {
  id: string;
  title: string;
  description: string;
  image: string;
  discountLabel: string;
  promoCode: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
};
type CartItem = Product & { quantity: number; size: string };
type Order = {
  id: string;
  name: string;
  phone: string;
  location: string;
  total: number;
  status: string;
  createdAt: string;
  items: CartItem[];
};
type NewsletterSignup = { email: string; createdAt: string };
type ToastMessage = { message: string; tone: "success" | "error" };
type Customer = {
  id: string;
  email: string;
  name?: string;
  accessToken: string;
};
type IconName =
  | "arrow"
  | "bag"
  | "check"
  | "close"
  | "edit"
  | "heart"
  | "instagram"
  | "menu"
  | "minus"
  | "plus"
  | "search"
  | "shield"
  | "trash"
  | "upload"
  | "user"
  | "whatsapp";

const categories = ["All", ...productCategories] as const;
const API = `https://${projectId}.supabase.co/functions/v1/make-server-f5814922`;
const money = (amount: number) => `KSh ${amount.toLocaleString("en-KE")}`;
const productImageList = (product: Product) => {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  if (product.image && !images.includes(product.image)) images.unshift(product.image);
  return images;
};
function offerState(offer: StoreOffer): "live" | "scheduled" | "expired" | "paused" {
  if (!offer.active) return "paused";
  const now = Date.now();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return "scheduled";
  if (offer.endsAt && new Date(offer.endsAt).getTime() < now) return "expired";
  return "live";
}

function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    bag: <><path d="M6 8h12l1 13H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    edit: <><path d="m4 16-1 5 5-1L20 8l-4-4L4 16Z" /><path d="m14 6 4 4" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".5" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    minus: <path d="M5 12h14" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6 7 1 14h10l1-14" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    whatsapp: <><path d="M20.5 11.6A8.5 8.5 0 0 1 7.9 19l-4.4 1.3L4.8 16A8.5 8.5 0 1 1 20.5 11.6Z" /><path d="M8.4 7.7c.2-.4.4-.4.7-.4h.4c.1 0 .3 0 .4.4l.7 1.6c.1.2.1.4 0 .5l-.5.7c-.2.2-.3.4-.1.7.5 1 1.3 1.8 2.3 2.3.3.2.5.1.7-.1l.8-1c.2-.2.4-.2.6-.1l1.7.8c.2.1.4.2.4.4 0 .2-.1 1.1-.6 1.6-.5.5-1.3.8-2.1.6-1.2-.3-2.6-.9-4.2-2.3-1.3-1.2-2.2-2.7-2.5-3.8-.3-1.1.2-1.7.5-2Z" /></>,
  };
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

function ProductCard({
  product,
  onAdd,
  onOpen,
  saved,
  onToggleSaved,
}: {
  product: Product;
  onAdd: (product: Product) => void;
  onOpen: (product: Product) => void;
  saved: boolean;
  onToggleSaved: (product: Product) => void;
}) {
  return (
    <article className="group product-card">
      <div className="relative overflow-hidden bg-stone-100 aspect-[4/5]">
        <img
          alt={product.name}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          src={productImageList(product)[0] || product.image}
        />
        {product.featured && <span className="product-badge">Bestseller</span>}
        <button aria-label={`${saved ? "Remove" : "Save"} ${product.name}`} aria-pressed={saved} className={`heart-btn ${saved ? "saved" : ""}`} onClick={() => onToggleSaved(product)} type="button">
          <Icon name="heart" />
        </button>
        <button className="quick-add" onClick={() => onAdd(product)} type="button">
          Quick add
          <Icon name="plus" size={17} />
        </button>
      </div>
      <button className="w-full text-left pt-4" onClick={() => onOpen(product)} type="button">
        <p className="text-[0.67rem] uppercase tracking-[0.2em] text-stone-500">{product.category}</p>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <h3 className="font-serif text-xl text-stone-900">{product.name}</h3>
          <p className="whitespace-nowrap text-sm font-semibold">{money(product.price)}</p>
        </div>
      </button>
    </article>
  );
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("celly-saved") || "[]"); } catch { return []; }
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(() => {
    const saved = localStorage.getItem("celly-customer");
    return saved ? JSON.parse(saved) : null;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    fetch(`${API}/products`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => data.products?.length && setProducts(data.products))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("celly-cart");
    if (saved) setCart(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("celly-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("celly-saved", JSON.stringify(savedIds));
  }, [savedIds]);

  useEffect(() => {
    if (customer) localStorage.setItem("celly-customer", JSON.stringify(customer));
    else localStorage.removeItem("celly-customer");
  }, [customer]);

  useEffect(() => {
    let active = true;
    setIsAdmin(false);
    sessionStorage.removeItem("celly-admin-token");
    if (!customer?.accessToken) return () => { active = false; };

    fetch(`${API}/admin/verify`, { headers: { Authorization: `Bearer ${customer.accessToken}` } })
      .then((response) => {
        if (!active) return;
        if (response.ok) {
          sessionStorage.setItem("celly-admin-token", customer.accessToken);
          setIsAdmin(true);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [customer]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const authError = params.get("error_description") || params.get("error");
    if (!accessToken && !authError) return;

    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    setAccountOpen(true);
    if (authError) {
      setAccountMessage(authError);
      return;
    }

    fetch(`https://${projectId}.supabase.co/auth/v1/user`, {
      headers: { apikey: publicAnonKey, Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const user = await response.json();
        if (!response.ok) throw new Error(user.message || "Google sign-in could not be completed.");
        // Admin access is granted from trusted app_metadata by the server. Keep
        // the OAuth access token for the protected admin page and open it directly.
        if (user.app_metadata?.role === "admin") {
          sessionStorage.setItem("celly-admin-token", accessToken);
          window.location.replace("/admin");
          return;
        }
        setCustomer({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name,
          accessToken,
        });
        setAccountMessage("");
        notify("Welcome to Celly-Ware");
      })
      .catch((error) => setAccountMessage(error instanceof Error ? error.message : "Google sign-in could not be completed."));
  }, []);

  const visible = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter(
      (product) =>
        (savedOnly ? savedIds.includes(product.id) : category === "All" || product.category === category) &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          product.category.toLowerCase().includes(term)),
    );
  }, [products, category, search, savedOnly, savedIds]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const notify = (message: string, tone: ToastMessage["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 5000);
  };

  const addToCart = (product: Product, size = product.sizes[0]) => {
    setCart((current) => {
      const match = current.find((item) => item.id === product.id && item.size === size);
      return match
        ? current.map((item) =>
            item.id === product.id && item.size === size
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...current, { ...product, quantity: 1, size }];
    });
    setSelected(null);
    setCartOpen(true);
  };

  const updateQuantity = (id: string, size: string, delta: number) =>
    setCart((current) =>
      current
        .map((item) =>
          item.id === id && item.size === size
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  const toggleSaved = (product: Product) => {
    const removing = savedIds.includes(product.id);
    setSavedIds((current) => current.includes(product.id)
      ? current.filter((id) => id !== product.id)
      : [...current, product.id]);
    notify(removing ? "Removed from your saved pieces" : "Added to your saved pieces");
  };

  if (window.location.pathname.replace(/\/+$/, "") === "/admin") {
    return <AdminPanel fullPage onClose={() => { window.location.href = "/"; }} onProductsChange={setProducts} products={products} notify={notify} />;
  }

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-stone-900">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#fbfaf7]/95 backdrop-blur">
        <div className="bg-stone-900 px-5 py-2 text-center text-[0.65rem] font-medium uppercase tracking-[0.22em] text-white">
          Delivery countrywide · New pieces every week
        </div>
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex flex-1 items-center gap-7">
            <button className="icon-button lg:hidden" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} type="button">
              <Icon name="menu" />
            </button>
            <div className="hidden items-center gap-7 text-xs font-semibold uppercase tracking-widest lg:flex">
              <a href="#shop">Shop</a>
              <a href="#story">Our story</a>
              <a href="#track">Track order</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
          <a className="brand" href="#">CELLY<span>WARE</span></a>
          <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
            <button className="icon-button" aria-label="Search" onClick={() => setSearchOpen((v) => !v)} type="button">
              <Icon name="search" />
            </button>
            <button className="icon-button hidden sm:grid" aria-label={customer ? "Your account" : "Sign in"} onClick={() => setAccountOpen(true)} type="button">
              <Icon name="user" />
            </button>
            <button className="icon-button relative" aria-label={`Cart with ${cartCount} items`} onClick={() => setCartOpen(true)} type="button">
              <Icon name="bag" />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </nav>
        {menuOpen && <nav aria-label="Mobile navigation" className="flex flex-col gap-4 border-t border-stone-200 px-5 py-4 text-xs font-semibold uppercase tracking-widest lg:hidden" onClick={() => setMenuOpen(false)}><a href="#shop">Shop</a><a href="#track">Track order</a><a href="#story">Our story</a><a href="#contact">Contact</a><a href="#newsletter">Newsletter</a></nav>}
        {searchOpen && (
          <div className="mx-auto flex max-w-2xl items-center gap-3 border-t border-stone-200 px-5 py-4">
            <Icon name="search" className="text-stone-400" />
            <input
              autoFocus
              className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dresses, shoes and more..."
              value={search}
            />
            <button aria-label="Close search" onClick={() => setSearchOpen(false)} type="button"><Icon name="close" /></button>
          </div>
        )}
      </header>

      <main>
        <OffersBanner />
        <section className="hero">
          <img alt="Woman wearing a red floral dress from the new collection" src="https://images.unsplash.com/photo-1625646741211-711bdd65c570?auto=format&fit=crop&w=1600&q=85" />
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow text-white/80">The newest edit</p>
            <h1>Wear your<br /><em>moment.</em></h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/85 sm:text-base">
              Effortless pieces chosen to celebrate your style, your confidence, and every beautiful day.
            </p>
            <a className="light-button mt-8" href="#shop">
              Shop new arrivals <Icon name="arrow" />
            </a>
          </div>
          <div className="hero-note hidden lg:block">
            <span>01</span>
            <p>Curated with love<br />in Kenya</p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28" id="shop">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Just landed</p>
              <h2 className="section-title">Pieces to love</h2>
            </div>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-2">
              <button aria-pressed={savedOnly} className={`category-pill ${savedOnly ? "active" : ""}`} onClick={() => setSavedOnly((value) => !value)} type="button">Saved ({savedIds.length})</button>
              {categories.map((item) => (
                <button
                  className={`category-pill ${category === item ? "active" : ""}`}
                  key={item}
                  onClick={() => { setCategory(item); setSavedOnly(false); }}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {visible.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:gap-x-7 lg:gap-y-14">
              {visible.map((product) => (
                <ProductCard key={product.id} onAdd={addToCart} onOpen={setSelected} onToggleSaved={toggleSaved} saved={savedIds.includes(product.id)} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-stone-500">{!products.length ? "Our collection is being updated. Please check back soon." : savedOnly && !savedIds.length ? "You haven’t saved any pieces yet. Tap a heart on a product to add it here." : "No pieces found. Try another search."}</div>
          )}
        </section>

        <OrderTracking customer={customer} key={ordersRefresh} onSignIn={() => setAccountOpen(true)} />

        <section className="story-section" id="story">
          <div className="story-image">
            <img alt="Stylish women wearing teal outfits" src="https://images.unsplash.com/photo-1485570661444-73b3f0ff9d2f?auto=format&fit=crop&w=1200&q=85" />
          </div>
          <div className="story-copy">
            <p className="eyebrow">The Celly-Ware promise</p>
            <h2 className="section-title">Style that feels<br /><em>like you.</em></h2>
            <p>
              We believe the right outfit changes more than your look. Every Celly-Ware piece is hand-picked
              for quality, comfort, and the kind of confidence that stays with you.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-7 border-t border-stone-300 pt-7">
              <div><strong>Curated</strong><span>Small, thoughtful drops</span></div>
              <div><strong>Personal</strong><span>Real help on WhatsApp</span></div>
            </div>
          </div>
        </section>

        <section aria-labelledby="contact-heading" className="contact-section" id="contact">
          <div className="contact-intro">
            <p className="eyebrow">Here for you</p>
            <h2 className="section-title" id="contact-heading">Let’s talk style.</h2>
            <p>Questions about an order, sizing, or a new piece? Get in touch with Celly-Ware.</p>
          </div>
          <div className="contact-options">
            <a className="contact-card" href="tel:+254748294837"><span>Call us</span><strong>0748 294 837</strong><small>Tap to call</small></a>
            <a className="contact-card" href="mailto:cellyware23@gmail.com"><span>Email us</span><strong>cellyware23@gmail.com</strong><small>Tap to send an email</small></a>
            <a className="contact-card contact-card--whatsapp" href="https://chat.whatsapp.com/J3YQnaePEQUDeztJTDV32t?s=sh&amp;p=a&amp;ilr=4&amp;iam=2" rel="noreferrer" target="_blank"><span>Join our community</span><strong>WhatsApp group</strong><small>Get updates and connect with us ↗</small></a>
          </div>
        </section>

        <section className="newsletter" id="newsletter">
          <p className="eyebrow text-white/60">Stay in the know</p>
          <h2>First look at every drop.</h2>
          <p>New arrivals, styling notes and special offers — delivered simply.</p>
          <form onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const email = String(new FormData(form).get("email"));
            try {
              const response = await fetch(`${API}/newsletter`, { method: "POST", headers: { Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
              if (!response.ok) throw new Error();
              form.reset();
              notify("Welcome to the Celly-Ware list!");
            } catch { notify("We could not save your email. Please try again."); }
          }}>
            <input aria-label="Email address" name="email" placeholder="Your email address" required type="email" />
            <button type="submit">Join us <Icon name="arrow" size={18} /></button>
          </form>
        </section>
      </main>

      <footer>
        <div>
          <a className="brand text-white" href="#">CELLY<span>WARE</span></a>
          <p>Your style, beautifully chosen.</p>
        </div>
        <div><strong>Shop</strong><a href="#shop">New arrivals</a><a href="#shop">Dresses</a><a href="#shop">Shoes</a></div>
        <div><strong>Help</strong><a href="#track">Track your order</a><a href="#contact">Contact us</a><a href="https://chat.whatsapp.com/J3YQnaePEQUDeztJTDV32t?s=sh&amp;p=a&amp;ilr=4&amp;iam=2" rel="noreferrer" target="_blank">Join WhatsApp group</a></div>
        <div><strong>Follow</strong><a className="flex items-center gap-2" href="#"><Icon name="instagram" size={17} /> Instagram</a></div>
      </footer>

      <a
        aria-label="Chat with Celly-Ware on WhatsApp"
        className="whatsapp-float"
        href="https://wa.me/254748294837?text=Hello%20Celly-Ware%2C%20I%27d%20like%20help%20with%20an%20order."
        rel="noreferrer"
        target="_blank"
      >
        <Icon name="whatsapp" size={27} />
        <span>Chat with us</span>
      </a>

      {cartOpen && (
        <CartDrawer
          cart={cart}
          customer={customer}
          onClose={() => setCartOpen(false)}
          onOrder={(orderId, notificationSent) => {
            setCart([]);
            setOrdersRefresh((value) => value + 1);
            notify(notificationSent
              ? `Order #${orderId.slice(0, 8)} placed. Celly-Ware has been notified.`
              : `Order #${orderId.slice(0, 8)} is saved. Celly-Ware's email alert is pending.`);
          }}
          onRequireAuth={() => {
            setCartOpen(false);
            setAccountOpen(true);
          }}
          subtotal={subtotal}
          updateQuantity={updateQuantity}
        />
      )}
      {selected && <ProductModal key={selected.id} onAdd={addToCart} onClose={() => setSelected(null)} product={selected} />}
      {accountOpen && (
        <AccountModal
          authMessage={accountMessage}
          customer={customer}
          isAdmin={isAdmin}
          notify={notify}
          onClose={() => setAccountOpen(false)}
          onCustomerChange={setCustomer}
        />
      )}
      {toast && <div className={`toast toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}><Icon name={toast.tone === "success" ? "check" : "close"} size={18} />{toast.message}</div>}
    </div>
  );
}

function ProductModal({ product, onAdd, onClose }: { product: Product; onAdd: (p: Product, size: string) => void; onClose: () => void }) {
  const [size, setSize] = useState(product.sizes[0]);
  const [imageIndex, setImageIndex] = useState(0);
  const images = productImageList(product);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="product-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose} type="button"><Icon name="close" /></button>
        <div className="product-gallery">
          <img alt={`${product.name} photo ${imageIndex + 1} of ${images.length}`} src={images[imageIndex] || product.image} />
          {images.length > 1 && <>
            <button aria-label="Previous product image" className="gallery-arrow gallery-arrow--left" onClick={() => setImageIndex((index) => (index - 1 + images.length) % images.length)} type="button"><Icon name="arrow" /></button>
            <button aria-label="Next product image" className="gallery-arrow gallery-arrow--right" onClick={() => setImageIndex((index) => (index + 1) % images.length)} type="button"><Icon name="arrow" /></button>
            <div aria-label="Choose product image" className="gallery-thumbnails">
              {images.map((image, index) => <button aria-label={`Show product image ${index + 1}`} aria-pressed={imageIndex === index} className={imageIndex === index ? "active" : ""} key={`${image}-${index}`} onClick={() => setImageIndex(index)} type="button"><img alt="" src={image} /></button>)}
            </div>
          </>}
        </div>
        <div className="p-7 sm:p-10">
          <p className="eyebrow">{product.category}</p>
          <h2 className="font-serif text-4xl">{product.name}</h2>
          <p className="mt-3 font-semibold">{money(product.price)}</p>
          <p className="mt-6 text-sm leading-6 text-stone-600">{product.description}</p>
          <p className="mt-7 text-xs font-bold uppercase tracking-widest">Select size</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.sizes.map((item) => <button className={`size-btn ${size === item ? "active" : ""}`} key={item} onClick={() => setSize(item)} type="button">{item}</button>)}
          </div>
          <button className="primary-button mt-8 w-full" onClick={() => onAdd(product, size)} type="button">Add to bag <Icon name="bag" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function OffersBanner() {
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  useEffect(() => {
    let active = true;
    fetch(`${API}/offers`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (active) setOffers(data.offers || []);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!offers.length) return null;
  return (
    <section aria-label="Current offers" className="offers-strip">
      {offers.map((offer) => (
        <article className="offer-banner" key={offer.id}>
          {offer.image && <img alt="" className="offer-banner-image" src={offer.image} />}
          <div className="offer-banner-copy">
            {offer.discountLabel && <span className="offer-kicker">{offer.discountLabel}</span>}
            <h2>{offer.title}</h2>
            <p>{offer.description}</p>
          </div>
          <div className="offer-banner-action">
            {offer.promoCode && <span>Use code <strong>{offer.promoCode}</strong></span>}
            {offer.endsAt && <span>Ends {new Date(offer.endsAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>}
            <a href="#shop">Shop now <Icon name="arrow" size={16} /></a>
          </div>
        </article>
      ))}
    </section>
  );
}

function OrderTracking({ customer, onSignIn }: { customer: Customer | null; onSignIn: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!customer) {
      setOrders([]);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    fetch(`${API}/my-orders`, { headers: { Authorization: `Bearer ${customer.accessToken}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "We could not load your orders. Please try again.");
        if (active) setOrders(data.orders || []);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "We could not load your orders. Please try again.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer?.accessToken, refresh]);

  const steps = ["new", "confirmed", "packed", "dispatched", "delivered"];
  const labels: Record<string, string> = {
    new: "Order received",
    confirmed: "Confirmed",
    packed: "Packed",
    dispatched: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return (
    <section className="order-tracking" id="track">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">Your Celly-Ware orders</p>
        <h2 className="section-title">Track your order</h2>
        <p className="tracking-intro">See the latest update for each order placed with your account.</p>
        {!customer ? (
          <div className="tracking-empty"><p>Sign in with the account you used to order to see your order status.</p><button className="primary-button" onClick={onSignIn} type="button">Sign in to view orders <Icon name="arrow" /></button></div>
        ) : loading ? (
          <p className="tracking-empty" role="status">Loading your orders…</p>
        ) : error ? (
          <div className="tracking-empty"><p className="error" role="alert">{error}</p><button className="secondary-button" onClick={() => setRefresh((value) => value + 1)} type="button">Try again</button></div>
        ) : !orders.length ? (
          <div className="tracking-empty"><p>No orders are linked to {customer.email} yet.</p><a className="secondary-button" href="#shop">Browse the collection</a></div>
        ) : (
          <div className="tracking-orders">
            {orders.map((order) => {
              const statusIndex = steps.indexOf(order.status);
              return (
                <article className="tracking-order" key={order.id}>
                  <div className="tracking-order-heading"><div><span>Order</span><strong>#{order.id.slice(0, 8).toUpperCase()}</strong></div><span>{new Date(order.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span></div>
                  <div className={`tracking-current ${order.status === "cancelled" ? "is-cancelled" : ""}`}>{labels[order.status] || order.status}</div>
                  {order.status === "cancelled" ? <p className="tracking-cancelled">This order was cancelled. Contact us on WhatsApp if you need help.</p> : (
                    <ol aria-label={`Order progress: ${labels[order.status] || order.status}`} className="tracking-steps">
                      {steps.map((step, index) => <li className={index <= statusIndex ? "complete" : ""} key={step}><span className="tracking-dot">{index < statusIndex ? "✓" : index + 1}</span><span>{labels[step]}</span></li>)}
                    </ol>
                  )}
                  <div className="tracking-order-details"><span>{order.items.map((item) => `${item.quantity}× ${item.name} (${item.size})`).join(", ")}</span><strong>{money(order.total)}</strong></div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function CartDrawer({ cart, customer, subtotal, updateQuantity, onClose, onOrder, onRequireAuth }: { cart: CartItem[]; customer: Customer | null; subtotal: number; updateQuantity: (id: string, size: string, delta: number) => void; onClose: () => void; onOrder: (orderId: string, notificationSent: boolean) => void; onRequireAuth: () => void }) {
  const [checkout, setCheckout] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setSubmitError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${customer?.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, items: cart, total: subtotal }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Your sign-in has expired. Sign in again, then retry your order.");
        if (response.status === 404) throw new Error("The order service is unavailable right now. Your bag is saved; please try again shortly.");
        if (response.status >= 500) throw new Error("We couldn’t reach the order service. Your bag is saved; please try again shortly.");
        throw new Error(result?.error || `We couldn’t place the order (HTTP ${response.status}). Check the details and try again.`);
      }
      onOrder(result?.id || "pending", result?.notificationSent === true);
      onClose();
    } catch (reason) {
      setSubmitError(reason instanceof Error && reason.message === "Failed to fetch"
        ? "We couldn’t connect to the order service. Your bag is saved; check your connection and try again."
        : reason instanceof Error ? reason.message : "We couldn’t place your order. Your bag is saved; please try again.");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="cart-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header"><div><p className="eyebrow">Your selection</p><h2>Shopping bag</h2></div><button aria-label="Close bag" onClick={onClose} type="button"><Icon name="close" /></button></div>
        {!checkout ? (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              {!cart.length && <div className="grid h-full place-content-center text-center"><Icon className="mx-auto text-stone-400" name="bag" size={34} /><p className="mt-4 font-serif text-2xl">Your bag is waiting</p><p className="mt-2 text-sm text-stone-500">Add something beautiful.</p></div>}
              {cart.map((item) => (
                <div className="cart-item" key={`${item.id}-${item.size}`}>
                  <img alt={item.name} src={productImageList(item)[0] || item.image} />
                  <div className="flex-1"><h3>{item.name}</h3><p>Size {item.size}</p><strong>{money(item.price)}</strong><div className="quantity"><button onClick={() => updateQuantity(item.id, item.size, -1)} type="button"><Icon name="minus" size={14} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.size, 1)} type="button"><Icon name="plus" size={14} /></button></div></div>
                </div>
              ))}
            </div>
            {cart.length > 0 && <div className="cart-footer"><div className="flex justify-between"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>Delivery fee is confirmed after placing your order.</p><button className="primary-button w-full" onClick={() => customer ? setCheckout(true) : onRequireAuth()} type="button">{customer ? "Continue to order" : "Sign in to order"} <Icon name={customer ? "arrow" : "user"} /></button></div>}
          </>
        ) : (
          <form className="checkout-form" onSubmit={submit}>
            <button className="text-left text-xs uppercase tracking-widest text-stone-500" onClick={() => setCheckout(false)} type="button">← Back to bag</button>
            <h3>Where should we deliver?</h3>
            <label>Full name<input name="name" required /></label>
            <label>Phone number<input name="phone" placeholder="07..." required type="tel" /></label>
            <label>Delivery town / area<input name="location" required /></label>
            <label>Order note<textarea name="note" placeholder="Landmark, preferred colour, or anything else..." rows={3} /></label>
            {submitError && <p className="checkout-error" role="alert">{submitError}</p>}
            <div className="mt-auto border-t border-stone-200 pt-5"><div className="mb-4 flex justify-between"><span>Total</span><strong>{money(subtotal)}</strong></div><button className="primary-button w-full" disabled={sending} type="submit">{sending ? "Sending..." : "Place order"} <Icon name="check" /></button></div>
          </form>
        )}
      </aside>
    </div>
  );
}

function AccountModal({ customer, isAdmin, onCustomerChange, onClose, notify, authMessage }: { customer: Customer | null; isAdmin: boolean; onCustomerChange: (customer: Customer | null) => void; onClose: () => void; notify: (message: string) => void; authMessage: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const signInWithGoogle = () => {
    setGoogleBusy(true);
    const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const authorizeUrl = new URL(`https://${projectId}.supabase.co/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", redirectTo);
    window.location.assign(authorizeUrl.toString());
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const name = String(form.get("name") || "");
    const endpoint = mode === "signup" ? "signup" : "token?grant_type=password";
    const body = mode === "signup" ? { email, password, data: { name } } : { email, password };
    try {
      const response = await fetch(`https://${projectId}.supabase.co/auth/v1/${endpoint}`, {
        method: "POST",
        headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.msg || result.error_description || "Could not continue.");
      if (!result.access_token) {
        setMode("login");
        setError("Account created. Check your email to confirm it, then sign in.");
        return;
      }
      onCustomerChange({
        id: result.user.id,
        email: result.user.email,
        name: result.user.user_metadata?.name,
        accessToken: result.access_token,
      });
      notify(mode === "signup" ? "Your account is ready" : "Welcome back");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  };

  if (customer) {
    return (
      <div className="modal-backdrop" onMouseDown={onClose}>
        <section className="account-card" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" aria-label="Close account" onClick={onClose} type="button"><Icon name="close" /></button>
          <div className="account-avatar"><Icon name="user" size={30} /></div>
          <p className="eyebrow">Your Celly-Ware account</p>
          <h2>Hello, {customer.name || "beautiful"}</h2>
          <p className="account-email">{customer.email}</p>
          <p className="account-note"><Icon name="check" size={17} /> You’re signed in and ready to order.</p>
          {isAdmin && <button className="primary-button w-full" onClick={() => { window.location.assign("/admin"); }} type="button">Admin portal <Icon name="arrow" /></button>}
          <button className="secondary-button w-full" onClick={() => { onCustomerChange(null); notify("You have signed out"); onClose(); }} type="button">Sign out</button>
        </section>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="account-card" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="Close account" onClick={onClose} type="button"><Icon name="close" /></button>
        <div className="admin-mark"><Icon name="user" size={28} /></div>
        <p className="eyebrow">Celly-Ware community</p>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="account-subtitle">{mode === "login" ? "Sign in before placing your order." : "Join us for a faster, safer checkout."}</p>
        {authMessage && <p className="error" role="alert">{authMessage}</p>}
        <button className="google-button" disabled={googleBusy} onClick={signInWithGoogle} type="button">
          <svg aria-hidden="true" className="google-mark" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
            <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
            <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z" />
            <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z" />
          </svg>
          <span>{googleBusy ? "Connecting..." : "Continue with Google"}</span>
        </button>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form onSubmit={submit}>
          {mode === "signup" && <label>Your name<input autoComplete="name" name="name" required /></label>}
          <label>Email<input autoComplete="email" name="email" required type="email" /></label>
          <label>Password<input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} name="password" required type="password" /></label>
          {error && <p className={error.startsWith("Account created") ? "account-message" : "error"}>{error}</p>}
          <button className="primary-button w-full" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"} <Icon name="arrow" /></button>
        </form>
        <button className="account-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} type="button">
          {mode === "login" ? "New to Celly-Ware? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </div>
  );
}

function AdminPanel({ products, onProductsChange, onClose, notify, fullPage }: { products: Product[]; onProductsChange: (p: Product[]) => void; onClose: () => void; notify: (m: string) => void; fullPage: boolean }) {
  const [token, setToken] = useState(sessionStorage.getItem("celly-admin-token") || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"products" | "orders" | "newsletter" | "offers" | "finance">("products");
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSignup[]>([]);
  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [addingOffer, setAddingOffer] = useState(false);
  const [editingOffer, setEditingOffer] = useState<StoreOffer | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch(`${API}/admin/verify`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "This account does not have admin access.");
      })
      .catch((reason) => {
        if (!active) return;
        sessionStorage.removeItem("celly-admin-token");
        setToken("");
        setError(reason instanceof Error ? reason.message : "This account does not have admin access.");
      });
    return () => { active = false; };
  }, []);
  const loadOrders = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(response.status === 403 ? "This account needs the admin role in Supabase." : "Could not load orders.");
      const data = await response.json();
      setOrders(data.orders);
      setView("orders");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load orders."); }
    finally { setBusy(false); }
  };
  const loadFinance = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(response.status === 403 ? "This account needs the admin role in Supabase." : "Could not load order totals.");
      const data = await response.json();
      setOrders(data.orders || []);
      setView("finance");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load order totals."); }
    finally { setBusy(false); }
  };
  const loadSubscribers = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/newsletter`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(response.status === 403 ? "This account needs the admin role in Supabase." : "Could not load subscribers.");
      const data = await response.json();
      setSubscribers(data.subscribers);
      setView("newsletter");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load subscribers."); }
    finally { setBusy(false); }
  };
  const loadOffers = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/admin/offers`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error("This account needs the admin role in Supabase.");
        if (response.status === 404) throw new Error("Offers API is missing from the deployed Supabase function. Deploy make-server-f5814922 again.");
        throw new Error(result.error || `Could not load offers (HTTP ${response.status}).`);
      }
      const data = await response.json();
      setOffers(data.offers || []);
      setView("offers");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load offers."); }
    finally { setBusy(false); }
  };
  const updateOrderStatus = async (order: Order, status: string) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Could not update order status.");
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
      notify("Order status updated");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update order status."); }
    finally { setBusy(false); }
  };
  const signOut = () => {
    sessionStorage.removeItem("celly-admin-token");
    setToken("");
    setOrders([]);
    setSubscribers([]);
    setOffers([]);
    setView("products");
  };
  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`https://${projectId}.supabase.co/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: publicAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error("Email or password is incorrect.");
      const verification = await fetch(`${API}/admin/verify`, { headers: { Authorization: `Bearer ${result.access_token}` } });
      const verificationResult = await verification.json().catch(() => ({}));
      if (!verification.ok) throw new Error(verificationResult.error || "This account does not have the admin role.");
      sessionStorage.setItem("celly-admin-token", result.access_token);
      setToken(result.access_token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign in."); }
    finally { setBusy(false); }
  };
  const save = async (product: Product, imageFiles: File[]): Promise<string | null> => {
    setBusy(true);
    try {
      let images = productImageList(product);
      if (imageFiles.length) {
        const formData = new FormData();
        imageFiles.forEach((file) => formData.append("files", file));
        const uploadResponse = await fetch(`${API}/product-images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "Could not upload this image.");
        images = [...images, ...(uploadResult.urls || [uploadResult.url]).filter(Boolean)];
      }
      if (images.length < 2) throw new Error("Add at least two images for this product.");
      const savedProduct = { ...product, image: images[0], images };
      const response = await fetch(`${API}/products${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(savedProduct),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save this product.");
      const next = editing ? products.map((p) => p.id === editing.id ? savedProduct : p) : [savedProduct, ...products];
      onProductsChange(next);
      setEditing(null);
      setAdding(false);
      notify(editing ? "Product updated" : "Product published");
      return null;
    } catch (reason) {
      return reason instanceof Error ? reason.message : "Could not save this product.";
    } finally {
      setBusy(false);
    }
  };
  const remove = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    const response = await fetch(`${API}/products/${product.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) {
      onProductsChange(products.filter((item) => item.id !== product.id));
      notify("Product removed");
    } else setError("Could not delete. Check admin permissions.");
  };
  const saveOffer = async (offer: Omit<StoreOffer, "id" | "createdAt">, id?: string, imageFile?: File | null): Promise<string | null> => {
    setBusy(true);
    try {
      let offerToSave = offer;
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadResponse = await fetch(`${API}/product-images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "Could not upload the offer image.");
        offerToSave = { ...offer, image: uploadResult.url || uploadResult.urls?.[0] || "" };
      }
      const response = await fetch(`${API}/admin/offers${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(offerToSave),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save this offer.");
      setOffers((current) => id
        ? current.map((item) => item.id === id ? result.offer : item)
        : [result.offer, ...current]);
      setAddingOffer(false);
      setEditingOffer(null);
      notify(id ? "Offer updated" : "Offer published");
      return null;
    } catch (reason) {
      return reason instanceof Error ? reason.message : "Could not save this offer.";
    } finally { setBusy(false); }
  };
  const removeOffer = async (offer: StoreOffer) => {
    if (!window.confirm(`Delete the offer “${offer.title}”?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/admin/offers/${offer.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not delete this offer.");
      setOffers((current) => current.filter((item) => item.id !== offer.id));
      notify("Offer removed");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this offer."); }
    finally { setBusy(false); }
  };
  return (
    <div className={fullPage ? "admin-page" : "modal-backdrop"}>
      <section className={`admin-panel ${fullPage ? "admin-fullpage" : ""}`}>
        {fullPage ? <div className="admin-page-top"><a className="brand" href="/">CELLY<span>WARE</span></a><a href="/">Back to store</a></div> : <button className="modal-close" aria-label="Close admin" onClick={onClose} type="button"><Icon name="close" /></button>}
        {!token ? (
          <form className="admin-login" onSubmit={login}>
            <div className="admin-mark"><Icon name="shield" size={28} /></div>
            <p className="eyebrow">Celly-Ware administrator</p>
            <h2>Admin sign in</h2>
            <p>Use your private store administrator account.</p>
            <label>Email<input autoComplete="username" name="email" required type="email" /></label>
            <label>Password<input autoComplete="current-password" name="password" required type="password" /></label>
            {error && <p className="error">{error}</p>}
            <button className="primary-button w-full" disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"} <Icon name="arrow" /></button>
          </form>
        ) : adding || editing ? (
          <ProductForm initial={editing} onCancel={() => { setAdding(false); setEditing(null); }} onSave={save} />
        ) : addingOffer || editingOffer ? (
          <OfferForm initial={editingOffer} onCancel={() => { setAddingOffer(false); setEditingOffer(null); }} onSave={(offer, imageFile) => saveOffer(offer, editingOffer?.id, imageFile)} />
        ) : (
          <div className="admin-content">
            <div className="admin-tabs">
              <button className={view === "products" ? "active" : ""} onClick={() => setView("products")} type="button">Products</button>
              <button className={view === "orders" ? "active" : ""} onClick={loadOrders} type="button">Orders</button>
              <button className={view === "newsletter" ? "active" : ""} onClick={loadSubscribers} type="button">Newsletter</button>
              <button className={view === "offers" ? "active" : ""} onClick={loadOffers} type="button">Offers</button>
              <button className={view === "finance" ? "active" : ""} onClick={loadFinance} type="button">Finance</button>
            </div>
            <div className="admin-top"><div><p className="eyebrow">Store management</p><h2>{view === "products" ? "Products" : view === "orders" ? "Customer orders" : view === "newsletter" ? "Newsletter subscribers" : view === "offers" ? "Offers and campaigns" : "Finance overview"}</h2><p>{view === "products" ? `${products.length} active listings` : view === "orders" ? `${orders.length} orders received` : view === "newsletter" ? `${subscribers.length} subscribers` : view === "offers" ? `${offers.length} campaigns` : "Sales performance from submitted orders"}</p></div><div className="admin-actions">{view === "products" && <button className="primary-button" onClick={() => setAdding(true)} type="button"><Icon name="plus" /> Add product</button>}{view === "offers" && <button className="primary-button" onClick={() => setAddingOffer(true)} type="button"><Icon name="plus" /> Create offer</button>}<button className="secondary-button" onClick={signOut} type="button">Sign out</button></div></div>
            {error && <p className="error">{error}</p>}
            {busy && <p className="admin-feedback" role="status">Working...</p>}
            {view === "products" ? <div className="admin-list">
              {products.map((product) => <div className="admin-row" key={product.id}><img alt="" src={product.image} /><div className="flex-1"><strong>{product.name}</strong><span>{product.category} · {money(product.price)}</span></div><button aria-label="Edit" onClick={() => setEditing(product)} type="button"><Icon name="edit" /></button><button aria-label="Delete" onClick={() => remove(product)} type="button"><Icon name="trash" /></button></div>)}
            </div> : view === "finance" ? <FinanceDashboard orders={orders} /> : view === "offers" ? <div className="offer-admin-list">
              {!offers.length && <p className="py-12 text-center text-sm text-stone-500">No offers yet. Create a campaign to feature it on the storefront.</p>}
              {offers.map((offer) => <article className="offer-admin-row" key={offer.id}>{offer.image && <img alt="" className="offer-admin-image" src={offer.image} />}<div className="offer-admin-copy"><div className="offer-admin-title"><strong>{offer.title}</strong><span className={`offer-state offer-state--${offerState(offer)}`}>{offerState(offer)}</span></div><p>{offer.description}</p><span>{offer.discountLabel || "Promotion"}{offer.promoCode ? ` · Code ${offer.promoCode}` : ""}</span><span>{offer.startsAt ? `Starts ${new Date(offer.startsAt).toLocaleString("en-KE")}` : "Starts now"}{offer.endsAt ? ` · Ends ${new Date(offer.endsAt).toLocaleString("en-KE")}` : " · No end date"}</span></div><div className="offer-admin-actions"><button className="secondary-button" onClick={() => setEditingOffer(offer)} type="button">Edit</button><button aria-label={`Delete ${offer.title}`} onClick={() => removeOffer(offer)} type="button"><Icon name="trash" /></button></div></article>)}
            </div> : <div className="order-list">
              {view === "orders" && !orders.length && <p className="py-12 text-center text-sm text-stone-500">No orders yet.</p>}
              {view === "orders" && orders.map((order) => <article className="order-row" key={order.id}><div><strong>{order.name}</strong><p>{order.phone} · {order.location}</p>{order.customerEmail && <p>{order.customerEmail}</p>}<p>{order.items.map((item) => `${item.quantity}× ${item.name} (${item.size})`).join(", ")}</p>{order.note && <p>Note: {order.note}</p>}<label className="status-control">Status<select aria-label={`Status for order ${order.id}`} disabled={busy} onChange={(event) => updateOrderStatus(order, event.target.value)} value={order.status}>{["new", "confirmed", "packed", "dispatched", "delivered", "cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div><div><strong>{money(order.total)}</strong><span>{new Date(order.createdAt).toLocaleDateString("en-KE")}</span><a href={`https://wa.me/254${order.phone.replace(/\D/g, "").replace(/^0/, "")}`} rel="noreferrer" target="_blank">Message customer</a></div></article>)}
              {view === "newsletter" && !subscribers.length && <p className="py-12 text-center text-sm text-stone-500">No subscribers yet.</p>}
              {view === "newsletter" && subscribers.map((subscriber) => <article className="subscriber-row" key={subscriber.email}><div><strong>{subscriber.email}</strong><span>Joined {new Date(subscriber.createdAt).toLocaleDateString("en-KE")}</span></div><a href={`mailto:${subscriber.email}`}>Email subscriber</a></article>)}
            </div>}
          </div>
        )}
      </section>
    </div>
  );
}

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function FinanceDashboard({ orders }: { orders: Order[] }) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const now = Date.now();
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : null;
  const earliestOrder = orders.reduce((earliest, order) => {
    const timestamp = new Date(order.createdAt).getTime();
    return Number.isFinite(timestamp) && timestamp < earliest ? timestamp : earliest;
  }, now);
  const rangeStart = periodDays === null
    ? (orders.length ? earliestOrder : now - 30 * 24 * 60 * 60 * 1000)
    : now - periodDays * 24 * 60 * 60 * 1000;
  const filteredOrders = orders.filter((order) => {
    const timestamp = new Date(order.createdAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= rangeStart && timestamp <= now;
  });
  const validOrders = filteredOrders.filter((order) => order.status !== "cancelled");
  const orderValue = validOrders.reduce((sum, order) => sum + order.total, 0);
  const deliveredValue = validOrders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + order.total, 0);
  const openValue = validOrders.filter((order) => ["new", "confirmed", "packed", "dispatched"].includes(order.status)).reduce((sum, order) => sum + order.total, 0);
  const averageValue = validOrders.length ? orderValue / validOrders.length : 0;
  const bucketCount = period === "7d" ? 7 : period === "30d" ? 10 : 12;
  const interval = Math.max(1, (now - rangeStart) / bucketCount);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const start = rangeStart + interval * index;
    const end = index === bucketCount - 1 ? now + 1 : rangeStart + interval * (index + 1);
    const date = new Date(start);
    const label = period === "7d"
      ? date.toLocaleDateString("en-KE", { weekday: "short" })
      : period === "all"
        ? date.toLocaleDateString("en-KE", { month: "short", year: "2-digit" })
        : date.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
    const value = validOrders.filter((order) => {
      const timestamp = new Date(order.createdAt).getTime();
      return timestamp >= start && timestamp < end;
    }).reduce((sum, order) => sum + order.total, 0);
    return { label, value };
  });
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.value));
  const productTotals = new Map<string, { name: string; quantity: number; value: number }>();
  validOrders.forEach((order) => order.items.forEach((item) => {
    const previous = productTotals.get(item.id) || { name: item.name, quantity: 0, value: 0 };
    previous.quantity += item.quantity;
    previous.value += item.price * item.quantity;
    productTotals.set(item.id, previous);
  }));
  const bestSellers = [...productTotals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const periodLabel = period === "all" ? "All time" : `Last ${period.slice(0, -1)} days`;

  return (
    <div className="finance-dashboard">
      <div className="finance-toolbar"><p>Order totals · {periodLabel}</p><div aria-label="Finance date range" className="finance-periods">{([["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["all", "All time"]] as const).map(([value, label]) => <button aria-pressed={period === value} className={period === value ? "active" : ""} key={value} onClick={() => setPeriod(value)} type="button">{label}</button>)}</div></div>
      <div className="finance-cards">
        <article><span>Order value</span><strong>{money(orderValue)}</strong><small>{validOrders.length} non-cancelled orders</small></article>
        <article><span>Delivered order value</span><strong>{money(deliveredValue)}</strong><small>Marked delivered by admin</small></article>
        <article><span>Open order value</span><strong>{money(openValue)}</strong><small>New through dispatched</small></article>
        <article><span>Average order value</span><strong>{money(averageValue)}</strong><small>Per non-cancelled order</small></article>
      </div>
      <section className="finance-chart-card">
        <div><h3>Order value trend</h3><p>Submitted order totals grouped across {periodLabel.toLowerCase()}.</p></div>
        <div aria-label="Order value bar chart" className="finance-chart" role="img">
          {buckets.map((bucket, index) => <div className="finance-bar-column" key={`${bucket.label}-${index}`} title={`${bucket.label}: ${money(bucket.value)}`}><span className="finance-bar-value">{bucket.value ? money(bucket.value) : ""}</span><div className="finance-bar-track"><span style={{ height: `${bucket.value ? Math.max(5, bucket.value / maxBucket * 100) : 0}%` }} /></div><small>{bucket.label}</small></div>)}
        </div>
      </section>
      <section className="finance-products-card">
        <div><h3>Best-selling products</h3><p>Ranked by units ordered, excluding cancelled orders.</p></div>
        {bestSellers.length ? <div className="finance-product-list">{bestSellers.map((product) => <div key={product.name}><strong>{product.name}</strong><span>{product.quantity} sold</span><b>{money(product.value)}</b></div>)}</div> : <p className="finance-empty">No order items in this period.</p>}
      </section>
      <p className="finance-disclaimer">These figures use submitted order totals. They do not confirm payment collection and do not subtract product, delivery, or operating costs, so they are not profit figures.</p>
    </div>
  );
}

function OfferForm({ initial, onCancel, onSave }: { initial: StoreOffer | null; onCancel: () => void; onSave: (offer: Omit<StoreOffer, "id" | "createdAt">, imageFile: File | null) => Promise<string | null> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState(initial?.image || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(initial?.image || "");
  useEffect(() => () => {
    if (imageFile && imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imageFile, imagePreview]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const startsAtValue = String(data.get("startsAt") || "");
    const endsAtValue = String(data.get("endsAt") || "");
    const startsAt = startsAtValue ? new Date(startsAtValue) : null;
    const endsAt = endsAtValue ? new Date(endsAtValue) : null;
    if (!image && !imageFile) {
      setError("Choose an image for this offer.");
      setSaving(false);
      return;
    }
    if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime()))) {
      setError("Enter a valid start and end date.");
      setSaving(false);
      return;
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      setError("The end date must be after the start date.");
      setSaving(false);
      return;
    }
    const message = await onSave({
      title: String(data.get("title")).trim(),
      description: String(data.get("description")).trim(),
      image,
      discountLabel: String(data.get("discountLabel") || "").trim(),
      promoCode: String(data.get("promoCode") || "").trim(),
      startsAt: startsAt?.toISOString() || "",
      endsAt: endsAt?.toISOString() || "",
      active: data.get("active") === "on",
    }, imageFile);
    if (message) setError(message);
    setSaving(false);
  };
  return (
    <form className="product-form offer-form" onSubmit={submit}>
      <button className="text-left text-xs uppercase tracking-widest text-stone-500" onClick={onCancel} type="button">← Back to offers</button>
      <div><p className="eyebrow">Store campaign</p><h2>{initial ? "Edit offer" : "Create an offer"}</h2><p className="offer-form-intro">Live offers appear in a banner above the storefront.</p></div>
      <div className="form-grid">
        <label className="sm:col-span-2">Headline<input defaultValue={initial?.title} maxLength={90} name="title" placeholder="Flash sale: 20% off this weekend" required /></label>
        <label className="sm:col-span-2">Message<textarea defaultValue={initial?.description} maxLength={300} name="description" placeholder="Tell customers what the offer includes." required rows={3} /></label>
        <label className="sm:col-span-2">Offer image<input accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) setError("Use a JPG, PNG, or WebP image.");
          else if (file.size > 5 * 1024 * 1024) setError("The offer image must be 5 MB or smaller.");
          else {
            setError("");
            setImage("");
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
          }
          event.target.value = "";
        }} type="file" /><span className="upload-help">Choose a JPG, PNG, or WebP image up to 5 MB.</span></label>
        {imagePreview && <div className="offer-image-preview sm:col-span-2"><img alt="Offer preview" src={imagePreview} /><button aria-label="Remove offer image" onClick={() => { setImage(""); setImageFile(null); setImagePreview(""); }} type="button">Remove image</button></div>}
        <label>Offer label<input defaultValue={initial?.discountLabel} maxLength={60} name="discountLabel" placeholder="20% OFF · FLASH SALE" /></label>
        <label>Promo code<input defaultValue={initial?.promoCode} maxLength={40} name="promoCode" placeholder="CELLY20" /></label>
        <label>Starts at<input defaultValue={localDateTime(initial?.startsAt)} name="startsAt" type="datetime-local" /></label>
        <label>Ends at<input defaultValue={localDateTime(initial?.endsAt)} name="endsAt" type="datetime-local" /></label>
        <label className="checkbox sm:col-span-2"><input defaultChecked={initial?.active ?? true} name="active" type="checkbox" /> Publish this offer</label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary-button" disabled={saving} type="submit">{saving ? "Saving offer..." : initial ? "Save changes" : "Publish offer"} <Icon name="arrow" /></button>
    </form>
  );
}

function ProductForm({ initial, onCancel, onSave }: { initial: Product | null; onCancel: () => void; onSave: (product: Product, imageFiles: File[]) => Promise<string | null> }) {
  const [existingImages, setExistingImages] = useState<string[]>(initial ? productImageList(initial) : []);
  const [selectedImages, setSelectedImages] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => selectedImages.forEach(({ preview }) => URL.revokeObjectURL(preview)), [selectedImages]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    if (existingImages.length + selectedImages.length < 2) {
      setError("Add at least two images for this product.");
      setSaving(false);
      return;
    }
    const data = new FormData(event.currentTarget);
    const message = await onSave({
      id: initial?.id || crypto.randomUUID(),
      name: String(data.get("name")),
      category: String(data.get("category")) as Category,
      price: Number(data.get("price")),
      image: existingImages[0] || "",
      images: existingImages,
      description: String(data.get("description")),
      sizes: String(data.get("sizes")).split(",").map((s) => s.trim()).filter(Boolean),
      featured: data.get("featured") === "on",
    }, selectedImages.map(({ file }) => file));
    if (message) setError(message);
    setSaving(false);
  };
  return (
    <form className="product-form" onSubmit={submit}>
      <button className="text-left text-xs uppercase tracking-widest text-stone-500" onClick={onCancel} type="button">← Back to products</button>
      <div><p className="eyebrow">Product editor</p><h2>{initial ? "Edit product" : "Add a new piece"}</h2></div>
      <div className="form-grid">
        <label>Product name<input defaultValue={initial?.name} name="name" required /></label>
        <label>Category<select defaultValue={initial?.category || "Dresses"} name="category">{categories.slice(1).map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Price (KSh)<input defaultValue={initial?.price} min="0" name="price" required type="number" /></label>
        <label>Sizes, separated by commas<input defaultValue={initial?.sizes.join(", ")} name="sizes" placeholder="S, M, L, XL" required /></label>
        <label className="sm:col-span-2">Product images<input accept="image/jpeg,image/png,image/webp" disabled={existingImages.length + selectedImages.length >= 8} multiple onChange={(event) => {
          const files = Array.from(event.target.files || []);
          const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
          const invalidFile = files.find((file) => !allowedTypes.has(file.type));
          const oversizedFile = files.find((file) => file.size > 5 * 1024 * 1024);
          if (invalidFile) setError(`${invalidFile.name} is not JPG, PNG, or WebP. Convert it to one of those formats and try again.`);
          else if (oversizedFile) setError(`${oversizedFile.name} is larger than 5 MB. Choose a smaller image.`);
          else {
            setError("");
            const remaining = Math.max(0, 8 - existingImages.length - selectedImages.length);
            setSelectedImages((current) => [...current, ...files.slice(0, remaining).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
          }
          event.target.value = "";
        }} type="file" /><span className="upload-help">Add at least 2 images, up to 8 total. JPG, PNG, or WebP · max 5 MB each. {existingImages.length + selectedImages.length}/8 selected</span></label>
        {(existingImages.length > 0 || selectedImages.length > 0) && <div className="product-image-preview sm:col-span-2">
          {existingImages.map((image, index) => <div className="product-image-tile" key={`${image}-${index}`}><img alt={`Product photo ${index + 1}`} src={image} /><button aria-label={`Remove product photo ${index + 1}`} onClick={() => setExistingImages((current) => current.filter((_, imageIndex) => imageIndex !== index))} type="button">×</button></div>)}
          {selectedImages.map(({ preview }, index) => <div className="product-image-tile" key={preview}><img alt={`New product photo ${existingImages.length + index + 1}`} src={preview} /><button aria-label={`Remove new product photo ${existingImages.length + index + 1}`} onClick={() => setSelectedImages((current) => current.filter((_, selectedIndex) => selectedIndex !== index))} type="button">×</button></div>)}
        </div>}
        <label className="sm:col-span-2">Description<textarea defaultValue={initial?.description} name="description" required rows={3} /></label>
        <label className="checkbox sm:col-span-2"><input defaultChecked={initial?.featured} name="featured" type="checkbox" /> Show bestseller badge</label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary-button" disabled={saving} type="submit"><Icon name="upload" /> {saving ? "Saving product..." : initial ? "Save changes" : "Publish product"}</button>
    </form>
  );
}

export default App;
