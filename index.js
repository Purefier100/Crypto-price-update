import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Static + Views
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// -------------------------
// Load top coins from CoinGecko (with price & logo)
// -------------------------
let allCoins = [];

async function loadAllCoins() {
    try {
        const response = await axios.get(
            "https://api.coingecko.com/api/v3/coins/markets",
            {
                params: {
                    vs_currency: "usd",
                    order: "market_cap_desc",
                    per_page: 250, // max per page
                    page: 1,
                    sparkline: false,
                },
            }
        );
        allCoins = response.data; // contains price, logo, symbol, name
        console.log(`✅ Loaded ${allCoins.length} coins with prices & logos`);
    } catch (err) {
        console.error("Failed to load coins:", err.message);
    }
}

// Load every 5 minutes
loadAllCoins();
setInterval(loadAllCoins, 5 * 60 * 1000);

// -------------------------
// Routes
// -------------------------
app.get("/", (req, res) => {
    res.render("index", { data: null, error: null });
});

app.get("/price", async (req, res) => {
    const input = req.query.symbol?.trim().toLowerCase();

    if (!input) {
        return res.render("index", { data: null, error: "Enter a coin symbol" });
    }

    try {
        const coin = allCoins.find((c) => c.symbol.toLowerCase() === input);
        if (!coin) throw new Error("Coin not found");

        res.render("index", {
            data: {
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                price: coin.current_price,
                change: coin.price_change_percentage_24h,
                logo: coin.image,
                network: "Multiple",
                chartSymbol: `${coin.symbol.toUpperCase()}USD`,
            },
            error: null,
        });
    } catch (err) {
        res.render("index", { data: null, error: "Coin not found" });
    }
});

app.listen(PORT, () =>
    console.log(`✅ Server running at http://localhost:${PORT}`)
);

